import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { Router, type IRouter } from 'express';
import { z } from 'zod';
import { DEFAULT_PLATFORM_CONFIG, formatKobo, maskBidderName } from '@autodey/shared';
import {
  optionalAuth,
  requireAuth,
  type AuthenticatedRequest,
} from '../../middleware/auth.js';
import { AppError, asyncHandler } from '../../middleware/errors.js';
import { rateLimit } from '../../middleware/rateLimit.js';
import {
  AuctionModel,
  BidModel,
  ConversationModel,
  DisputeModel,
  ListingModel,
  SettlementModel,
  UserModel,
  type IAuction,
} from '../../models/index.js';
import {
  buyNowAuction,
  placeBid,
  sanitizeAuctionForPublic,
} from './bidding.service.js';
import {
  closeExpiredAuction,
  computeSellerSuccessFeeKobo,
  scheduleAuctionClose,
} from '../../jobs/auctionScheduler.js';
import {
  assertAndHoldDepositForBid,
  resolveWinnerAuctionDeposit,
} from '../wallet/wallet.service.js';

export const auctionsRouter: IRouter = Router();

auctionsRouter.get(
  '/auctions',
  optionalAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const statusFilter = (req.query.status as string) || 'live';
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const filter: Record<string, unknown> = {};
    if (statusFilter !== 'all') {
      filter.status = statusFilter;
    }

    const auctions = await AuctionModel.find(filter)
      .sort({ endsAt: 1 })
      .limit(limit)
      .populate('listingId')
      .lean();

    const items = auctions.map((a) => {
      const listingDoc = a.listingId as unknown as Record<string, unknown>;
      return {
        ...sanitizeAuctionForPublic(
          {
            ...a,
            listingId: listingDoc?._id ?? a.listingId,
          },
          req.user?.sub,
        ),
        listing: listingDoc,
      };
    });

    res.json({
      items,
      serverTimeMs: Date.now(),
    });
  }),
);

const CreateAuctionSchema = z.object({
  listingId: z.string().min(1),
  startPrice: z.number().int().positive(),
  reservePrice: z.number().int().positive().nullable().optional(),
  buyNowPrice: z.number().int().positive().nullable().optional(),
  durationDays: z.union([
    z.literal(1),
    z.literal(3),
    z.literal(5),
    z.literal(7),
    z.literal(10),
  ]),
  waiveVerificationForAdmin: z.boolean().optional(),
});

