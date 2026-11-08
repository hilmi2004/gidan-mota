import mongoose from 'mongoose';
import {
  DEFAULT_PLATFORM_CONFIG,
  formatKobo,
  getBidIncrementKobo,
  maskBidderName,
} from '@autodey/shared';
import {
  AuctionAuditLogModel,
  AuctionModel,
  BidModel,
  ConfigEntryModel,
  ConversationModel,
  ListingModel,
  SettlementModel,
  UserModel,
  type IAuction,
  type IBid,
  type ISettlement,
} from '../../models/index.js';
import { acquireDistributedLock } from '../../config/redis.js';
import { AppError } from '../../middleware/errors.js';
import {
  assertAndHoldDepositForBid,
  releaseNonWinnerAuctionHolds,
} from '../wallet/wallet.service.js';
import {
  cancelScheduledAuctionClose,
  computeSellerSuccessFeeKobo,
  scheduleAuctionClose,
} from '../../jobs/auctionScheduler.js';
import { dispatchNotification } from '../notifications/notifications.service.js';
import { ioServer } from '../../server.js';

export interface PublicAuctionView {
  _id: string;
  listingId: string;
  sellerId: string;
  status: IAuction['status'];
  startPrice: number;
  currentPrice: number;
  reserveMet: boolean;
   hasReserve: boolean;
  buyNowPrice: number | null;
  buyNowAvailable: boolean;
  startsAt: Date;
  endsAt: Date;
  originalEndsAt: Date;
  extensions: number;
  bidCount: number;
  nextMinBidKobo: number;
  leader: {
    userId: string;
    maskedName?: string;
    placedAt: Date;
  } | null;
  myProxyMaxKobo?: number | null;
  settlementMode: 'DIRECT' | 'HOLD';
}

export function sanitizeAuctionForPublic(
  auction: IAuction | Record<string, unknown>,
  viewerUserId?: string,
  leaderMaskedName?: string,
): PublicAuctionView {
  const raw = typeof (auction as IAuction).toObject === 'function'
    ? (auction as IAuction).toObject()
    : (auction as Record<string, unknown>);

  const currentPrice = Number(raw.currentPrice);
  const startPrice = Number(raw.startPrice);
  const bidCount = Number(raw.bidCount ?? 0);
  const reservePrice = raw.reservePrice as number | null | undefined;
  const reserveMet = Boolean(raw.reserveMet);
  const buyNowPrice = (raw.buyNowPrice as number | null | undefined) ?? null;

  const inc = getBidIncrementKobo(currentPrice);
  const nextMinBidKobo = bidCount === 0 ? startPrice : currentPrice + inc;

  const rawLeader = raw.leader as
    | { userId: mongoose.Types.ObjectId | string; proxyMax: number; placedAt: Date }
    | null
    | undefined;

  const isViewerLeader =
    Boolean(viewerUserId && rawLeader && String(rawLeader.userId) === String(viewerUserId));

  const buyNowAvailable =
    raw.status === 'live' &&
    typeof buyNowPrice === 'number' &&
    buyNowPrice > 0 &&
    currentPrice < buyNowPrice &&
    (!reservePrice || !reserveMet);

  return {
    _id: String(raw._id),
    listingId: String(raw.listingId),
    sellerId: String(raw.sellerId),
    status: raw.status as IAuction['status'],
    startPrice,
    currentPrice,
    reserveMet,
    hasReserve: typeof reservePrice === 'number' && reservePrice > 0,
    buyNowPrice,
    buyNowAvailable,
    startsAt: new Date(raw.startsAt as Date),
    endsAt: new Date(raw.endsAt as Date),
    originalEndsAt: new Date(raw.originalEndsAt as Date),
    extensions: Number(raw.extensions ?? 0),
    bidCount,
    nextMinBidKobo,
    leader: rawLeader
      ? {
          userId: String(rawLeader.userId),
          ...(leaderMaskedName ? { maskedName: leaderMaskedName } : {}),
          placedAt: new Date(rawLeader.placedAt),
        }
      : null,
    ...(isViewerLeader && rawLeader ? { myProxyMaxKobo: rawLeader.proxyMax } : {}),
    settlementMode: (raw.settlementMode as 'DIRECT' | 'HOLD') ?? 'DIRECT',
  };
}

