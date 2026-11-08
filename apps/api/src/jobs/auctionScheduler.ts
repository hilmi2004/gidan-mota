import mongoose from 'mongoose';
import { DEFAULT_PLATFORM_CONFIG, formatKobo, maskBidderName } from '@autodey/shared';
import {
  AuctionModel,
  ConversationModel,
  ListingModel,
  SettlementModel,
  UserModel,
  type IAuction,
  type ISettlement,
} from '../models/index.js';
import { acquireDistributedLock } from '../config/redis.js';
import { releaseNonWinnerAuctionHolds } from '../modules/wallet/wallet.service.js';
import { dispatchNotification } from '../modules/notifications/notifications.service.js';
import { ioServer } from '../server.js';
import { logger } from '../config/logger.js';

const scheduledCloseTimers = new Map<string, NodeJS.Timeout>();

export function computeSellerSuccessFeeKobo(hammerPriceKobo: number): number {
  const rawFee = Math.round(
    (hammerPriceKobo * DEFAULT_PLATFORM_CONFIG.sellerSuccessFeePercent) / 100,
  );
  return Math.min(rawFee, DEFAULT_PLATFORM_CONFIG.sellerSuccessFeeCapKobo);
}

/**
 * Schedules or reschedules the delayed job `auction-close:{auctionId}` for `endsAt`.
 * Safe to call repeatedly when soft-close extends `endsAt`.
 */
export function scheduleAuctionClose(auctionId: string, endsAt: Date): void {
  const key = `auction-close:${auctionId}`;
  const existing = scheduledCloseTimers.get(key);
  if (existing) {
    clearTimeout(existing);
    scheduledCloseTimers.delete(key);
  }

  const delayMs = Math.max(0, endsAt.getTime() - Date.now());
  // Node setTimeout max safe delay is 2^31 - 1 (~24.8 days)
  const boundedDelayMs = Math.min(delayMs, 2_147_483_647);

  const timer = setTimeout(() => {
    scheduledCloseTimers.delete(key);
    void closeExpiredAuction(auctionId).catch((err) => {
      logger.error({ err, auctionId }, 'Error running scheduled auction close job');
    });
  }, boundedDelayMs);

  // Do not prevent process exit during tests
  if (typeof timer.unref === 'function') {
    timer.unref();
  }

  scheduledCloseTimers.set(key, timer);
}

export function cancelScheduledAuctionClose(auctionId: string): void {
  const key = `auction-close:${auctionId}`;
  const existing = scheduledCloseTimers.get(key);
  if (existing) {
    clearTimeout(existing);
    scheduledCloseTimers.delete(key);
  }
}

/**
 * Idempotent auction close handler.
 * Re-reads the auction inside a distributed lock + MongoDB replica-set transaction,
 * verifies `now >= endsAt`, transitions state, releases non-winner deposits, and creates Settlement.
 */