auctionsRouter.post(
  '/auctions',
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = CreateAuctionSchema.parse(req.body);
    const userId = req.user!.sub;

    const [seller, listing] = await Promise.all([
      UserModel.findById(userId),
      ListingModel.findById(parsed.listingId),
    ]);

    if (!seller) {
      throw AppError.notFound('USER_NOT_FOUND', 'Seller account not found');
    }
    if (!listing) {
      throw AppError.notFound('LISTING_NOT_FOUND', 'Vehicle listing not found');
    }

    const isAdmin = seller.roles.includes('admin') || seller.roles.includes('moderator');
    if (String(listing.sellerId) !== String(seller._id) && !isAdmin) {
      throw AppError.forbidden('FORBIDDEN', 'You can only create an auction for your own listing');
    }

    // Eligibility check: ID verified or Verified Dealer (unless admin)
    if (
      !isAdmin &&
      !seller.verification?.idVerified &&
      !seller.verification?.dealerVerified
    ) {
      throw AppError.forbidden(
        'SELLER_VERIFICATION_REQUIRED',
        'Only ID-verified sellers or Verified Dealers can create timed auctions.',
      );
    }

    // Vehicle must have VIN and customs papers info filled in (admin can waive)
    if (
      !(isAdmin && parsed.waiveVerificationForAdmin) &&
      (!listing.vin || listing.customsStatus === 'unsure')
    ) {
      throw AppError.badRequest(
        'VEHICLE_TRUST_INFO_REQUIRED',
        'Auction vehicles must have a 17-character VIN and declared customs papers status.',
      );
    }

    if (parsed.reservePrice && parsed.reservePrice < parsed.startPrice) {
      throw AppError.badRequest(
        'INVALID_RESERVE_PRICE',
        'Reserve price must be greater than or equal to start price',
      );
    }

    if (parsed.buyNowPrice && parsed.buyNowPrice <= parsed.startPrice) {
      throw AppError.badRequest(
        'INVALID_BUY_NOW_PRICE',
        'Buy Now price must be strictly greater than start price',
      );
    }

    const existingAuction = await AuctionModel.findOne({ listingId: listing._id });
    if (existingAuction) {
      throw AppError.conflict(
        'AUCTION_ALREADY_EXISTS',
        'An auction already exists for this listing',
      );
    }

    const now = new Date();
    const endsAt = new Date(now.getTime() + parsed.durationDays * 24 * 3600 * 1000);

    const auction = await AuctionModel.create({
      listingId: listing._id,
      sellerId: listing.sellerId,
      status: 'live',
      startPrice: parsed.startPrice,
      currentPrice: parsed.startPrice,
      reservePrice: parsed.reservePrice ?? null,
      reserveMet: !parsed.reservePrice,
      buyNowPrice: parsed.buyNowPrice ?? null,
      startsAt: now,
      endsAt,
      originalEndsAt: endsAt,
      extensions: 0,
      bidCount: 0,
      leader: null,
      settlementMode: DEFAULT_PLATFORM_CONFIG.settlementMode,
    });

    listing.isAuction = true;
    listing.auctionId = auction._id;
    await listing.save();

    scheduleAuctionClose(String(auction._id), endsAt);

    res.status(201).json({
      auction: sanitizeAuctionForPublic(auction, userId),
    });
  }),
);

auctionsRouter.get(
  '/auctions/:id',
  optionalAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = String(req.params.id);
    let auction: IAuction | null = await AuctionModel.findById(id);
    if (!auction) {
      auction = await AuctionModel.findOne({ listingId: id });
    }
    if (!auction) {
      throw AppError.notFound('AUCTION_NOT_FOUND', 'Auction not found');
    }

    // Lazy close check if deadline has passed while status is still 'live'
    if (auction.status === 'live' && Date.now() >= auction.endsAt.getTime()) {
      const closedRes = await closeExpiredAuction(String(auction._id));
      if (closedRes.auction) {
        auction = closedRes.auction;
      }
    }

    const currentAuction = auction;
    const [listing, seller, bids, leaderUser, settlement] = await Promise.all([
      ListingModel.findById(currentAuction.listingId).lean(),
      UserModel.findById(currentAuction.sellerId)
        .select(
          'displayName phone email verification ratingStats responseStats createdAt',
        )
        .lean(),
      BidModel.find({ auctionId: currentAuction._id })
        .sort({ sequence: -1 })
        .limit(50)
        .select('maskedBidderName amountKobo type sequence createdAt')
        .lean(),
      currentAuction.leader?.userId
        ? UserModel.findById(currentAuction.leader.userId).select('displayName phone email').lean()
        : Promise.resolve(null),
      SettlementModel.findOne({ auctionId: currentAuction._id }).lean(),
    ]);

    const viewerId = req.user?.sub;
    const isSeller = Boolean(viewerId && String(currentAuction.sellerId) === String(viewerId));
    const isLeader = Boolean(
      viewerId && currentAuction.leader && String(currentAuction.leader.userId) === String(viewerId),
    );
    const isAdmin = Boolean(
      req.user?.roles.includes('admin') || req.user?.roles.includes('moderator'),
    );

    const leaderMaskedName = leaderUser ? maskBidderName(leaderUser.displayName) : undefined;
    const publicAuction = sanitizeAuctionForPublic(currentAuction, viewerId, leaderMaskedName);

    const showMutualContacts =
      (currentAuction.status === 'sold_pending_settlement' || currentAuction.status === 'settled') &&
      (isSeller || isLeader || isAdmin);

    res.json({
      auction: publicAuction,
      listing,
      seller: seller
        ? {
            _id: seller._id,
            displayName: seller.displayName,
            kycStatus: seller.verification?.idVerified ? 'verified' : 'unverified',
            dealerVerified: Boolean(seller.verification?.dealerVerified),
            ratingAvg: seller.ratingStats?.avg ?? 0,
            ratingCount: seller.ratingStats?.count ?? 0,
            avgResponseMinutes: seller.responseStats?.avgResponseMinutes ?? 10,
            responseRatePercent: seller.responseStats?.ratePercent ?? 95,
            ...(showMutualContacts ? { phone: seller.phone, email: seller.email } : {}),
          }
        : null,
      winnerContact:
        showMutualContacts && leaderUser
          ? {
              _id: leaderUser._id,
              displayName: leaderUser.displayName,
              phone: leaderUser.phone,
              email: leaderUser.email,
            }
          : null,
      bids,
      settlement: isSeller || isLeader || isAdmin ? settlement : null,
      serverTimeMs: Date.now(),
    });
  }),
);

