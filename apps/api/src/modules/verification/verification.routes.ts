import mongoose from 'mongoose';
import { Router, type IRouter } from 'express';
import { z } from 'zod';
import { formatKobo, validateVinFormat } from '@autodey/shared';
import {
  requireAuth,
  requireRoles,
  type AuthenticatedRequest,
} from '../../middleware/auth.js';
import { AppError, asyncHandler } from '../../middleware/errors.js';
import {
  AuctionModel,
  ListingModel,
  SavedSearchModel,
  UserModel,
  VehicleDocumentModel,
  type IListing,
} from '../../models/index.js';
import { customsVerificationAdapter, vinAdapter } from '../../adapters/index.js';
import { computeFairPriceInsight } from '../listings/moderation.service.js';
import { dispatchNotification } from '../notifications/notifications.service.js';

export const verificationRouter: IRouter = Router();

const DecodeVinSchema = z.object({
  vin: z.string().min(11).max(20),
  make: z.string().optional(),
  model: z.string().optional(),
  year: z.number().int().optional(),
  excludeListingId: z.string().optional(),
});

/**
 * Decodes a 17-character VIN via NHTSA vPIC / MockVinAdapter, validates ISO 3779 check digit,
 * checks for duplicate active VINs across listings, and flags make/model/year mismatches.
 */
verificationRouter.post(
  '/vehicles/decode-vin',
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = DecodeVinSchema.parse(req.body);
    const vinValidation = validateVinFormat(parsed.vin);

    if (!vinValidation.valid) {
      throw AppError.badRequest(
        'INVALID_VIN_FORMAT',
        vinValidation.reason || 'VIN must be 17 characters (excluding I, O, Q)',
      );
    }

    const dupFilter: Record<string, unknown> = {
      vin: vinValidation.normalized,
      status: { $in: ['active', 'pending_review'] },
    };
    if (parsed.excludeListingId && mongoose.isValidObjectId(parsed.excludeListingId)) {
      dupFilter._id = { $ne: new mongoose.Types.ObjectId(parsed.excludeListingId) };
    }

    const duplicateListing = await ListingModel.findOne(dupFilter)
      .select('_id title slug sellerId')
      .lean();

    const comparison = await vinAdapter.compareWithListing(vinValidation.normalized, {
      make: parsed.make,
      model: parsed.model,
      year: parsed.year,
    });

    res.json({
      vin: vinValidation.normalized,
      validFormat: vinValidation.valid,
      checkDigitValid: vinValidation.checkDigitValid,
      duplicateActiveListing: duplicateListing
        ? {
            id: String(duplicateListing._id),
            title: duplicateListing.title,
            slug: duplicateListing.slug,
          }
        : null,
      decoded: comparison.decoded,
      mismatchFlag: comparison.mismatchFlag,
      mismatchReasons: comparison.mismatchReasons,
    });
  }),
);

/**
 * Attaches and verifies a VIN on an existing listing (`POST /api/v1/listings/:id/verify-vin`).
 * Blocks duplicate active VINs across listings and flags make/model/year mismatches to moderators.
 */
