import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { Router, type IRouter } from 'express';
import { z } from 'zod';
import { DEFAULT_PLATFORM_CONFIG } from '@autodey/shared';
import {
  optionalAuth,
  requireAuth,
  type AuthenticatedRequest,
} from '../../middleware/auth.js';
import { AppError, asyncHandler } from '../../middleware/errors.js';
import {
  AuctionModel,
  ConfigEntryModel,
  DealerProfileModel,
  ListingModel,
  PaymentModel,
  PromotionModel,
  SubscriptionModel,
  UserModel,
} from '../../models/index.js';
import { paymentAdapter } from '../../adapters/index.js';

export const commerceRouter: IRouter = Router();

export async function getDynamicCommerceConfig() {
  const [promoEntry, dealerEntry] = await Promise.all([
    ConfigEntryModel.findOne({ key: 'promotions' }).lean(),
    ConfigEntryModel.findOne({ key: 'dealerPlans' }).lean(),
  ]);

  const promotions =
    promoEntry?.value && typeof promoEntry.value === 'object'
      ? (promoEntry.value as typeof DEFAULT_PLATFORM_CONFIG.promotions)
      : DEFAULT_PLATFORM_CONFIG.promotions;

  const dealerPlans =
    dealerEntry?.value && typeof dealerEntry.value === 'object'
      ? (dealerEntry.value as typeof DEFAULT_PLATFORM_CONFIG.dealerPlans)
      : DEFAULT_PLATFORM_CONFIG.dealerPlans;

  return { promotions, dealerPlans };
}

commerceRouter.get(
  '/pricing/config',
  asyncHandler(async (_req, res) => {
    const config = await getDynamicCommerceConfig();
    res.json(config);
  }),
);

const PromotionCheckoutSchema = z.object({
  listingId: z.string().min(1),
  type: z.enum(['top_ad', 'featured', 'urgent', 'bump_up']),
});

/**
 * Promotions checkout (`POST /api/v1/promotions/checkout`):
 * Prices and durations are read dynamically from the admin-editable ConfigEntry collection.
 */
commerceRouter.post(
  '/promotions/checkout',
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = PromotionCheckoutSchema.parse(req.body);
    const userId = req.user!.sub;

    const [listing, user, commerceCfg] = await Promise.all([
      ListingModel.findById(parsed.listingId),
      UserModel.findById(userId).lean(),
      getDynamicCommerceConfig(),
    ]);

    if (!listing) {
      throw AppError.notFound('LISTING_NOT_FOUND', 'Listing not found');
    }
    if (!user) {
      throw AppError.notFound('USER_NOT_FOUND', 'User not found');
    }

    const isAdmin = user.roles.includes('admin') || user.roles.includes('moderator');
    if (String(listing.sellerId) !== String(userId) && !isAdmin) {
      throw AppError.forbidden('FORBIDDEN', 'You can only promote your own listings');
    }

    const tierConfig = commerceCfg.promotions[parsed.type];
    if (!tierConfig) {
      throw AppError.badRequest('INVALID_PROMOTION_TYPE', 'Invalid promotion tier');
    }

    const reference = `ADY_PRM_${parsed.type.toUpperCase()}_${Date.now()}_${crypto
      .randomBytes(3)
      .toString('hex')
      .toUpperCase()}`;

    const initPayment = await paymentAdapter.initializeTransaction({
      email: user.email || `${user.phone.replace('+', '')}@autodey.ng`,
      amountKobo: tierConfig.priceKobo,
      reference,
      metadata: {
        userId,
        listingId: String(listing._id),
        promotionType: parsed.type,
      },
    });

    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + tierConfig.durationDays * 24 * 3600 * 1000,
    );

    const payment = await PaymentModel.create({
      userId: user._id,
      reference,
      idempotencyKey: `promo:${String(listing._id)}:${parsed.type}:${Date.now()}`,
      purpose: 'promotion',
      amountKobo: tierConfig.priceKobo,
      status: 'success',
      provider: initPayment.provider,
      paidAt: now,
    });

    const promotion = await PromotionModel.create({
      listingId: listing._id,
      sellerId: listing.sellerId,
      paymentId: payment._id,
      type: parsed.type,
      priceKobo: tierConfig.priceKobo,
      startsAt: now,
      expiresAt,
      active: true,
    });

    if (parsed.type === 'top_ad') {
      listing.promotion.topAdUntil = expiresAt;
    } else if (parsed.type === 'featured') {
      listing.promotion.featuredUntil = expiresAt;
    } else if (parsed.type === 'urgent') {
      listing.promotion.urgentUntil = expiresAt;
    } else if (parsed.type === 'bump_up') {
      listing.promotion.bumpedAt = now;
    }

    await listing.save();

    res.status(201).json({
      promotion,
      payment,
      listingPromotion: listing.promotion,
      authorizationUrl: initPayment.authorizationUrl,
    });
  }),
);

const DealerSubscribeSchema = z.object({
  planTier: z.enum(['starter', 'pro', 'premier']),
  businessName: z.string().min(2).max(120).optional(),
  cacNumber: z.string().min(3).max(40).optional(),
  address: z.string().min(3).max(200).optional(),
  state: z.string().min(2).max(60).optional(),
  lga: z.string().min(2).max(60).optional(),
  openingHours: z.string().min(2).max(120).optional(),
});