auctionsRouter.get(
  '/auctions/:id/bids',
  asyncHandler(async (req, res) => {
    const bids = await BidModel.find({ auctionId: String(req.params.id) })
      .sort({ sequence: -1 })
      .limit(100)
      .select('maskedBidderName amountKobo type sequence createdAt')
      .lean();

    res.json({ bids });
  }),
);

const PlaceBidSchema = z.object({
  maxBidKobo: z.number().int().positive(),
  deviceFingerprint: z.string().optional(),
});

auctionsRouter.post(
  '/auctions/:id/bids',
  requireAuth,
  rateLimit({ prefix: 'bid', maxRequests: 60, windowSeconds: 10 }),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = PlaceBidSchema.parse(req.body);
    const ipHash = crypto
      .createHash('sha256')
      .update(req.ip || '127.0.0.1')
      .digest('hex')
      .slice(0, 16);
    const deviceFingerprintHash = parsed.deviceFingerprint
      ? crypto.createHash('sha256').update(parsed.deviceFingerprint).digest('hex').slice(0, 16)
      : undefined;

    const result = await placeBid({
      auctionId: String(req.params.id),
      bidderId: req.user!.sub,
      maxBidKobo: parsed.maxBidKobo,
      ipHash,
      deviceFingerprintHash,
    });

    res.status(201).json({
      auction: result.auction,
      bidsRecorded: result.bidsRecorded.map((b) => ({
        _id: b._id,
        maskedBidderName: b.maskedBidderName,
        amountKobo: b.amountKobo,
        type: b.type,
        sequence: b.sequence,
        createdAt: b.createdAt,
      })),
      reserveJustMet: result.reserveJustMet,
      softCloseExtended: result.softCloseExtended,
      serverTimeMs: Date.now(),
    });
  }),
);

auctionsRouter.post(
  '/auctions/:id/buy-now',
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const result = await buyNowAuction({
      auctionId: String(req.params.id),
      buyerId: req.user!.sub,
    });

    res.status(200).json({
      auction: result.auction,
      settlement: result.settlement,
      serverTimeMs: Date.now(),
    });
  }),
);

auctionsRouter.post(
  '/auctions/:id/watch',
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const auction = await AuctionModel.findById(req.params.id);
    if (!auction) {
      throw AppError.notFound('AUCTION_NOT_FOUND', 'Auction not found');
    }
    const uid = new mongoose.Types.ObjectId(req.user!.sub);
    const exists = auction.watchers.some((w) => String(w) === String(uid));
    if (exists) {
      auction.watchers = auction.watchers.filter((w) => String(w) !== String(uid));
    } else {
      auction.watchers.push(uid);
    }
    await auction.save();
    res.json({ watching: !exists, watchersCount: auction.watchers.length });
  }),
);

