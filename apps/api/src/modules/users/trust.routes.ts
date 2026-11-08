import mongoose from 'mongoose';
import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import {
  BRAND_CONFIG,
  DEFAULT_PLATFORM_CONFIG,
  formatKobo,
} from '@autodey/shared';
import { requireAuth } from '../../middleware/auth.js';
import { AppError, validateBody } from '../../middleware/errors.js';
import { rateLimit } from '../../middleware/rateLimit.js';
import {
  ConversationModel,
  ListingModel,
  ReportModel,
  ReviewModel,
  SettlementModel,
  UserModel,
} from '../../models/index.js';

export const trustRouter = Router();

const CreateReviewSchema = z.object({
  sellerId: z.string().min(1),
  listingId: z.string().min(1),
  interactionType: z.enum(['chat', 'auction']).default('chat'),
  interactionRefId: z.string().optional(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().min(5).max(1000),
});

const CreateReportSchema = z.object({
  targetType: z.enum(['listing', 'user', 'message']),
  targetId: z.string().min(1),
  reason: z.enum([
    'scam_or_advance_fee',
    'fake_customs_documents',
    'cloned_vin_or_odometer',
    'wrong_price_or_bait',
    'harassment_or_spam',
    'other',
  ]),
  details: z.string().max(1000).optional(),
});

// ============================================================================
// RATE-LIMITED PHONE REVEAL (Increments Seller Analytics)
// ============================================================================
trustRouter.post(
  '/listings/:id/reveal-phone',
  requireAuth,
  rateLimit({ prefix: 'phone-reveal', maxRequests: 15, windowSeconds: 600 }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const listingId = req.params.id ?? '';
      if (!mongoose.isValidObjectId(listingId)) {
        throw AppError.badRequest('INVALID_LISTING_ID', 'Invalid listing ID.');
      }

      const listing = await ListingModel.findByIdAndUpdate(
        listingId,
        { $inc: { 'stats.phoneReveals': 1 } },
        { new: true },
      ).lean();

      if (!listing) {
        throw AppError.notFound('LISTING_NOT_FOUND', 'Vehicle listing not found.');
      }

      const seller = await UserModel.findById(listing.sellerId).lean();
      if (!seller) {
        throw AppError.notFound('SELLER_NOT_FOUND', 'Seller not found.');
      }

      const cleanDigits = (seller.whatsappNumber || seller.phone).replace(/\D/g, '');
      const waText = encodeURIComponent(
        `Hello ${seller.displayName}, I am interested in your ${listing.title} (${formatKobo(
          listing.priceKobo,
        )}) on ${BRAND_CONFIG.name}. Is it available for inspection?`,
      );

      res.status(200).json({
        phone: seller.phone,
        whatsappUrl: `https://wa.me/${cleanDigits}?text=${waText}`,
        phoneRevealsCount: listing.stats.phoneReveals,
        safetyReminder:
          'Never send inspection fees, transport fare, or deposits before physically inspecting the car and papers.',
      });
    } catch (err) {
      next(err);
    }
  },
);

// ============================================================================
// SELLER DASHBOARD & ANALYTICS (Views, Phone Reveals, Chat Starts, Favorites)
// ============================================================================
trustRouter.get(
  '/seller/dashboard',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sellerId = req.user!.sub;
      const listings = await ListingModel.find({
        sellerId,
        status: { $ne: 'removed' },
      })
        .sort({ createdAt: -1 })
        .populate('auctionId')
        .lean();

      const totals = listings.reduce(
        (acc, item) => {
          acc.views += item.stats?.views ?? 0;
          acc.phoneReveals += item.stats?.phoneReveals ?? 0;
          acc.chatStarts += item.stats?.chatStarts ?? 0;
          acc.favoritesCount += item.stats?.favoritesCount ?? 0;
          if (item.status === 'active') acc.activeCount += 1;
          if (item.status === 'sold') acc.soldCount += 1;
          return acc;
        },
        {
          views: 0,
          phoneReveals: 0,
          chatStarts: 0,
          favoritesCount: 0,
          activeCount: 0,
          soldCount: 0,
        },
      );

      res.status(200).json({
        summary: totals,
        listings: listings.map((l) => ({
          id: l._id.toString(),
          slug: l.slug,
          title: l.title,
          year: l.year,
          make: l.make,
          model: l.model,
          state: l.state,
          lga: l.lga,
          priceKobo: l.priceKobo,
          negotiable: l.negotiable,
          status: l.status,
          moderationFlags: l.moderationFlags,
          coverPhotoUrl: l.coverPhotoUrl,
          badges: l.badges,
          stats: l.stats,
          isAuction: l.isAuction,
          expiresAt: l.expiresAt.toISOString(),
          createdAt: l.createdAt.toISOString(),
        })),
      });
    } catch (err) {
      next(err);
    }
  },
);