/**
 * Monthly Dealer Plan Subscription (`POST /api/v1/dealers/subscribe`):
 * Unlocks higher listing limits and verified dealer storefront features.
 */
commerceRouter.post(
  '/dealers/subscribe',
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = DealerSubscribeSchema.parse(req.body);
    const userId = req.user!.sub;

    const [user, existingProfile, commerceCfg] = await Promise.all([
      UserModel.findById(userId),
      DealerProfileModel.findOne({ userId }),
      getDynamicCommerceConfig(),
    ]);

    if (!user) {
      throw AppError.notFound('USER_NOT_FOUND', 'User not found');
    }

    let dealerProfile = existingProfile;
    if (!dealerProfile) {
      const bizName = parsed.businessName || `${user.displayName} Motors`;
      const slugBase = bizName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      dealerProfile = await DealerProfileModel.create({
        userId: user._id,
        slug: `${slugBase}-${Date.now().toString(36)}`,
        businessName: bizName,
        cacNumber: parsed.cacNumber || 'RC-PENDING',
        address: parsed.address || 'Lagos, Nigeria',
        state: parsed.state || user.state || 'Lagos',
        lga: parsed.lga || user.lga || 'Ikeja',
        openingHours: parsed.openingHours || 'Mon–Sat: 8:00 AM – 6:00 PM',
        status: 'pending',
        planTier: parsed.planTier,
        listingLimit: commerceCfg.dealerPlans[parsed.planTier].listingLimit,
      });
    } else if (parsed.businessName) {
      dealerProfile.businessName = parsed.businessName;
      if (parsed.cacNumber) dealerProfile.cacNumber = parsed.cacNumber;
      if (parsed.address) dealerProfile.address = parsed.address;
      if (parsed.state) dealerProfile.state = parsed.state;
      if (parsed.lga) dealerProfile.lga = parsed.lga;
      if (parsed.openingHours) dealerProfile.openingHours = parsed.openingHours;
    }

    const planCfg = commerceCfg.dealerPlans[parsed.planTier];
    const now = new Date();
    const periodEnd = new Date(now.getTime() + 30 * 24 * 3600 * 1000);
    const reference = `ADY_DLR_${parsed.planTier.toUpperCase()}_${Date.now()}_${crypto
      .randomBytes(3)
      .toString('hex')
      .toUpperCase()}`;

    await PaymentModel.create({
      userId: user._id,
      reference,
      idempotencyKey: `dealer-sub:${userId}:${parsed.planTier}:${Date.now()}`,
      purpose: 'dealer_subscription',
      amountKobo: planCfg.monthlyPriceKobo,
      status: 'success',
      provider: 'mock',
      paidAt: now,
    });

    const subscription = await SubscriptionModel.create({
      dealerId: dealerProfile._id,
      userId: user._id,
      planTier: parsed.planTier,
      priceKobo: planCfg.monthlyPriceKobo,
      status: 'active',
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
    });

    dealerProfile.planTier = parsed.planTier;
    dealerProfile.listingLimit = planCfg.listingLimit;
    await dealerProfile.save();

    res.status(201).json({
      subscription,
      dealerProfile,
    });
  }),
);

/**
 * Public list of Verified Dealers (`GET /api/v1/dealers`).
 */
commerceRouter.get(
  '/dealers',
  asyncHandler(async (_req, res) => {
    const dealers = await DealerProfileModel.find({ status: 'approved' })
      .sort({ createdAt: -1 })
      .lean();

    res.json({ dealers });
  }),
);

/**
 * Public Dealer Storefront (`GET /api/v1/dealers/:slug`):
 * Returns dealer profile, banner/logo, map coordinates, opening hours, active inventory, and lead analytics.
 */
commerceRouter.get(
  '/dealers/:slug',
  optionalAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const slugOrId = String(req.params.slug);
    const dealer = mongoose.isValidObjectId(slugOrId)
      ? await DealerProfileModel.findById(slugOrId).lean()
      : await DealerProfileModel.findOne({ slug: slugOrId }).lean();

    if (!dealer) {
      throw AppError.notFound('DEALER_NOT_FOUND', 'Dealer storefront not found');
    }

    const [sellerUser, inventory, liveAuctions] = await Promise.all([
      UserModel.findById(dealer.userId)
        .select('displayName avatarUrl bio verification ratingStats responseStats createdAt')
        .lean(),
      ListingModel.find({
        sellerId: dealer.userId,
        status: 'active',
      })
        .sort({ 'promotion.topAdUntil': -1, createdAt: -1 })
        .limit(60)
        .lean(),
      AuctionModel.find({
        sellerId: dealer.userId,
        status: 'live',
      })
        .sort({ endsAt: 1 })
        .lean(),
    ]);

    const leadStats = inventory.reduce(
      (acc, item) => {
        acc.totalViews += item.stats?.views ?? 0;
        acc.totalPhoneReveals += item.stats?.phoneReveals ?? 0;
        acc.totalChatStarts += item.stats?.chatStarts ?? 0;
        acc.totalFavorites += item.stats?.favoritesCount ?? 0;
        return acc;
      },
      {
        totalViews: 0,
        totalPhoneReveals: 0,
        totalChatStarts: 0,
        totalFavorites: 0,
      },
    );

    res.json({
      dealer,
      seller: sellerUser,
      inventoryCount: inventory.length,
      inventory,
      liveAuctionsCount: liveAuctions.length,
      leadStats,
    });
  }),
);