const PostAuctionOfferSchema = z.object({
  amountKobo: z.number().int().positive(),
  action: z.enum(['offer', 'accept', 'decline', 'counter']).default('offer'),
});

auctionsRouter.post(
  '/auctions/:id/post-offer',
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = PostAuctionOfferSchema.parse(req.body);
    const userId = req.user!.sub;

    const auction = await AuctionModel.findById(req.params.id);
    if (!auction) {
      throw AppError.notFound('AUCTION_NOT_FOUND', 'Auction not found');
    }

    if (auction.status !== 'ended_reserve_not_met') {
      throw AppError.badRequest(
        'INVALID_AUCTION_STATE',
        'Post-auction offers are only available when reserve was not met',
      );
    }

    if (!auction.leader) {
      throw AppError.badRequest('NO_HIGHEST_BIDDER', 'This auction ended without any bidders');
    }

    const isSeller = String(auction.sellerId) === String(userId);
    const isHighestBidder = String(auction.leader.userId) === String(userId);

    if (!isSeller && !isHighestBidder) {
      throw AppError.forbidden(
        'FORBIDDEN',
        'Only the seller and the highest bidder can negotiate a post-auction offer',
      );
    }

    const session = await mongoose.startSession();
    try {
      let settlementDoc = await SettlementModel.findOne({ auctionId: auction._id });

      await session.withTransaction(async () => {
        if (parsed.action === 'accept') {
          const agreedPriceKobo =
            settlementDoc?.postAuctionOffer?.counterAmountKobo ??
            settlementDoc?.postAuctionOffer?.amountKobo ??
            parsed.amountKobo;

          await assertAndHoldDepositForBid({
            userId: auction.leader!.userId,
            auctionId: auction._id,
            maxBidKobo: agreedPriceKobo,
            session,
          });

          auction.currentPrice = agreedPriceKobo;
          auction.reserveMet = true;
          auction.status = 'sold_pending_settlement';
          await auction.save({ session });

          let conversation = await ConversationModel.findOne({
            listingId: auction.listingId,
            buyerId: auction.leader!.userId,
            sellerId: auction.sellerId,
          }).session(session);

          if (!conversation) {
            const [createdConv] = await ConversationModel.create(
              [
                {
                  listingId: auction.listingId,
                  buyerId: auction.leader!.userId,
                  sellerId: auction.sellerId,
                  lastMessagePreview: `Post-auction offer accepted at ${formatKobo(agreedPriceKobo)}`,
                  lastMessageAt: new Date(),
                },
              ],
              { session },
            );
            conversation = createdConv!;
          }

          const platformFeeKobo = computeSellerSuccessFeeKobo(agreedPriceKobo);
          const deadlineAt = new Date(
            Date.now() + DEFAULT_PLATFORM_CONFIG.settlementWindowHours * 3600 * 1000,
          );

          if (settlementDoc) {
            settlementDoc.hammerPriceKobo = agreedPriceKobo;
            settlementDoc.platformFeeKobo = platformFeeKobo;
            settlementDoc.status = 'pending';
            settlementDoc.deadlineAt = deadlineAt;
            settlementDoc.conversationId = conversation._id;
            settlementDoc.postAuctionOffer = {
              amountKobo: agreedPriceKobo,
              status: 'accepted',
            };
            await settlementDoc.save({ session });
          } else {
            const [created] = await SettlementModel.create(
              [
                {
                  auctionId: auction._id,
                  listingId: auction.listingId,
                  sellerId: auction.sellerId,
                  winnerId: auction.leader!.userId,
                  hammerPriceKobo: agreedPriceKobo,
                  platformFeeKobo,
                  mode: auction.settlementMode,
                  status: 'pending',
                  deadlineAt,
                  conversationId: conversation._id,
                  postAuctionOffer: {
                    amountKobo: agreedPriceKobo,
                    status: 'accepted',
                  },
                },
              ],
              { session },
            );
            settlementDoc = created!;
          }
        } else {
          const deadlineAt = new Date(
            Date.now() + DEFAULT_PLATFORM_CONFIG.settlementWindowHours * 3600 * 1000,
          );
          if (!settlementDoc) {
            const [created] = await SettlementModel.create(
              [
                {
                  auctionId: auction._id,
                  listingId: auction.listingId,
                  sellerId: auction.sellerId,
                  winnerId: auction.leader!.userId,
                  hammerPriceKobo: parsed.amountKobo,
                  platformFeeKobo: computeSellerSuccessFeeKobo(parsed.amountKobo),
                  mode: auction.settlementMode,
                  status: 'pending',
                  deadlineAt,
                  postAuctionOffer: {
                    amountKobo: parsed.amountKobo,
                    status: parsed.action === 'counter' ? 'countered' : 'offered',
                    ...(parsed.action === 'counter'
                      ? { counterAmountKobo: parsed.amountKobo }
                      : {}),
                  },
                },
              ],
              { session },
            );
            settlementDoc = created!;
          } else {
            settlementDoc.postAuctionOffer = {
              amountKobo: settlementDoc.postAuctionOffer?.amountKobo ?? parsed.amountKobo,
              counterAmountKobo:
                parsed.action === 'counter' ? parsed.amountKobo : undefined,
              status:
                parsed.action === 'decline'
                  ? 'declined'
                  : parsed.action === 'counter'
                    ? 'countered'
                    : 'offered',
            };
            await settlementDoc.save({ session });
          }
        }
      });

      res.json({
        auction: sanitizeAuctionForPublic(auction, userId),
        settlement: settlementDoc,
      });
    } finally {
      await session.endSession();
    }
  }),
);