verificationRouter.post(
  '/listings/:id/verify-vin',
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { vin } = z.object({ vin: z.string().min(17).max(17) }).parse(req.body);
    const listingId = String(req.params.id);
    const listing = await ListingModel.findById(listingId);

    if (!listing) {
      throw AppError.notFound('LISTING_NOT_FOUND', 'Listing not found');
    }

    const isOwner = String(listing.sellerId) === String(req.user!.sub);
    const isMod =
      req.user!.roles.includes('admin') || req.user!.roles.includes('moderator');
    if (!isOwner && !isMod) {
      throw AppError.forbidden('FORBIDDEN', 'Only the seller or a moderator can verify the VIN');
    }

    const vinValidation = validateVinFormat(vin);
    if (!vinValidation.valid) {
      throw AppError.badRequest(
        'INVALID_VIN_FORMAT',
        vinValidation.reason || 'Invalid 17-character VIN format',
      );
    }

    // Check duplicate active VIN across other listings
    const dupListing = await ListingModel.findOne({
      _id: { $ne: listing._id },
      vin: vinValidation.normalized,
      status: { $in: ['active', 'pending_review'] },
    }).lean();

    if (dupListing) {
      listing.moderationFlags = Array.from(
        new Set([...listing.moderationFlags, 'DUPLICATE_ACTIVE_VIN']),
      );
      listing.status = 'pending_review';
      await listing.save();

      throw AppError.conflict(
        'DUPLICATE_ACTIVE_VIN',
        'This 17-character VIN is already registered on another active listing. Flagged for moderator review.',
      );
    }

    const comparison = await vinAdapter.compareWithListing(vinValidation.normalized, {
      make: listing.make,
      model: listing.model,
      year: listing.year,
    });

    listing.vin = vinValidation.normalized;
    listing.vinDecoded = {
      make: comparison.decoded.make,
      model: comparison.decoded.model,
      year: comparison.decoded.year,
      mismatchFlag: comparison.mismatchFlag,
    };

    if (comparison.mismatchFlag) {
      listing.badges.vinChecked = false;
      listing.moderationFlags = Array.from(
        new Set([...listing.moderationFlags, 'VIN_DECODE_MISMATCH']),
      );
      listing.status = 'pending_review';
    } else {
      listing.badges.vinChecked = true;
    }

    await listing.save();

    res.json({
      listingId: String(listing._id),
      vin: listing.vin,
      vinDecoded: listing.vinDecoded,
      vinCheckedBadge: listing.badges.vinChecked,
      status: listing.status,
      mismatchFlag: comparison.mismatchFlag,
      mismatchReasons: comparison.mismatchReasons,
    });
  }),
);

const UploadDocumentSchema = z.object({
  type: z.enum(['customs_duty', 'inspection_report']).default('customs_duty'),
  fileUrl: z.string().url(),
  customsReferenceNumber: z.string().max(80).optional(),
  summary: z.string().max(1000).optional(),
});

/**
 * Seller uploads customs duty papers (`customs_duty`) or Admin uploads 200-point inspection report (`inspection_report`).
 */
verificationRouter.post(
  '/listings/:id/documents',
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = UploadDocumentSchema.parse(req.body);
    const listing = await ListingModel.findById(String(req.params.id));

    if (!listing) {
      throw AppError.notFound('LISTING_NOT_FOUND', 'Listing not found');
    }

    const isAdmin =
      req.user!.roles.includes('admin') || req.user!.roles.includes('moderator');
    const isSeller = String(listing.sellerId) === String(req.user!.sub);

    if (parsed.type === 'inspection_report' && !isAdmin) {
      throw AppError.forbidden(
        'ADMIN_ONLY_INSPECTION_REPORT',
        'Only moderators or admins can attach partner inspection reports.',
      );
    }

    if (!isSeller && !isAdmin) {
      throw AppError.forbidden('FORBIDDEN', 'You cannot upload documents for this listing');
    }

    if (parsed.type === 'customs_duty') {
      const adapterRes = await customsVerificationAdapter.submitCustomsDocument({
        listingId: String(listing._id),
        sellerId: String(listing.sellerId),
        fileUrl: parsed.fileUrl,
        customsReferenceNumber: parsed.customsReferenceNumber,
      });

      const doc = await VehicleDocumentModel.create({
        listingId: listing._id,
        sellerId: listing.sellerId,
        type: 'customs_duty',
        fileUrl: parsed.fileUrl,
        customsReferenceNumber: parsed.customsReferenceNumber,
        summary: parsed.summary,
        status: adapterRes.initialStatus,
        adapterReference: adapterRes.adapterReference,
      });

      listing.customsStatus = 'yes';
      listing.badges.customsReviewed = adapterRes.initialStatus === 'approved';
      await listing.save();

      res.status(201).json({
        document: doc,
        customsReviewedBadge: listing.badges.customsReviewed,
        adapterNotes: adapterRes.notes,
      });
      return;
    }

    // Partner inspection report uploaded by Admin
    const doc = await VehicleDocumentModel.create({
      listingId: listing._id,
      sellerId: listing.sellerId,
      type: 'inspection_report',
      fileUrl: parsed.fileUrl,
      summary: parsed.summary ?? '200-Point Partner Mechanical & Body Inspection Passed',
      status: 'approved',
      reviewedBy: new mongoose.Types.ObjectId(req.user!.sub),
      reviewedAt: new Date(),
    });

    listing.badges.inspected = true;
    await listing.save();

    res.status(201).json({
      document: doc,
      inspectedBadge: listing.badges.inspected,
    });
  }),
);

verificationRouter.get(
  '/listings/:id/documents',
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const documents = await VehicleDocumentModel.find({
      listingId: String(req.params.id),
    })
      .sort({ createdAt: -1 })
      .lean();

    res.json({ documents });
  }),
);

const ReviewDocumentSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  rejectionReason: z.string().max(400).optional(),
});

/**
 * Moderator / Admin review of uploaded customs duty papers or inspection documents.
 */
verificationRouter.patch(
  '/documents/:docId/review',
  requireAuth,
  requireRoles('moderator', 'admin'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = ReviewDocumentSchema.parse(req.body);
    const doc = await VehicleDocumentModel.findById(String(req.params.docId));

    if (!doc) {
      throw AppError.notFound('DOCUMENT_NOT_FOUND', 'Vehicle document not found');
    }

    doc.status = parsed.status;
    doc.reviewedBy = new mongoose.Types.ObjectId(req.user!.sub);
    doc.reviewedAt = new Date();
    doc.rejectionReason = parsed.rejectionReason;
    await doc.save();

    const listing = await ListingModel.findById(doc.listingId);
    if (listing) {
      if (doc.type === 'customs_duty') {
        listing.badges.customsReviewed = parsed.status === 'approved';
      } else if (doc.type === 'inspection_report') {
        listing.badges.inspected = parsed.status === 'approved';
      }
      await listing.save();
    }

    res.json({
      document: doc,
      listingBadges: listing?.badges ?? null,
    });
  }),
);

// ============================================================================
// SAVED SEARCHES WITH ALERTS
// ============================================================================
const CreateSavedSearchSchema = z.object({
  name: z.string().min(2).max(100),
  filters: z.object({
    q: z.string().optional(),
    make: z.string().optional(),
    model: z.string().optional(),
    state: z.string().optional(),
    condition: z.enum(['brand_new', 'foreign_used', 'nigerian_used']).optional(),
    minPriceKobo: z.number().int().nonnegative().optional(),
    maxPriceKobo: z.number().int().positive().optional(),
    minYear: z.number().int().optional(),
    maxYear: z.number().int().optional(),
    auctionOnly: z.boolean().optional(),
  }),
  channels: z
    .object({
      inApp: z.boolean().default(true),
      email: z.boolean().default(true),
      sms: z.boolean().default(false),
      push: z.boolean().default(true),
    })
    .optional(),
});

verificationRouter.post(
  '/saved-searches',
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = CreateSavedSearchSchema.parse(req.body);
    const saved = await SavedSearchModel.create({
      userId: new mongoose.Types.ObjectId(req.user!.sub),
      name: parsed.name,
      filters: parsed.filters,
      channels: parsed.channels ?? {
        inApp: true,
        email: true,
        sms: false,
        push: true,
      },
    });

    res.status(201).json({ savedSearch: saved });
  }),
);

verificationRouter.get(
  '/saved-searches',
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const savedSearches = await SavedSearchModel.find({
      userId: req.user!.sub,
    })
      .sort({ createdAt: -1 })
      .lean();

    res.json({ savedSearches });
  }),
);

verificationRouter.delete(
  '/saved-searches/:id',
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const deleted = await SavedSearchModel.findOneAndDelete({
      _id: String(req.params.id),
      userId: req.user!.sub,
    });
    if (!deleted) {
      throw AppError.notFound('SAVED_SEARCH_NOT_FOUND', 'Saved search not found');
    }
    res.json({ deleted: true });
  }),
);

/**
 * Matches a newly activated listing against all SavedSearches and dispatches alerts.
 */
