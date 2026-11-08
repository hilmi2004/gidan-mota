import mongoose from 'mongoose';
import { Router, type IRouter } from 'express';
import { z } from 'zod';
import { DEFAULT_PLATFORM_CONFIG } from '@autodey/shared';
import {
  requireAuth,
  requireRoles,
  type AuthenticatedRequest,
} from '../../middleware/auth.js';
import { AppError, asyncHandler } from '../../middleware/errors.js';
import {
  AuctionAuditLogModel,
  AuctionModel,
  AuditLogModel,
  BidModel,
  ConfigEntryModel,
  DealerProfileModel,
  DisputeModel,
  ListingModel,
  PaymentModel,
  ReportModel,
  SettlementModel,
  UserModel,
  VehicleDocumentModel,
} from '../../models/index.js';
import { resolveWinnerAuctionDeposit } from '../wallet/wallet.service.js';
import { scheduleAuctionClose } from '../../jobs/auctionScheduler.js';

export const adminRouter: IRouter = Router();

async function recordAdminAuditLog(params: {
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  ip?: string;
}): Promise<void> {
  await AuditLogModel.create({
    actorId: new mongoose.Types.ObjectId(params.actorId),
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId,
    before: params.before,
    after: params.after,
    ip: params.ip,
  });
}

// ============================================================================
// 1. ADMIN KPI OVERVIEW
// ============================================================================
adminRouter.get(
  '/admin/overview',
  requireAuth,
  requireRoles('moderator', 'admin'),
  asyncHandler(async (_req, res) => {
    const [
      totalUsers,
      activeListings,
      flaggedListings,
      liveAuctions,
      pendingDocuments,
      pendingDealers,
      openDisputes,
      openReports,
      settledAuctions,
      successfulPayments,
    ] = await Promise.all([
      UserModel.countDocuments({ deletedAt: null }),
      ListingModel.countDocuments({ status: 'active' }),
      ListingModel.countDocuments({ status: 'pending_review' }),
      AuctionModel.countDocuments({ status: 'live' }),
      VehicleDocumentModel.countDocuments({ status: 'pending' }),
      DealerProfileModel.countDocuments({ status: 'pending' }),
      DisputeModel.countDocuments({ status: 'open' }),
      ReportModel.countDocuments({ status: 'pending' }),
      SettlementModel.find({ status: { $in: ['completed', 'pending', 'buyer_confirmed', 'seller_confirmed'] } })
        .select('hammerPriceKobo platformFeeKobo status')
        .lean(),
      PaymentModel.find({
        status: 'success',
        purpose: { $in: ['promotion', 'dealer_subscription', 'auction_fee'] },
      })
        .select('amountKobo purpose')
        .lean(),
    ]);

    const auctionGmvKobo = settledAuctions.reduce((sum, s) => sum + s.hammerPriceKobo, 0);
    const auctionFeeRevenueKobo = settledAuctions
      .filter((s) => s.status === 'completed')
      .reduce((sum, s) => sum + s.platformFeeKobo, 0);
    const commerceRevenueKobo = successfulPayments.reduce((sum, p) => sum + p.amountKobo, 0);

    res.json({
      kpis: {
        totalUsers,
        activeListings,
        flaggedListings,
        liveAuctions,
        pendingDocuments,
        pendingDealers,
        openDisputes,
        openReports,
        auctionGmvKobo,
        totalPlatformRevenueKobo: commerceRevenueKobo + auctionFeeRevenueKobo,
        commerceRevenueKobo,
        auctionFeeRevenueKobo,
      },
    });
  }),
);

// ============================================================================
// 2. MODERATION QUEUE (FLAGGED LISTINGS & REPORTS)
// ============================================================================
adminRouter.get(
  '/admin/moderation/listings',
  requireAuth,
  requireRoles('moderator', 'admin'),
  asyncHandler(async (_req, res) => {
    const [listings, reports] = await Promise.all([
      ListingModel.find({
        $or: [
          { status: 'pending_review' },
          { moderationFlags: { $exists: true, $not: { $size: 0 } } },
          { reportsCount: { $gt: 0 } },
        ],
      })
        .sort({ updatedAt: -1 })
        .limit(50)
        .populate('sellerId', 'displayName phone verification')
        .lean(),
      ReportModel.find({ status: 'pending' })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),
    ]);

    res.json({ listings, reports });
  }),
);