auctionsRouter.post(
  '/settlements/:id/confirm',
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const userId = req.user!.sub;
    const session = await mongoose.startSession();

    try {
      let updatedSettlement = await SettlementModel.findById(req.params.id);
      if (!updatedSettlement) {
        throw AppError.notFound('SETTLEMENT_NOT_FOUND', 'Settlement not found');
      }

      const isBuyer = String(updatedSettlement.winnerId) === String(userId);
      const isSeller = String(updatedSettlement.sellerId) === String(userId);
      const isAdmin =
        req.user!.roles.includes('admin') || req.user!.roles.includes('moderator');

      if (!isBuyer && !isSeller && !isAdmin) {
        throw AppError.forbidden('FORBIDDEN', 'Not a participant in this settlement');
      }

      await session.withTransaction(async () => {
        const settlement = await SettlementModel.findById(req.params.id).session(session);
        if (!settlement) {
          throw AppError.notFound('SETTLEMENT_NOT_FOUND', 'Settlement not found');
        }

        if (settlement.status === 'completed') {
          updatedSettlement = settlement;
          return;
        }

        const now = new Date();
        if (isBuyer || isAdmin) {
          settlement.buyerConfirmedAt = settlement.buyerConfirmedAt ?? now;
        }
        if (isSeller || isAdmin) {
          settlement.sellerConfirmedAt = settlement.sellerConfirmedAt ?? now;
        }

        if (settlement.buyerConfirmedAt && settlement.sellerConfirmedAt) {
          settlement.status = 'completed';
          await settlement.save({ session });

          await resolveWinnerAuctionDeposit({
            auctionId: settlement.auctionId,
            settlementId: settlement._id,
            winnerId: settlement.winnerId,
            outcome: 'release',
            session,
          });

          await AuctionModel.updateOne(
            { _id: settlement.auctionId },
            { $set: { status: 'settled' } },
            { session },
          );

          await ListingModel.updateOne(
            { _id: settlement.listingId },
            { $set: { status: 'sold' } },
            { session },
          );
        } else if (settlement.buyerConfirmedAt) {
          settlement.status = 'buyer_confirmed';
          await settlement.save({ session });
        } else if (settlement.sellerConfirmedAt) {
          settlement.status = 'seller_confirmed';
          await settlement.save({ session });
        }

        updatedSettlement = settlement;
      });

      res.json({ settlement: updatedSettlement });
    } finally {
      await session.endSession();
    }
  }),
);