export async function dispatchSavedSearchAlertsForListing(
  listing: IListing,
): Promise<number> {
  const allSaved = await SavedSearchModel.find().lean();
  let matchedCount = 0;

  for (const s of allSaved) {
    if (String(s.userId) === String(listing.sellerId)) continue;
    const f = (s.filters ?? {}) as Record<string, unknown>;

    if (
      typeof f.make === 'string' &&
      f.make &&
      f.make.toLowerCase() !== listing.make.toLowerCase()
    ) {
      continue;
    }
    if (
      typeof f.model === 'string' &&
      f.model &&
      f.model.toLowerCase() !== listing.model.toLowerCase()
    ) {
      continue;
    }
    if (
      typeof f.state === 'string' &&
      f.state &&
      f.state.toLowerCase() !== listing.state.toLowerCase()
    ) {
      continue;
    }
    if (typeof f.condition === 'string' && f.condition && f.condition !== listing.condition) {
      continue;
    }
    if (typeof f.minPriceKobo === 'number' && listing.priceKobo < f.minPriceKobo) {
      continue;
    }
    if (typeof f.maxPriceKobo === 'number' && listing.priceKobo > f.maxPriceKobo) {
      continue;
    }
    if (typeof f.minYear === 'number' && listing.year < f.minYear) {
      continue;
    }
    if (typeof f.maxYear === 'number' && listing.year > f.maxYear) {
      continue;
    }
    if (f.auctionOnly === true && !listing.isAuction) {
      continue;
    }

    matchedCount += 1;
    await SavedSearchModel.updateOne(
      { _id: s._id },
      { $set: { lastNotifiedAt: new Date() } },
    );

    await dispatchNotification({
      userId: String(s.userId),
      type: 'new_message',
      title: `Saved Search Match: ${s.name}`,
      body: `${listing.title} (${formatKobo(listing.priceKobo)}) in ${listing.lga}, ${listing.state} just went live.`,
      actionUrl: `/cars/${listing.state.toLowerCase()}/${listing.slug}`,
    });
  }

  return matchedCount;
}

verificationRouter.post(
  '/saved-searches/trigger/:listingId',
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const listing = await ListingModel.findById(String(req.params.listingId));
    if (!listing) {
      throw AppError.notFound('LISTING_NOT_FOUND', 'Listing not found');
    }
    const matchedCount = await dispatchSavedSearchAlertsForListing(listing);
    res.json({ matchedCount });
  }),
);

// ============================================================================
// 3-CAR SIDE-BY-SIDE COMPARE ENDPOINT
// ============================================================================
verificationRouter.get(
  '/compare',
  asyncHandler(async (req, res) => {
    const rawIds = String(req.query.ids || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 3);

    if (rawIds.length === 0) {
      res.json({ vehicles: [] });
      return;
    }

    const vehicles = await Promise.all(
      rawIds.map(async (idOrSlug) => {
        const listing = mongoose.isValidObjectId(idOrSlug)
          ? await ListingModel.findById(idOrSlug).lean()
          : await ListingModel.findOne({ slug: idOrSlug }).lean();

        if (!listing) return null;

        const [seller, fairPrice, auction] = await Promise.all([
          UserModel.findById(listing.sellerId)
            .select('displayName verification ratingStats responseStats')
            .lean(),
          computeFairPriceInsight({
            make: listing.make,
            model: listing.model,
            year: listing.year,
            priceKobo: listing.priceKobo,
            excludeListingId: String(listing._id),
          }),
          listing.auctionId
            ? AuctionModel.findById(listing.auctionId)
                .select('status currentPrice bidCount endsAt reserveMet')
                .lean()
            : Promise.resolve(null),
        ]);

        return {
          id: String(listing._id),
          slug: listing.slug,
          title: listing.title,
          make: listing.make,
          model: listing.model,
          trim: listing.trim,
          year: listing.year,
          condition: listing.condition,
          mileageKm: listing.mileageKm,
          transmission: listing.transmission,
          fuelType: listing.fuelType,
          bodyType: listing.bodyType,
          driveSide: listing.driveSide,
          engineSize: listing.engineSize,
          exteriorColor: listing.exteriorColor,
          interiorColor: listing.interiorColor,
          ownersCount: listing.ownersCount,
          accidentHistory: listing.accidentHistory,
          customsStatus: listing.customsStatus,
          vin: listing.vin,
          state: listing.state,
          lga: listing.lga,
          priceKobo: listing.priceKobo,
          negotiable: listing.negotiable,
          swapAccepted: listing.swapAccepted,
          features: listing.features,
          coverPhotoUrl: listing.coverPhotoUrl,
          badges: listing.badges,
          fairPrice,
          seller: seller
            ? {
                id: String(seller._id),
                displayName: seller.displayName,
                verification: seller.verification,
                ratingAvg: seller.ratingStats?.avg ?? 0,
                ratingCount: seller.ratingStats?.count ?? 0,
                responseRatePercent: seller.responseStats?.ratePercent ?? 95,
              }
            : null,
          auction: auction
            ? {
                id: String(auction._id),
                status: auction.status,
                currentPriceKobo: auction.currentPrice,
                bidCount: auction.bidCount,
                endsAt: auction.endsAt,
              }
            : null,
        };
      }),
    );

    res.json({
      vehicles: vehicles.filter(Boolean),
    });
  }),
);