const ModerateListingSchema = z.object({
  action: z.enum(['approve', 'reject', 'remove']).optional(),
  decision: z.enum(['approve', 'reject', 'remove']).optional(),
  reason: z.string().max(500).optional(),
});

adminRouter.patch(
  '/admin/moderation/listings/:id',
  requireAuth,
  requireRoles('moderator', 'admin'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = ModerateListingSchema.parse(req.body);
    const modAction = parsed.action ?? parsed.decision ?? 'approve';
    const listing = await ListingModel.findById(String(req.params.id));

    if (!listing) {
      throw AppError.notFound('LISTING_NOT_FOUND', 'Listing not found');
    }

    const before = {
      status: listing.status,
      moderationFlags: [...listing.moderationFlags],
    };

    if (modAction === 'approve') {
      listing.status = 'active';
      listing.moderationFlags = [];
      listing.rejectionReason = undefined;
    } else if (modAction === 'reject') {
      listing.status = 'rejected';
      listing.rejectionReason = parsed.reason ?? 'Violates marketplace trust guidelines';
    } else {
      listing.status = 'removed';
      listing.rejectionReason = parsed.reason ?? 'Removed by moderator';
    }

    await listing.save();

    await ReportModel.updateMany(
      { targetType: 'listing', targetId: listing._id, status: 'pending' },
      {
        $set: {
          status: modAction === 'approve' ? 'dismissed' : 'actioned',
          resolvedBy: new mongoose.Types.ObjectId(req.user!.sub),
        },
      },
    );

    await recordAdminAuditLog({
      actorId: req.user!.sub,
      action: `moderation.listing.${modAction}`,
      entityType: 'Listing',
      entityId: String(listing._id),
      before,
      after: {
        status: listing.status,
        moderationFlags: listing.moderationFlags,
        rejectionReason: listing.rejectionReason,
      },
      ip: req.ip,
    });

    res.json({ listing });
  }),
);

// ============================================================================
// 3. USERS, KYC & DEALER CAC VERIFICATION QUEUE
// ============================================================================
adminRouter.get(
  '/admin/users',
  requireAuth,
  requireRoles('moderator', 'admin'),
  asyncHandler(async (_req, res) => {
    const [users, dealerApplications] = await Promise.all([
      UserModel.find({ deletedAt: null })
        .sort({ createdAt: -1 })
        .limit(60)
        .select('displayName phone email roles verification strikes bannedUntil banReason createdAt')
        .lean(),
      DealerProfileModel.find()
        .sort({ createdAt: -1 })
        .limit(40)
        .populate('userId', 'displayName phone email verification')
        .lean(),
    ]);

    res.json({ users, dealerApplications });
  }),
);

const BanUserSchema = z.object({
  banned: z.boolean(),
  durationDays: z.number().int().positive().default(365),
  reason: z.string().max(400).optional(),
});

adminRouter.patch(
  '/admin/users/:id/ban',
  requireAuth,
  requireRoles('moderator', 'admin'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = BanUserSchema.parse(req.body);
    const user = await UserModel.findById(String(req.params.id));

    if (!user) {
      throw AppError.notFound('USER_NOT_FOUND', 'User not found');
    }

    const before = { bannedUntil: user.bannedUntil, banReason: user.banReason };

    if (parsed.banned) {
      user.bannedUntil = new Date(Date.now() + parsed.durationDays * 24 * 3600 * 1000);
      user.banReason = parsed.reason ?? 'Suspended by platform moderation';
    } else {
      user.bannedUntil = null;
      user.banReason = undefined;
    }

    await user.save();

    await recordAdminAuditLog({
      actorId: req.user!.sub,
      action: parsed.banned ? 'user.ban' : 'user.unban',
      entityType: 'User',
      entityId: String(user._id),
      before,
      after: { bannedUntil: user.bannedUntil, banReason: user.banReason },
      ip: req.ip,
    });

    res.json({ user });
  }),
);