auctionsRouter.post(
  '/settlements/:id/default',
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const userId = req.user!.sub;
    const isAdmin =
      req.user!.roles.includes('admin') || req.user!.roles.includes('moderator');

    const session = await mongoose.startSession();
    try {
      let settlementDoc!: InstanceType<typeof SettlementModel>;
      let buyerStrikes = 0;
      let buyerAuctionBanned = false;

      await session.withTransaction(async () => {
        const settlement = await SettlementModel.findById(req.params.id).session(session);
        if (!settlement) {
          throw AppError.notFound('SETTLEMENT_NOT_FOUND', 'Settlement not found');
        }

        const isSeller = String(settlement.sellerId) === String(userId);
        if (!isSeller && !isAdmin) {
          throw AppError.forbidden('FORBIDDEN', 'Only seller or admin can report buyer default');
        }

        if (
          !isAdmin &&
          Date.now() < new Date(settlement.deadlineAt).getTime()
        ) {
          throw AppError.badRequest(
            'SETTLEMENT_WINDOW_ACTIVE',
            'The 72-hour settlement window has not yet expired. Open a dispute if the buyer refused early.',
          );
        }

        if (settlement.status === 'buyer_defaulted' || settlement.status === 'completed') {
          throw AppError.badRequest('ALREADY_FINALIZED', 'Settlement is already finalized');
        }

        settlement.status = 'buyer_defaulted';
        await settlement.save({ session });

        await resolveWinnerAuctionDeposit({
          auctionId: settlement.auctionId,
          settlementId: settlement._id,
          winnerId: settlement.winnerId,
          outcome: 'forfeit',
          forfeitPercent: DEFAULT_PLATFORM_CONFIG.buyerDefaultForfeitPercent,
          session,
        });

        const buyer = await UserModel.findById(settlement.winnerId).session(session);
        if (buyer) {
          buyer.strikes = (buyer.strikes ?? 0) + 1;
          await buyer.save({ session });
          buyerStrikes = buyer.strikes;
          buyerAuctionBanned = buyer.strikes >= DEFAULT_PLATFORM_CONFIG.maxStrikesBeforeBan;
        }

        await AuctionModel.updateOne(
          { _id: settlement.auctionId },
          { $set: { status: 'cancelled' } },
          { session },
        );

        settlementDoc = settlement;
      });

      res.json({
        settlement: settlementDoc,
        buyerStrikes,
        buyerAuctionBanned,
      });
    } finally {
      await session.endSession();
    }
  }),
);

const CreateDisputeSchema = z.object({
  reason: z.string().min(3).max(120),
  details: z.string().min(10).max(2000),
});

auctionsRouter.post(
  '/settlements/:id/dispute',
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = CreateDisputeSchema.parse(req.body);
    const userId = req.user!.sub;

    const settlement = await SettlementModel.findById(req.params.id);
    if (!settlement) {
      throw AppError.notFound('SETTLEMENT_NOT_FOUND', 'Settlement not found');
    }

    const isParticipant =
      String(settlement.winnerId) === String(userId) ||
      String(settlement.sellerId) === String(userId);
    if (!isParticipant) {
      throw AppError.forbidden('FORBIDDEN', 'Only settlement participants can open a dispute');
    }

    settlement.status = 'disputed';
    await settlement.save();

    await AuctionModel.updateOne(
      { _id: settlement.auctionId },
      { $set: { status: 'disputed' } },
    );

    const dispute = await DisputeModel.create({
      settlementId: settlement._id,
      auctionId: settlement.auctionId,
      openedBy: new mongoose.Types.ObjectId(userId),
      reason: parsed.reason,
      details: parsed.details,
      status: 'open',
    });

    res.status(201).json({
      dispute,
      settlement,
    });
  }),
);