export interface PlaceBidInput {
  auctionId: string;
  bidderId: string;
  maxBidKobo: number;
  now?: Date;
  ipHash?: string;
  deviceFingerprintHash?: string;
}

export interface PlaceBidOutput {
  auction: PublicAuctionView;
  bidsRecorded: IBid[];
  reserveJustMet: boolean;
  softCloseExtended: boolean;
  outbidUserId: string | null;
}

/**
 * Authoritative proxy-bidding engine (`placeBid`).
 * Runs inside a per-auction distributed lock (`lock:auction:{id}`) AND a MongoDB replica-set transaction
 * with optimistic concurrency check (`__v`).
 */
export async function placeBid(input: PlaceBidInput): Promise<PlaceBidOutput> {
  if (!Number.isInteger(input.maxBidKobo) || input.maxBidKobo <= 0) {
    throw AppError.badRequest('INVALID_BID_AMOUNT', 'Bid amount must be a positive integer in kobo');
  }

  const now = input.now ?? new Date();
  const lock = await acquireDistributedLock(`lock:auction:${input.auctionId}`);
  const session = await mongoose.startSession();

  try {
    let finalAuctionDoc!: IAuction;
    const bidsRecorded: IBid[] = [];
    let reserveJustMet = false;
    let softCloseExtended = false;
    let outbidUserId: string | null = null;
    let leaderMaskedName = 'Bidder';

    await session.withTransaction(async () => {
      // Load runtime config overrides if present
      const [softWindowEntry, maxExtEntry, newAccCapEntry] = await Promise.all([
        ConfigEntryModel.findOne({ key: 'softCloseWindowMs' }).session(session).lean(),
        ConfigEntryModel.findOne({ key: 'maxTotalExtensionMs' }).session(session).lean(),
        ConfigEntryModel.findOne({ key: 'newAccountMaxBidKobo' }).session(session).lean(),
      ]);

      const softCloseWindowMs =
        typeof softWindowEntry?.value === 'number'
          ? softWindowEntry.value
          : DEFAULT_PLATFORM_CONFIG.softCloseWindowMs;
      const maxTotalExtensionMs =
        typeof maxExtEntry?.value === 'number'
          ? maxExtEntry.value
          : DEFAULT_PLATFORM_CONFIG.maxTotalExtensionMs;
      const newAccountMaxBidKobo =
        typeof newAccCapEntry?.value === 'number'
          ? newAccCapEntry.value
          : DEFAULT_PLATFORM_CONFIG.newAccountMaxBidKobo;

      const auction = await AuctionModel.findById(input.auctionId).session(session);
      if (!auction) {
        throw AppError.notFound('AUCTION_NOT_FOUND', 'Auction not found');
      }

      if (auction.status !== 'live' || now.getTime() >= auction.endsAt.getTime()) {
        throw AppError.badRequest(
          'AUCTION_ENDED',
          'This auction is no longer accepting bids',
        );
      }

      if (String(auction.sellerId) === String(input.bidderId)) {
        throw AppError.forbidden(
          'OWN_AUCTION',
          'Sellers cannot bid on their own auctions',
        );
      }

      const bidder = await UserModel.findById(input.bidderId).session(session);
      const isCurrentlyBanned = Boolean(
        bidder?.bannedUntil && new Date(bidder.bannedUntil).getTime() > now.getTime(),
      );
      if (!bidder || isCurrentlyBanned) {
        throw AppError.forbidden('BIDDER_NOT_ALLOWED', 'Bidder account is not permitted to bid');
      }

      if ((bidder.strikes ?? 0) >= DEFAULT_PLATFORM_CONFIG.maxStrikesBeforeBan) {
        throw AppError.forbidden(
          'AUCTION_BANNED',
          'Your account is suspended from bidding due to settlement defaults',
        );
      }

      // New-account bid ceiling (< 24h old unless ID-verified)
      const accountAgeMs = now.getTime() - new Date(bidder.createdAt).getTime();
      if (
        accountAgeMs < 24 * 3600 * 1000 &&
        !bidder.verification?.idVerified &&
        input.maxBidKobo > newAccountMaxBidKobo
      ) {
        throw AppError.forbidden(
          'NEW_ACCOUNT_BID_CEILING',
          `Accounts created within the last 24 hours are limited to ${formatKobo(
            newAccountMaxBidKobo,
          )} unless ID-verified.`,
        );
      }

      // Check & lock refundable bidding deposit
      await assertAndHoldDepositForBid({
        userId: bidder._id,
        auctionId: auction._id,
        maxBidKobo: input.maxBidKobo,
        session,
      });

      const bidderIdObj = bidder._id;
      const bidderMasked = maskBidderName(bidder.displayName);

      // Compute minimum allowed bid
      const inc = getBidIncrementKobo(auction.currentPrice);
      const minAllowed =
        auction.bidCount === 0 ? auction.startPrice : auction.currentPrice + inc;

      // Note: if current leader is raising their own max, they must exceed their existing proxyMax
      if (auction.leader && String(auction.leader.userId) === String(bidderIdObj)) {
        if (input.maxBidKobo <= auction.leader.proxyMax) {
          throw AppError.badRequest(
            'MAX_NOT_HIGHER',
            `Your new maximum bid must be greater than your current maximum bid (${formatKobo(
              auction.leader.proxyMax,
            )})`,
          );
        }
      } else if (input.maxBidKobo < minAllowed) {
        throw AppError.badRequest(
          'BID_TOO_LOW',
          `Minimum allowed bid is ${formatKobo(minAllowed)}`,
        );
      }

      let sequenceCounter = auction.bidCount;

      const recordBid = async (
        targetBidderId: mongoose.Types.ObjectId,
        targetMaskedName: string,
        amountKobo: number,
        type: 'manual' | 'proxy' | 'buy_now',
      ): Promise<IBid> => {
        sequenceCounter += 1;
        const [createdBid] = await BidModel.create(
          [
            {
              auctionId: auction._id,
              bidderId: targetBidderId,
              maskedBidderName: targetMaskedName,
              amountKobo,
              type,
              ipHash: input.ipHash,
              deviceFingerprintHash: input.deviceFingerprintHash,
              sequence: sequenceCounter,
            },
          ],
          { session },
        );
        bidsRecorded.push(createdBid!);
        return createdBid!;
      };

      // Case 1: First bid on the auction
      if (!auction.leader) {
        auction.leader = {
          userId: bidderIdObj,
          proxyMax: input.maxBidKobo,
          placedAt: now,
        };
        auction.currentPrice = auction.startPrice;
        leaderMaskedName = bidderMasked;
        await recordBid(bidderIdObj, bidderMasked, auction.currentPrice, 'manual');
      }
      // Case 2: Current leader is raising their own max
      else if (String(auction.leader.userId) === String(bidderIdObj)) {
        auction.leader.proxyMax = input.maxBidKobo;
        leaderMaskedName = bidderMasked;
        // Visible currentPrice does NOT change unless reserve is crossed below
        await AuctionAuditLogModel.create(
          [
            {
              auctionId: auction._id,
              bidderId: bidderIdObj,
              eventType: 'max_updated',
              submittedMaxKobo: input.maxBidKobo,
              resultingPriceKobo: auction.currentPrice,
              ipHash: input.ipHash,
              deviceFingerprintHash: input.deviceFingerprintHash,
              notes: 'Leader raised own proxyMax',
            },
          ],
          { session },
        );
      }
      // Case 3: Challenger's max is strictly below leader's proxyMax
      else if (input.maxBidKobo < auction.leader.proxyMax) {
        const leaderUser = await UserModel.findById(auction.leader.userId).session(session);
        leaderMaskedName = maskBidderName(leaderUser?.displayName || 'Leader');

        await recordBid(bidderIdObj, bidderMasked, input.maxBidKobo, 'manual');
        const newPrice = Math.min(
          auction.leader.proxyMax,
          input.maxBidKobo + getBidIncrementKobo(input.maxBidKobo),
        );
        auction.currentPrice = newPrice;
        await recordBid(auction.leader.userId, leaderMaskedName, newPrice, 'proxy');
      }
      // Case 4: Tie — earlier proxy wins the tie at that exact price
      else if (input.maxBidKobo === auction.leader.proxyMax) {
        const leaderUser = await UserModel.findById(auction.leader.userId).session(session);
        leaderMaskedName = maskBidderName(leaderUser?.displayName || 'Leader');

        await recordBid(bidderIdObj, bidderMasked, input.maxBidKobo, 'manual');
        auction.currentPrice = auction.leader.proxyMax;
        await recordBid(
          auction.leader.userId,
          leaderMaskedName,
          auction.currentPrice,
          'proxy',
        );
      }
      // Case 5: Challenger beats leader's proxyMax (maxBidKobo > auction.leader.proxyMax)
      else {
        const oldLeader = {
          userId: auction.leader.userId,
          proxyMax: auction.leader.proxyMax,
          placedAt: auction.leader.placedAt,
        };
        const oldLeaderUser = await UserModel.findById(oldLeader.userId).session(session);
        const oldLeaderMasked = maskBidderName(oldLeaderUser?.displayName || 'Bidder');

        const newPrice = Math.min(
          input.maxBidKobo,
          oldLeader.proxyMax + getBidIncrementKobo(oldLeader.proxyMax),
        );

        if (oldLeader.proxyMax > auction.currentPrice) {
          await recordBid(oldLeader.userId, oldLeaderMasked, oldLeader.proxyMax, 'proxy');
        }

        auction.leader = {
          userId: bidderIdObj,
          proxyMax: input.maxBidKobo,
          placedAt: now,
        };
        auction.currentPrice = newPrice;
        leaderMaskedName = bidderMasked;
        await recordBid(bidderIdObj, bidderMasked, newPrice, 'manual');
        outbidUserId = String(oldLeader.userId);
      }

      // Reserve handling:
      // If auction.reservePrice is set and !auction.reserveMet:
      // whenever auction.leader.proxyMax >= auction.reservePrice, set auction.reserveMet = true,
      // advance auction.currentPrice = Math.max(auction.currentPrice, auction.reservePrice), and emit reserve_met.
      if (
        typeof auction.reservePrice === 'number' &&
        auction.reservePrice > 0 &&
        !auction.reserveMet &&
        auction.leader &&
        auction.leader.proxyMax >= auction.reservePrice
      ) {
        auction.reserveMet = true;
        reserveJustMet = true;
        if (auction.currentPrice < auction.reservePrice) {
          auction.currentPrice = auction.reservePrice;
          // If a bid was just recorded for the leader at a lower price, update the top bid or record proxy jump to reserve
          const lastBid = bidsRecorded[bidsRecorded.length - 1];
          if (lastBid && String(lastBid.bidderId) === String(auction.leader.userId)) {
            lastBid.amountKobo = auction.reservePrice;
            await lastBid.save({ session });
          } else {
            await recordBid(
              auction.leader.userId,
              leaderMaskedName,
              auction.reservePrice,
              'proxy',
            );
          }
        }

        await AuctionAuditLogModel.create(
          [
            {
              auctionId: auction._id,
              bidderId: auction.leader.userId,
              eventType: 'reserve_met',
              submittedMaxKobo: input.maxBidKobo,
              resultingPriceKobo: auction.currentPrice,
              notes: 'Hidden reserve price met',
            },
          ],
          { session },
        );
      }

      auction.bidCount = sequenceCounter;

      // Soft-close anti-sniping:
      // If a bid arrives when endsAt - now <= SOFT_CLOSE_WINDOW_MS (default 2 minutes),
      // extend endsAt = Math.min(now + SOFT_CLOSE_WINDOW_MS, originalEndsAt + MAX_TOTAL_EXTENSION_MS)
      const timeRemainingMs = auction.endsAt.getTime() - now.getTime();
      if (timeRemainingMs <= softCloseWindowMs) {
        const candidateEndsAtMs = Math.min(
          now.getTime() + softCloseWindowMs,
          auction.originalEndsAt.getTime() + maxTotalExtensionMs,
        );
        if (candidateEndsAtMs > auction.endsAt.getTime()) {
          auction.endsAt = new Date(candidateEndsAtMs);
          auction.extensions += 1;
          softCloseExtended = true;

          await AuctionAuditLogModel.create(
            [
              {
                auctionId: auction._id,
                bidderId: bidderIdObj,
                eventType: 'soft_close_extended',
                submittedMaxKobo: input.maxBidKobo,
                resultingPriceKobo: auction.currentPrice,
                notes: `Extended endsAt to ${auction.endsAt.toISOString()} (extension #${auction.extensions})`,
              },
            ],
            { session },
          );
        }
      }

      // Audit log for every bid submission
      await AuctionAuditLogModel.create(
        [
          {
            auctionId: auction._id,
            bidderId: bidderIdObj,
            eventType: 'bid_placed',
            submittedMaxKobo: input.maxBidKobo,
            resultingPriceKobo: auction.currentPrice,
            ipHash: input.ipHash,
            deviceFingerprintHash: input.deviceFingerprintHash,
          },
        ],
        { session },
      );

      await auction.save({ session });
      finalAuctionDoc = auction;
    });

    // Post-commit side effects: reschedule close job, emit WebSocket events, send outbid notification
    if (softCloseExtended) {
      scheduleAuctionClose(String(finalAuctionDoc._id), finalAuctionDoc.endsAt);
    }

    const publicBroadcastView = sanitizeAuctionForPublic(
      finalAuctionDoc,
      undefined,
      leaderMaskedName,
    );

    const room = ioServer?.of('/auctions').to(`auction:${String(finalAuctionDoc._id)}`);
    if (room) {
      room.emit('price_updated', {
        auctionId: String(finalAuctionDoc._id),
        currentPrice: publicBroadcastView.currentPrice,
        nextMinBidKobo: publicBroadcastView.nextMinBidKobo,
        bidCount: publicBroadcastView.bidCount,
        reserveMet: publicBroadcastView.reserveMet,
        buyNowAvailable: publicBroadcastView.buyNowAvailable,
        leader: publicBroadcastView.leader,
        endsAt: publicBroadcastView.endsAt,
        extensions: publicBroadcastView.extensions,
        latestBids: bidsRecorded.map((b) => ({
          _id: String(b._id),
          maskedBidderName: b.maskedBidderName,
          amountKobo: b.amountKobo,
          type: b.type,
          sequence: b.sequence,
          createdAt: b.createdAt,
        })),
      });

      if (reserveJustMet) {
        room.emit('reserve_met', {
          auctionId: String(finalAuctionDoc._id),
          currentPrice: publicBroadcastView.currentPrice,
        });
      }

      if (softCloseExtended) {
        room.emit('ends_at_extended', {
          auctionId: String(finalAuctionDoc._id),
          endsAt: publicBroadcastView.endsAt,
          extensions: publicBroadcastView.extensions,
        });
      }
    }

    if (outbidUserId) {
      void dispatchNotification({
        userId: outbidUserId,
        type: 'outbid',
        title: 'You have been outbid!',
        body: `Another bidder placed a higher bid. Current price is now ${formatKobo(
          finalAuctionDoc.currentPrice,
        )}.`,
        actionUrl: `/auctions/${String(finalAuctionDoc._id)}`,
      });
    }

    const callerView = sanitizeAuctionForPublic(
      finalAuctionDoc,
      input.bidderId,
      leaderMaskedName,
    );

    return {
      auction: callerView,
      bidsRecorded,
      reserveJustMet,
      softCloseExtended,
      outbidUserId,
    };
  } finally {
    await session.endSession();
    await lock.release();
  }
}