const ReviewDealerSchema = z.object({
  status: z.enum(['approved', 'rejected']),
});

adminRouter.patch(
  '/admin/dealers/:id/review',
  requireAuth,
  requireRoles('moderator', 'admin'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = ReviewDealerSchema.parse(req.body);
    const dealer = await DealerProfileModel.findById(String(req.params.id));

    if (!dealer) {
      throw AppError.notFound('DEALER_NOT_FOUND', 'Dealer profile not found');
    }

    const before = { status: dealer.status };
    dealer.status = parsed.status;
    dealer.approvedBy = new mongoose.Types.ObjectId(req.user!.sub);
    dealer.approvedAt = new Date();
    await dealer.save();

    const user = await UserModel.findById(dealer.userId);
    if (user) {
      user.verification.dealerVerified = parsed.status === 'approved';
      if (parsed.status === 'approved' && !user.roles.includes('dealer')) {
        user.roles.push('dealer');
      }
      await user.save();
    }

    await recordAdminAuditLog({
      actorId: req.user!.sub,
      action: `dealer.review.${parsed.status}`,
      entityType: 'DealerProfile',
      entityId: String(dealer._id),
      before,
      after: { status: dealer.status, dealerVerified: parsed.status === 'approved' },
      ip: req.ip,
    });

    res.json({ dealer, user });
  }),
);

// ============================================================================
// 4. AUCTIONS AUDIT LOG (WITH proxyMax & ANTI-SHILL SIGNALS) & CONTROLS
// ============================================================================
adminRouter.get(
  '/admin/auctions/:id/audit',
  requireAuth,
  requireRoles('moderator', 'admin'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const auctionId = String(req.params.id);
    const [auction, auditLogs, bids] = await Promise.all([
      AuctionModel.findById(auctionId).lean(),
      AuctionAuditLogModel.find({ auctionId })
        .sort({ createdAt: -1 })
        .populate('bidderId', 'displayName phone')
        .lean(),
      BidModel.find({ auctionId })
        .sort({ sequence: -1 })
        .lean(),
    ]);

    if (!auction) {
      throw AppError.notFound('AUCTION_NOT_FOUND', 'Auction not found');
    }

    // Anti-shill signal detection: flag repeated IP hashes or device fingerprint hashes across distinct bidders
    const ipToBidders = new Map<string, Set<string>>();
    const fpToBidders = new Map<string, Set<string>>();

    for (const b of bids) {
      const uid = String(b.bidderId);
      if (b.ipHash) {
        const set = ipToBidders.get(b.ipHash) ?? new Set<string>();
        set.add(uid);
        ipToBidders.set(b.ipHash, set);
      }
      if (b.deviceFingerprintHash) {
        const set = fpToBidders.get(b.deviceFingerprintHash) ?? new Set<string>();
        set.add(uid);
        fpToBidders.set(b.deviceFingerprintHash, set);
      }
    }

    const shillSignals: string[] = [];
    for (const [ipHash, usersSet] of ipToBidders.entries()) {
      if (usersSet.size > 1) {
        shillSignals.push(
          `Multiple distinct bidders (${usersSet.size}) shared IP hash ${ipHash}`,
        );
      }
    }
    for (const [fpHash, usersSet] of fpToBidders.entries()) {
      if (usersSet.size > 1) {
        shillSignals.push(
          `Multiple distinct bidders (${usersSet.size}) shared device fingerprint ${fpHash}`,
        );
      }
    }

    res.json({
      auctionRaw: auction, // Admin-only view includes reservePrice and leader.proxyMax
      auditLogs,
      bids,
      shillSignals,
    });
  }),
);