// ============================================================================
// VERIFIED BUYER REVIEWS (Only Users Who Chatted or Completed an Auction)
// ============================================================================
trustRouter.post(
  '/reviews',
  requireAuth,
  validateBody(CreateReviewSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const reviewerId = req.user!.sub;
      const { sellerId, listingId, interactionType, interactionRefId, rating, comment } =
        req.body as z.infer<typeof CreateReviewSchema>;

      if (reviewerId === sellerId) {
        throw AppError.badRequest('SELF_REVIEW_FORBIDDEN', 'You cannot review your own account.');
      }

      let verifiedRefId: mongoose.Types.ObjectId | null = null;

      if (interactionType === 'chat') {
        const conv = await ConversationModel.findOne({
          buyerId: reviewerId,
          sellerId,
          ...(interactionRefId && mongoose.isValidObjectId(interactionRefId)
            ? { _id: interactionRefId }
            : {}),
        }).lean();

        if (!conv) {
          throw AppError.forbidden(
            'INTERACTION_REQUIRED',
            'Only buyers who have chatted with this seller or completed an auction can leave a review.',
          );
        }
        verifiedRefId = conv._id;
      } else {
        const settlement = await SettlementModel.findOne({
          winnerId: reviewerId,
          sellerId,
        }).lean();

        if (!settlement) {
          throw AppError.forbidden(
            'AUCTION_INTERACTION_REQUIRED',
            'Only verified auction winners can leave an auction settlement review.',
          );
        }
        verifiedRefId = settlement._id;
      }

      const existingReview = await ReviewModel.findOne({
        reviewerId,
        interactionType,
        interactionRefId: verifiedRefId,
      }).lean();

      if (existingReview) {
        throw AppError.conflict(
          'DUPLICATE_REVIEW',
          'You have already submitted a review for this interaction.',
        );
      }

      const review = await ReviewModel.create({
        reviewerId,
        sellerId,
        listingId,
        interactionType,
        interactionRefId: verifiedRefId,
        rating,
        comment,
      });

      // Recompute seller rating stats
      const allSellerReviews = await ReviewModel.find({ sellerId }).select('rating').lean();
      const count = allSellerReviews.length;
      const sum = allSellerReviews.reduce((acc, r) => acc + r.rating, 0);
      const avg = count > 0 ? Number((sum / count).toFixed(2)) : rating;

      await UserModel.findByIdAndUpdate(sellerId, {
        $set: {
          'ratingStats.avg': avg,
          'ratingStats.count': count,
        },
      });

      res.status(201).json({
        message: 'Verified review published.',
        review: {
          id: review._id.toString(),
          rating: review.rating,
          comment: review.comment,
          interactionType: review.interactionType,
          createdAt: review.createdAt.toISOString(),
        },
        sellerRatingStats: { avg, count },
      });
    } catch (err) {
      next(err);
    }
  },
);

// ============================================================================
// REPORT LISTING / USER (Auto-Hides Listing After N Unique Reports)
// ============================================================================
trustRouter.post(
  '/reports',
  requireAuth,
  validateBody(CreateReportSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const reporterId = req.user!.sub;
      const { targetType, targetId, reason, details } = req.body as z.infer<
        typeof CreateReportSchema
      >;

      if (!mongoose.isValidObjectId(targetId)) {
        throw AppError.badRequest('INVALID_TARGET_ID', 'Invalid target ID.');
      }

      const existing = await ReportModel.findOne({
        reporterId,
        targetType,
        targetId,
      }).lean();

      if (existing) {
        throw AppError.conflict(
          'ALREADY_REPORTED',
          'You have already submitted a report for this item.',
        );
      }

      const report = await ReportModel.create({
        reporterId,
        targetType,
        targetId,
        reason,
        details,
        status: 'pending',
      });

      let autoHidden = false;
      if (targetType === 'listing') {
        const uniqueReportsCount = await ReportModel.countDocuments({
          targetType: 'listing',
          targetId,
        });

        const updatePayload: Record<string, unknown> = {
          $set: { reportsCount: uniqueReportsCount },
        };

        if (uniqueReportsCount >= DEFAULT_PLATFORM_CONFIG.autoHideReportsThreshold) {
          autoHidden = true;
          updatePayload.$set = {
            reportsCount: uniqueReportsCount,
            status: 'pending_review',
          };
          updatePayload.$addToSet = {
            moderationFlags: 'AUTO_HIDDEN_REPORTS_THRESHOLD',
          };
        }

        await ListingModel.findByIdAndUpdate(targetId, updatePayload);
      }

      res.status(201).json({
        message: autoHidden
          ? 'Report received. Listing has been automatically hidden pending moderator review.'
          : 'Report submitted to our moderation team.',
        reportId: report._id.toString(),
        autoHidden,
      });
    } catch (err) {
      next(err);
    }
  },
);