/**
 * Executes Buy Now on a live auction:
 * Available ONLY while `currentPrice < buyNowPrice` AND `(!reservePrice || !reserveMet)`.
 * Immediately ends the auction at `buyNowPrice` and transitions to `sold_pending_settlement`.
 */
export async function buyNowAuction(params: {
  auctionId: string;
  buyerId: string;
  now?: Date;
}): Promise<{
  auction: PublicAuctionView;
  settlement: ISettlement;
}> {
  const now = params.now ?? new Date();
  const lock = await acquireDistributedLock(`lock:auction:${params.auctionId}`);
  const session = await mongoose.startSession();

  try {
    let finalAuction!: IAuction;
    let finalSettlement!: ISettlement;
    let buyerMasked = 'Buyer';

    await session.withTransaction(async () => {
      const auction = await AuctionModel.findById(params.auctionId).session(session);
      if (!auction) {
        throw AppError.notFound('AUCTION_NOT_FOUND', 'Auction not found');
      }

      if (auction.status !== 'live' || now.getTime() >= auction.endsAt.getTime()) {
        throw AppError.badRequest('AUCTION_ENDED', 'This auction is no longer live');
      }

      if (String(auction.sellerId) === String(params.buyerId)) {
        throw AppError.forbidden('OWN_AUCTION', 'Sellers cannot buy their own auction');
      }

      if (
        typeof auction.buyNowPrice !== 'number' ||
        auction.buyNowPrice <= 0 ||
        auction.currentPrice >= auction.buyNowPrice ||
        (auction.reservePrice && auction.reserveMet)
      ) {
        throw AppError.badRequest(
          'BUY_NOW_UNAVAILABLE',
          'Buy Now is no longer available on this auction',
        );
      }

      const buyer = await UserModel.findById(params.buyerId).session(session);
      const isBuyerBanned = Boolean(
        buyer?.bannedUntil && new Date(buyer.bannedUntil).getTime() > now.getTime(),
      );
      if (
        !buyer ||
        isBuyerBanned ||
        (buyer.strikes ?? 0) >= DEFAULT_PLATFORM_CONFIG.maxStrikesBeforeBan
      ) {
        throw AppError.forbidden('BUYER_NOT_ALLOWED', 'Account cannot participate in auctions');
      }

      await assertAndHoldDepositForBid({
        userId: buyer._id,
        auctionId: auction._id,
        maxBidKobo: auction.buyNowPrice,
        session,
      });

      buyerMasked = maskBidderName(buyer.displayName);
      const buyNowAmount = auction.buyNowPrice;

      auction.bidCount += 1;
      await BidModel.create(
        [
          {
            auctionId: auction._id,
            bidderId: buyer._id,
            maskedBidderName: buyerMasked,
            amountKobo: buyNowAmount,
            type: 'buy_now',
            sequence: auction.bidCount,
          },
        ],
        { session },
      );

      auction.leader = {
        userId: buyer._id,
        proxyMax: buyNowAmount,
        placedAt: now,
      };
      auction.currentPrice = buyNowAmount;
      auction.reserveMet = true;
      auction.endsAt = now;
      auction.status = 'sold_pending_settlement';
      await auction.save({ session });

      await releaseNonWinnerAuctionHolds({
        auctionId: auction._id,
        winnerId: buyer._id,
        session,
      });

      let conversation = await ConversationModel.findOne({
        listingId: auction.listingId,
        buyerId: buyer._id,
        sellerId: auction.sellerId,
      }).session(session);

      if (!conversation) {
        const [createdConv] = await ConversationModel.create(
          [
            {
              listingId: auction.listingId,
              buyerId: buyer._id,
              sellerId: auction.sellerId,
              lastMessagePreview: `Bought via Buy Now at ${formatKobo(buyNowAmount)}`,
              lastMessageAt: now,
            },
          ],
          { session },
        );
        conversation = createdConv!;
      }

      const platformFeeKobo = computeSellerSuccessFeeKobo(buyNowAmount);
      const deadlineAt = new Date(
        now.getTime() + DEFAULT_PLATFORM_CONFIG.settlementWindowHours * 3600 * 1000,
      );

      const [settlement] = await SettlementModel.create(
        [
          {
            auctionId: auction._id,
            listingId: auction.listingId,
            sellerId: auction.sellerId,
            winnerId: buyer._id,
            hammerPriceKobo: buyNowAmount,
            platformFeeKobo,
            mode: auction.settlementMode,
            status: 'pending',
            deadlineAt,
            conversationId: conversation._id,
          },
        ],
        { session },
      );

      finalAuction = auction;
      finalSettlement = settlement!;
    });

    cancelScheduledAuctionClose(String(finalAuction._id));

    const listing = await ListingModel.findById(finalAuction.listingId).lean();
    ioServer
      ?.of('/auctions')
      .to(`auction:${String(finalAuction._id)}`)
      .emit('auction_ended', {
        auctionId: String(finalAuction._id),
        status: finalAuction.status,
        finalPriceKobo: finalAuction.currentPrice,
        reserveMet: true,
        winnerMasked: buyerMasked,
      });

    void dispatchNotification({
      userId: String(finalAuction.sellerId),
      type: 'auction_won',
      title: `Sold via Buy Now: ${listing?.title ?? 'Vehicle'}`,
      body: `Bought immediately at ${formatKobo(finalAuction.currentPrice)}.`,
      actionUrl: `/auctions/${String(finalAuction._id)}`,
    });

    return {
      auction: sanitizeAuctionForPublic(finalAuction, params.buyerId, buyerMasked),
      settlement: finalSettlement,
    };
  } finally {
    await session.endSession();
    await lock.release();
  }
}