const AdminAuctionActionSchema = z.object({
  action: z.enum(['extend', 'cancel']),
  extendMinutes: z.number().int().positive().max(1440).optional(),
  reason: z.string().min(3).max(400),
});

adminRouter.post(
  '/admin/auctions/:id/action',
  requireAuth,
  requireRoles('admin'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = AdminAuctionActionSchema.parse(req.body);
    const auction = await AuctionModel.findById(String(req.params.id));

    if (!auction) {
      throw AppError.notFound('AUCTION_NOT_FOUND', 'Auction not found');
    }

    const before = {
      status: auction.status,
      endsAt: auction.endsAt,
    };

    if (parsed.action === 'extend') {
      const addMs = (parsed.extendMinutes ?? 15) * 60 * 1000;
      auction.endsAt = new Date(auction.endsAt.getTime() + addMs);
      auction.extensions += 1;
      await auction.save();
      scheduleAuctionClose(String(auction._id), auction.endsAt);
    } else {
      auction.status = 'cancelled';
      await auction.save();
    }

    await AuctionAuditLogModel.create({
      auctionId: auction._id,
      bidderId: new mongoose.Types.ObjectId(req.user!.sub),
      eventType: 'admin_action',
      resultingPriceKobo: auction.currentPrice,
      notes: `Admin ${parsed.action}: ${parsed.reason}`,
    });

    await recordAdminAuditLog({
      actorId: req.user!.sub,
      action: `auction.admin.${parsed.action}`,
      entityType: 'Auction',
      entityId: String(auction._id),
      before,
      after: { status: auction.status, endsAt: auction.endsAt, reason: parsed.reason },
      ip: req.ip,
    });

    res.json({ auction });
  }),
);

// ============================================================================
// 5. CUSTOMS & INSPECTION DOCUMENT QUEUE
// ============================================================================
adminRouter.get(
  '/admin/documents',
  requireAuth,
  requireRoles('moderator', 'admin'),
  asyncHandler(async (_req, res) => {
    const documents = await VehicleDocumentModel.find()
      .sort({ status: 1, createdAt: -1 })
      .limit(50)
      .populate('listingId', 'title slug vin make model year')
      .populate('sellerId', 'displayName phone')
      .lean();

    res.json({ documents });
  }),
);

// ============================================================================
// 6. DISPUTES RESOLUTION QUEUE
// ============================================================================
adminRouter.get(
  '/admin/disputes',
  requireAuth,
  requireRoles('moderator', 'admin'),
  asyncHandler(async (_req, res) => {
    const disputes = await DisputeModel.find()
      .sort({ status: 1, createdAt: -1 })
      .limit(50)
      .populate('openedBy', 'displayName phone')
      .populate('settlementId')
      .lean();

    res.json({ disputes });
  }),
);

const ResolveDisputeSchema = z.object({
  outcome: z.enum(['forfeit_deposit', 'refund_deposit', 'ban_user', 'no_action']),
  adminNotes: z.string().min(3).max(1000),
});