export async function closeExpiredAuction(
  auctionId: string,
  now: Date = new Date(),
): Promise<{
  closed: boolean;
  auction: IAuction | null;
  settlement: ISettlement | null;
}> {
  const lock = await acquireDistributedLock(`lock:auction:${auctionId}`);
  const session = await mongoose.startSession();

  try {
    let closed = false;
    let finalAuction: IAuction | null = null;
    let finalSettlement: ISettlement | null = null;
    let winnerNameMasked: string | null = null;

    await session.withTransaction(async () => {
      const auction = await AuctionModel.findById(auctionId).session(session);
      if (!auction) {
        finalAuction = null;
        return;
      }

      // Idempotency & soft-close extension guard:
      if (auction.status !== 'live' || now.getTime() < auction.endsAt.getTime()) {
        finalAuction = auction;
        if (auction.status === 'live' && now.getTime() < auction.endsAt.getTime()) {
          // Reschedule for the future endsAt
          scheduleAuctionClose(String(auction._id), auction.endsAt);
        }
        return;
      }

      const hasLeader = Boolean(auction.leader && auction.leader.userId);
      const isReserveSatisfied = !auction.reservePrice || auction.reserveMet;

      if (hasLeader && isReserveSatisfied && auction.leader) {
        auction.status = 'sold_pending_settlement';
        await auction.save({ session });

        // Release all non-winning bidders' deposits immediately; keep winner's locked
        await releaseNonWinnerAuctionHolds({
          auctionId: auction._id,
          winnerId: auction.leader.userId,
          session,
        });

        const winnerUser = await UserModel.findById(auction.leader.userId).session(session);
        winnerNameMasked = maskBidderName(winnerUser?.displayName || 'Bidder');

        // Ensure a conversation exists between winner and seller for the 72h settlement workspace
        let conversation = await ConversationModel.findOne({
          listingId: auction.listingId,
          buyerId: auction.leader.userId,
          sellerId: auction.sellerId,
        }).session(session);

        if (!conversation) {
          const createdConvs = await ConversationModel.create(
            [
              {
                listingId: auction.listingId,
                buyerId: auction.leader.userId,
                sellerId: auction.sellerId,
                lastMessagePreview: 'Auction won — 72-hour settlement workspace opened.',
                lastMessageAt: now,
              },
            ],
            { session },
          );
          conversation = createdConvs[0]!;
        }

        const platformFeeKobo = computeSellerSuccessFeeKobo(auction.currentPrice);
        const deadlineAt = new Date(
          now.getTime() + DEFAULT_PLATFORM_CONFIG.settlementWindowHours * 3600 * 1000,
        );

        const existingSettlement = await SettlementModel.findOne({
          auctionId: auction._id,
        }).session(session);

        if (existingSettlement) {
          finalSettlement = existingSettlement;
        } else {
          const [createdSettlement] = await SettlementModel.create(
            [
              {
                auctionId: auction._id,
                listingId: auction.listingId,
                sellerId: auction.sellerId,
                winnerId: auction.leader.userId,
                hammerPriceKobo: auction.currentPrice,
                platformFeeKobo,
                mode: auction.settlementMode,
                status: 'pending',
                deadlineAt,
                conversationId: conversation._id,
              },
            ],
            { session },
          );
          finalSettlement = createdSettlement!;
        }

        closed = true;
        finalAuction = auction;
      } else {
        // Reserve not met or zero bids
        auction.status = 'ended_reserve_not_met';
        await auction.save({ session });

        // Release ALL bidders' deposits (since there is no binding winner)
        await releaseNonWinnerAuctionHolds({
          auctionId: auction._id,
          winnerId: null,
          session,
        });

        closed = true;
        finalAuction = auction;
      }
    });

    if (closed && finalAuction) {
      const auctionObj = finalAuction as IAuction;
      const listing = await ListingModel.findById(auctionObj.listingId).lean();

      ioServer
        ?.of('/auctions')
        .to(`auction:${String(auctionObj._id)}`)
        .emit('auction_ended', {
          auctionId: String(auctionObj._id),
          status: auctionObj.status,
          finalPriceKobo: auctionObj.currentPrice,
          reserveMet: auctionObj.reserveMet,
          winnerMasked: winnerNameMasked,
        });

      if (auctionObj.status === 'sold_pending_settlement' && auctionObj.leader) {
        await Promise.all([
          dispatchNotification({
            userId: String(auctionObj.leader.userId),
            type: 'auction_won',
            title: `You won: ${listing?.title ?? 'Auction Vehicle'}`,
            body: `Winning hammer price: ${formatKobo(
              auctionObj.currentPrice,
            )}. Complete inspection and settlement within 72 hours.`,
            actionUrl: `/auctions/${String(auctionObj._id)}`,
          }),
          dispatchNotification({
            userId: String(auctionObj.sellerId),
            type: 'auction_won',
            title: `Auction sold: ${listing?.title ?? 'Vehicle'}`,
            body: `Winning bid: ${formatKobo(
              auctionObj.currentPrice,
            )}. Coordinate inspection and handover with the winner within 72 hours.`,
            actionUrl: `/auctions/${String(auctionObj._id)}`,
          }),
        ]);
      } else if (auctionObj.status === 'ended_reserve_not_met') {
        await dispatchNotification({
          userId: String(auctionObj.sellerId),
          type: 'settlement_reminder',
          title: `Auction ended (Reserve not met): ${listing?.title ?? 'Vehicle'}`,
          body: auctionObj.leader
            ? `Highest bid reached ${formatKobo(
                auctionObj.currentPrice,
              )}. You can negotiate a post-auction offer with the highest bidder.`
            : 'The auction ended with no bids.',
          actionUrl: `/auctions/${String(auctionObj._id)}`,
        });
      }
    }

    return {
      closed,
      auction: finalAuction,
      settlement: finalSettlement,
    };
  } finally {
    await session.endSession();
    await lock.release();
  }
}