adminRouter.patch(
  '/admin/disputes/:id/resolve',
  requireAuth,
  requireRoles('moderator', 'admin'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = ResolveDisputeSchema.parse(req.body);
    const dispute = await DisputeModel.findById(String(req.params.id));

    if (!dispute) {
      throw AppError.notFound('DISPUTE_NOT_FOUND', 'Dispute not found');
    }

    const settlement = await SettlementModel.findById(dispute.settlementId);
    if (!settlement) {
      throw AppError.notFound('SETTLEMENT_NOT_FOUND', 'Associated settlement not found');
    }

    const before = { status: dispute.status, outcome: dispute.outcome };

    if (parsed.outcome === 'forfeit_deposit') {
      await resolveWinnerAuctionDeposit({
        auctionId: settlement.auctionId,
        settlementId: settlement._id,
        winnerId: settlement.winnerId,
        outcome: 'forfeit',
        forfeitPercent: DEFAULT_PLATFORM_CONFIG.buyerDefaultForfeitPercent,
      });
      settlement.status = 'buyer_defaulted';
      await settlement.save();
      await UserModel.updateOne({ _id: settlement.winnerId }, { $inc: { strikes: 1 } });
    } else if (parsed.outcome === 'refund_deposit') {
      await resolveWinnerAuctionDeposit({
        auctionId: settlement.auctionId,
        settlementId: settlement._id,
        winnerId: settlement.winnerId,
        outcome: 'release',
      });
      settlement.status = 'seller_cancelled';
      await settlement.save();
    } else if (parsed.outcome === 'ban_user') {
      await resolveWinnerAuctionDeposit({
        auctionId: settlement.auctionId,
        settlementId: settlement._id,
        winnerId: settlement.winnerId,
        outcome: 'forfeit',
        forfeitPercent: 100,
      });
      settlement.status = 'buyer_defaulted';
      await settlement.save();
      await UserModel.updateOne(
        { _id: settlement.winnerId },
        {
          $set: {
            strikes: DEFAULT_PLATFORM_CONFIG.maxStrikesBeforeBan,
            bannedUntil: new Date(Date.now() + 365 * 24 * 3600 * 1000),
            banReason: `Dispute resolution: ${parsed.adminNotes}`,
          },
        },
      );
    }

    dispute.status = 'resolved';
    dispute.outcome = parsed.outcome;
    dispute.adminNotes = parsed.adminNotes;
    dispute.resolvedBy = new mongoose.Types.ObjectId(req.user!.sub);
    dispute.resolvedAt = new Date();
    await dispute.save();

    await recordAdminAuditLog({
      actorId: req.user!.sub,
      action: `dispute.resolve.${parsed.outcome}`,
      entityType: 'Dispute',
      entityId: String(dispute._id),
      before,
      after: {
        status: dispute.status,
        outcome: dispute.outcome,
        adminNotes: dispute.adminNotes,
      },
      ip: req.ip,
    });

    res.json({ dispute, settlement });
  }),
);

// ============================================================================
// 7. RUNTIME PLATFORM CONFIG EDITOR & IMMUTABLE AUDIT LOG VIEWER
// ============================================================================
adminRouter.get(
  '/admin/config',
  requireAuth,
  requireRoles('moderator', 'admin'),
  asyncHandler(async (_req, res) => {
    const entries = await ConfigEntryModel.find().lean();
    const merged: Record<string, unknown> = { ...DEFAULT_PLATFORM_CONFIG };
    for (const entry of entries) {
      merged[entry.key] = entry.value;
    }
    res.json({ config: merged, overrides: entries });
  }),
);

const UpdateConfigSchema = z.object({
  key: z.string().min(2).max(80),
  value: z.unknown(),
});

adminRouter.put(
  '/admin/config',
  requireAuth,
  requireRoles('admin'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = UpdateConfigSchema.parse(req.body);
    const existing = await ConfigEntryModel.findOne({ key: parsed.key }).lean();

    const updated = await ConfigEntryModel.findOneAndUpdate(
      { key: parsed.key },
      {
        $set: {
          value: parsed.value,
          updatedBy: new mongoose.Types.ObjectId(req.user!.sub),
        },
      },
      { upsert: true, new: true },
    );

    await recordAdminAuditLog({
      actorId: req.user!.sub,
      action: `config.update.${parsed.key}`,
      entityType: 'ConfigEntry',
      entityId: parsed.key,
      before: { value: existing?.value ?? null },
      after: { value: parsed.value },
      ip: req.ip,
    });

    res.json({ configEntry: updated });
  }),
);

adminRouter.get(
  '/admin/audit-logs',
  requireAuth,
  requireRoles('moderator', 'admin'),
  asyncHandler(async (_req, res) => {
    const logs = await AuditLogModel.find()
      .sort({ createdAt: -1 })
      .limit(100)
      .populate('actorId', 'displayName phone roles')
      .lean();

    res.json({ logs });
  }),
);

