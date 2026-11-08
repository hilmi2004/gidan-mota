import mongoose from 'mongoose';
import { Router, type Request, type Response, type NextFunction } from 'express';
import {
  BRAND_CONFIG,
  CreateListingSchema,
  formatKobo,
  maskBidderName,
  maskPhone,
  validateVinFormat,
} from '@autodey/shared';
import { mediaAdapter } from '../../adapters/index.js';
import { optionalAuth, requireAuth } from '../../middleware/auth.js';
import { AppError, validateBody } from '../../middleware/errors.js';
import { dispatchSavedSearchAlertsForListing } from '../verification/verification.routes.js';
import {
  AuctionModel,
  DealerProfileModel,
  FavoriteModel,
  ListingMediaModel,
  ListingModel,
  UserModel,
  VehicleDocumentModel,
} from '../../models/index.js';
import { computeFairPriceInsight, evaluateListingAutoModeration } from './moderation.service.js';

export const listingsRouter = Router();

function generateListingSlug(year: number, make: string, model: string, state: string): string {
  const base = `${year}-${make}-${model}-${state}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const rand = Math.random().toString(36).slice(2, 7);
  return `${base}-${rand}`;
}

function expandNigerianSynonyms(rawQuery: string): {
  searchTerms: string[];
  inferredCondition?: string;
  inferredMake?: string;
  inferredModel?: string;
  inferredCategory?: string;
} {
  const q = rawQuery.trim().toLowerCase();
  const result: ReturnType<typeof expandNigerianSynonyms> = {
    searchTerms: [rawQuery.trim()],
  };

  if (q.includes('tokunbo') || q.includes('foreign used')) {
    result.inferredCondition = 'foreign_used';
  }
  if (q.includes('naija used') || q.includes('nigerian used')) {
    result.inferredCondition = 'nigerian_used';
  }
  if (q.includes('benz') || q.includes('mercedes')) {
    result.inferredMake = 'Mercedes-Benz';
  }
  if (q.includes('camry muscle') || q.includes('big daddy') || q.includes('spider')) {
    result.inferredMake = 'Toyota';
    result.inferredModel = 'Camry';
  }
  if (q.includes('eod') || q.includes('end of discussion') || q.includes('evil spirit')) {
    result.inferredMake = 'Honda';
    result.inferredModel = 'Accord';
  }
  if (q.includes('okada') || q.includes('boxer') || q.includes('dispatch')) {
    result.inferredCategory = 'motorcycles';
  }
  return result;
}

// ============================================================================
// MEDIA UPLOAD SIGNING (Cloudinary Adapter + Mock Upload)
// ============================================================================
listingsRouter.post('/media/sign', requireAuth, (req: Request, res: Response) => {
  const folder = (req.body?.folder as string) || 'autodey/listings';
  const signed = mediaAdapter.createSignedUpload(folder);
  res.status(200).json(signed);
});

listingsRouter.post('/media/mock-upload', requireAuth, (req: Request, res: Response) => {
  const dataUrl = (req.body?.dataUrl as string) || '';
  const fallbackUrl =
    'https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?w=1000&auto=format&fit=crop&q=80';
  res.status(200).json({
    secure_url: dataUrl.startsWith('http') ? dataUrl : fallbackUrl,
    public_id: `autodey_mock_${Date.now()}`,
    width: 1280,
    height: 960,
  });
});

// ============================================================================
// SEARCH & DISCOVERY (GET /api/v1/listings and /api/v1/search)
// ============================================================================
async function handleSearchListings(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const {
      q,
      category,
      make,
      model,
      yearMin,
      yearMax,
      priceMinKobo,
      priceMaxKobo,
      mileageMaxKm,
      condition,
      transmission,
      fuelType,
      bodyType,
      state,
      lga,
      driveSide,
      verifiedSeller,
      vinChecked,
      customsReviewed,
      auctionOnly,
      featuredOnly,
      hasVideo,
      sellerId,
      sort = 'newest',
      limit = '24',
      cursor,
    } = req.query as Record<string, string | undefined>;

    const query: Record<string, unknown> = {
      status: 'active',
    };

    if (sellerId && mongoose.isValidObjectId(sellerId)) {
      query.sellerId = new mongoose.Types.ObjectId(sellerId);
    }

    if (q && q.trim()) {
      const expanded = expandNigerianSynonyms(q);
      if (expanded.inferredCondition && !condition) {
        query.condition = expanded.inferredCondition;
      }
      if (expanded.inferredCategory && !category) {
        query.category = expanded.inferredCategory;
      }
      const regex = new RegExp(q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      const orClauses: Record<string, unknown>[] = [
        { title: regex },
        { make: regex },
        { model: regex },
        { trim: regex },
        { description: regex },
        { state: regex },
        { lga: regex },
      ];
      if (expanded.inferredMake) {
        orClauses.push({ make: new RegExp(expanded.inferredMake, 'i') });
      }
      if (expanded.inferredModel) {
        orClauses.push({ model: new RegExp(expanded.inferredModel, 'i') });
      }
      query.$or = orClauses;
    }

    if (category && category !== 'all') query.category = category;
    if (make && make !== 'All') {
      query.make = new RegExp(`^${make.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
    }
    if (model && model !== 'All') {
      query.model = new RegExp(`^${model.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
    }
    if (condition && condition !== 'all') query.condition = condition;
    if (transmission && transmission !== 'all') query.transmission = transmission;
    if (fuelType && fuelType !== 'all') query.fuelType = fuelType;
    if (bodyType && bodyType !== 'all') query.bodyType = bodyType;
    if (driveSide && driveSide !== 'all') query.driveSide = driveSide;
    if (state && state !== 'All') query.state = state;
    if (lga && lga !== 'All') query.lga = lga;

    if (yearMin || yearMax) {
      const yearCond: Record<string, number> = {};
      if (yearMin) yearCond.$gte = Number(yearMin);
      if (yearMax) yearCond.$lte = Number(yearMax);
      query.year = yearCond;
    }

    if (priceMinKobo || priceMaxKobo) {
      const priceCond: Record<string, number> = {};
      if (priceMinKobo) priceCond.$gte = Number(priceMinKobo);
      if (priceMaxKobo) priceCond.$lte = Number(priceMaxKobo);
      query.priceKobo = priceCond;
    }

    if (mileageMaxKm) {
      query.mileageKm = { $lte: Number(mileageMaxKm) };
    }

    if (vinChecked === 'true') {
      query['badges.vinChecked'] = true;
    }
    if (customsReviewed === 'true') {
      query['badges.customsReviewed'] = true;
    }
    if (auctionOnly === 'true') {
      query.isAuction = true;
    }
    if (featuredOnly === 'true') {
      query['promotion.featuredUntil'] = { $gt: new Date() };
    }
    if (hasVideo === 'true') {
      query.videoUrl = { $exists: true, $ne: '' };
    }

    if (verifiedSeller === 'true') {
      const verifiedUsers = await UserModel.find({
        $or: [{ 'verification.idVerified': true }, { 'verification.dealerVerified': true }],
      })
        .select('_id')
        .lean();
      query.sellerId = { $in: verifiedUsers.map((u) => u._id) };
    }

    if (cursor && mongoose.isValidObjectId(cursor)) {
      query._id = { $lt: new mongoose.Types.ObjectId(cursor) };
    }

    let sortSpec: Record<string, 1 | -1> = {
      'promotion.topAdUntil': -1,
      'promotion.bumpedAt': -1,
      createdAt: -1,
    };
    if (sort === 'price_asc') sortSpec = { priceKobo: 1, createdAt: -1 };
    if (sort === 'price_desc') sortSpec = { priceKobo: -1, createdAt: -1 };
    if (sort === 'mileage_asc') sortSpec = { mileageKm: 1, createdAt: -1 };
    if (sort === 'year_desc') sortSpec = { year: -1, createdAt: -1 };
    if (sort === 'views_desc') sortSpec = { 'stats.views': -1, createdAt: -1 };

    const pageSize = Math.min(Math.max(Number(limit) || 24, 1), 60);

    const [totalCount, docs] = await Promise.all([
      ListingModel.countDocuments(query),
      ListingModel.find(query)
        .sort(sortSpec)
        .limit(pageSize)
        .populate('sellerId', 'displayName avatarUrl verification responseStats state lga')
        .populate('auctionId')
        .lean(),
    ]);

    let favoriteSet = new Set<string>();
    if (req.user) {
      const favs = await FavoriteModel.find({
        userId: req.user.sub,
        listingId: { $in: docs.map((d) => d._id) },
      }).lean();
      favoriteSet = new Set(favs.map((f) => f.listingId.toString()));
    }

    const items = docs.map((doc) => {
      const seller =
        doc.sellerId && typeof doc.sellerId === 'object' && 'displayName' in doc.sellerId
          ? (doc.sellerId as unknown as {
              _id: mongoose.Types.ObjectId;
              displayName: string;
              avatarUrl?: string;
              verification: {
                phoneVerified: boolean;
                idVerified: boolean;
                dealerVerified: boolean;
              };
              responseStats: { ratePercent: number; avgResponseMinutes: number };
            })
          : null;

      const auction =
        doc.auctionId && typeof doc.auctionId === 'object' && 'currentPrice' in doc.auctionId
          ? (doc.auctionId as unknown as {
              _id: mongoose.Types.ObjectId;
              status: string;
              startPrice: number;
              currentPrice: number;
              reservePrice?: number | null;
              reserveMet: boolean;
              buyNowPrice?: number | null;
              endsAt: Date;
              bidCount: number;
            })
          : null;

      return {
        id: doc._id.toString(),
        slug: doc.slug,
        title: doc.title,
        category: doc.category,
        make: doc.make,
        model: doc.model,
        trim: doc.trim,
        year: doc.year,
        condition: doc.condition,
        mileageKm: doc.mileageKm,
        transmission: doc.transmission,
        fuelType: doc.fuelType,
        bodyType: doc.bodyType,
        driveSide: doc.driveSide,
        exteriorColor: doc.exteriorColor,
        state: doc.state,
        lga: doc.lga,
        priceKobo: doc.priceKobo,
        negotiable: doc.negotiable,
        swapAccepted: doc.swapAccepted,
        coverPhotoUrl: doc.coverPhotoUrl,
        badges: doc.badges,
        promotion: {
          isTopAd: Boolean(doc.promotion?.topAdUntil && new Date(doc.promotion.topAdUntil) > new Date()),
          isFeatured: Boolean(
            doc.promotion?.featuredUntil && new Date(doc.promotion.featuredUntil) > new Date(),
          ),
          isUrgent: Boolean(
            doc.promotion?.urgentUntil && new Date(doc.promotion.urgentUntil) > new Date(),
          ),
        },
        stats: doc.stats,
        isAuction: doc.isAuction,
        isFavorited: favoriteSet.has(doc._id.toString()),
        createdAt: doc.createdAt.toISOString(),
        seller: seller
          ? {
              id: seller._id.toString(),
              displayName: seller.displayName,
              avatarUrl: seller.avatarUrl,
              badges: seller.verification,
              responseRatePercent: seller.responseStats?.ratePercent ?? 95,
            }
          : null,
        auction: auction
          ? {
              id: auction._id.toString(),
              status: auction.status,
              startPriceKobo: auction.startPrice,
              currentPriceKobo: auction.currentPrice,
              buyNowPriceKobo: auction.buyNowPrice ?? null,
              reserveStatus: !auction.reservePrice
                ? 'no_reserve'
                : auction.reserveMet
                  ? 'reserve_met'
                  : 'reserve_not_met',
              endsAt: new Date(auction.endsAt).toISOString(),
              bidCount: auction.bidCount,
            }
          : null,
      };
    });

    if (sort === 'ending_soonest') {
      items.sort((a, b) => {
        const aEnd = a.auction ? new Date(a.auction.endsAt).getTime() : Number.MAX_SAFE_INTEGER;
        const bEnd = b.auction ? new Date(b.auction.endsAt).getTime() : Number.MAX_SAFE_INTEGER;
        return aEnd - bEnd;
      });
    }

    const nextCursor = docs.length === pageSize ? docs[docs.length - 1]?._id.toString() : null;

    res.status(200).json({
      items,
      totalCount,
      nextCursor,
      serverTimeMs: Date.now(),
    });
  } catch (err) {
    next(err);
  }
}

listingsRouter.get('/listings', optionalAuth, handleSearchListings);
listingsRouter.get('/search', optionalAuth, handleSearchListings);

// ============================================================================
// CREATE LISTING (4-Step Wizard + Auto-Moderation + VIN Duplicate Check)
// ============================================================================
listingsRouter.post(
  '/listings',
  requireAuth,
  validateBody(CreateListingSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sellerId = req.user!.sub;
      const body = req.body;

      // Minimum 6 photos for published cars/suvs
      if (
        !body.isDraft &&
        (body.category === 'cars' || body.category === 'suvs') &&
        body.photos.length < 6
      ) {
        throw AppError.badRequest(
          'MIN_PHOTOS_REQUIRED',
          'Published car listings require at least 6 photos covering the guided angles.',
        );
      }

      // Check duplicate active VIN immediately so seller gets clear feedback
      let normalizedVin: string | undefined;
      if (body.vin && body.vin.trim()) {
        const vinValidation = validateVinFormat(body.vin);
        if (!vinValidation.valid) {
          throw AppError.badRequest(
            'INVALID_VIN',
            vinValidation.reason || 'VIN must be 17 valid characters.',
          );
        }
        normalizedVin = vinValidation.normalized;
        const duplicateVinListing = await ListingModel.findOne({
          vin: normalizedVin,
          status: { $in: ['pending_review', 'active'] },
        }).lean();

        if (duplicateVinListing) {
          throw AppError.conflict(
            'DUPLICATE_ACTIVE_VIN',
            'A live or pending listing with this 17-character VIN already exists on the platform.',
          );
        }
      }

      const modResult = body.isDraft
        ? {
            approvedAutomatically: false,
            status: 'draft' as const,
            flags: [],
            vinChecked: Boolean(normalizedVin),
          }
        : await evaluateListingAutoModeration({
            sellerId,
            make: body.make,
            model: body.model,
            year: body.year,
            priceKobo: body.priceKobo,
            description: body.description,
            vin: normalizedVin,
            perceptualHashes: body.photos
              .map((p: { perceptualHash?: string }) => p.perceptualHash)
              .filter(Boolean),
          });

      const sortedPhotos = [...body.photos].sort(
        (a: { order: number }, b: { order: number }) => a.order - b.order,
      );
      const coverPhotoUrl = sortedPhotos[0]?.url;
      const title = `${body.year} ${body.make} ${body.model}${body.trim ? ` ${body.trim}` : ''}`;
      const slug = generateListingSlug(body.year, body.make, body.model, body.state);

      const listing = await ListingModel.create({
        sellerId,
        slug,
        title,
        category: body.category,
        make: body.make,
        model: body.model,
        trim: body.trim,
        year: body.year,
        condition: body.condition,
        mileageKm: body.mileageKm,
        transmission: body.transmission,
        fuelType: body.fuelType,
        bodyType: body.bodyType,
        driveSide: body.driveSide,
        engineSize: body.engineSize,
        exteriorColor: body.exteriorColor,
        interiorColor: body.interiorColor,
        ownersCount: body.ownersCount,
        state: body.state,
        lga: body.lga,
        ...(normalizedVin ? { vin: normalizedVin } : {}),
        customsStatus: body.customsStatus,
        accidentHistory: body.accidentHistory,
        priceKobo: body.priceKobo,
        negotiable: body.negotiable,
        swapAccepted: body.swapAccepted,
        description: body.description,
        features: body.features,
        videoUrl: body.videoUrl || undefined,
        coverPhotoUrl,
        badges: {
          vinChecked: modResult.vinChecked,
          customsReviewed: false,
          inspected: false,
        },
        status: body.isDraft ? 'draft' : modResult.status,
        moderationFlags: modResult.flags,
        draftExpiresAt: body.isDraft
          ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          : null,
      });

      await ListingMediaModel.insertMany(
        sortedPhotos.map(
          (
            p: { url: string; angle: string; order: number; perceptualHash?: string },
            idx: number,
          ) => ({
            listingId: listing._id,
            sellerId,
            url: p.url,
            angle: p.angle,
            order: idx,
            perceptualHash: p.perceptualHash,
          }),
        ),
      );

      if (listing.status === 'active') {
        void dispatchSavedSearchAlertsForListing(listing);
      }

      res.status(201).json({
        message: body.isDraft
          ? 'Draft saved. You can resume anytime.'
          : modResult.approvedAutomatically
            ? 'Listing is live!'
            : 'Listing submitted and queued for quick moderator review.',
        listing: {
          id: listing._id.toString(),
          slug: listing.slug,
          title: listing.title,
          status: listing.status,
          moderationFlags: listing.moderationFlags,
          badges: listing.badges,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

// ============================================================================
// LISTING DETAIL PAGE (GET /api/v1/listings/:idOrSlug)
// ============================================================================
listingsRouter.get(
  '/listings/:idOrSlug',
  optionalAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const param = req.params.idOrSlug ?? '';
      const filter = mongoose.isValidObjectId(param)
        ? { $or: [{ _id: param }, { slug: param }] }
        : { slug: param };

      const listing = await ListingModel.findOneAndUpdate(
        filter,
        { $inc: { 'stats.views': 1 } },
        { new: true },
      ).lean();

      if (!listing || listing.status === 'removed') {
        throw AppError.notFound('LISTING_NOT_FOUND', 'Vehicle listing not found.');
      }

      const [
        media,
        documents,
        seller,
        dealerProfile,
        auction,
        fairPriceInsight,
        similarDocs,
        moreFromSellerDocs,
        isFavDoc,
      ] = await Promise.all([
        ListingMediaModel.find({ listingId: listing._id }).sort({ order: 1 }).lean(),
        VehicleDocumentModel.find({ listingId: listing._id, status: 'approved' }).lean(),
        UserModel.findById(listing.sellerId).lean(),
        DealerProfileModel.findOne({ userId: listing.sellerId, status: 'approved' }).lean(),
        listing.auctionId ? AuctionModel.findById(listing.auctionId).lean() : null,
        computeFairPriceInsight({
          make: listing.make,
          model: listing.model,
          year: listing.year,
          priceKobo: listing.priceKobo,
          excludeListingId: listing._id.toString(),
        }),
        ListingModel.find({
          _id: { $ne: listing._id },
          status: 'active',
          $or: [{ make: listing.make, model: listing.model }, { bodyType: listing.bodyType }],
        })
          .limit(4)
          .lean(),
        ListingModel.find({
          _id: { $ne: listing._id },
          sellerId: listing.sellerId,
          status: 'active',
        })
          .limit(4)
          .lean(),
        req.user
          ? FavoriteModel.findOne({ userId: req.user.sub, listingId: listing._id }).lean()
          : null,
      ]);

      let winningBidderMasked: string | undefined;
      if (auction?.leader?.userId) {
        const leaderUser = await UserModel.findById(auction.leader.userId)
          .select('displayName')
          .lean();
        if (leaderUser) {
          winningBidderMasked = maskBidderName(leaderUser.displayName);
        }
      }

      res.status(200).json({
        listing: {
          id: listing._id.toString(),
          slug: listing.slug,
          title: listing.title,
          category: listing.category,
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
          state: listing.state,
          lga: listing.lga,
          vin: listing.vin ? `${listing.vin.slice(0, 11)}******` : undefined,
          vinFullLength: listing.vin?.length ?? 0,
          customsStatus: listing.customsStatus,
          accidentHistory: listing.accidentHistory,
          priceKobo: listing.priceKobo,
          negotiable: listing.negotiable,
          swapAccepted: listing.swapAccepted,
          description: listing.description,
          features: listing.features,
          videoUrl: listing.videoUrl,
          coverPhotoUrl: listing.coverPhotoUrl,
          badges: listing.badges,
          status: listing.status,
          stats: listing.stats,
          isAuction: listing.isAuction,
          isFavorited: Boolean(isFavDoc),
          expiresAt: listing.expiresAt.toISOString(),
          createdAt: listing.createdAt.toISOString(),
        },
        media: media.map((m) => ({
          id: m._id.toString(),
          url: m.url,
          angle: m.angle,
          order: m.order,
        })),
        documents: documents.map((d) => ({
          id: d._id.toString(),
          type: d.type,
          customsReferenceNumber: d.customsReferenceNumber,
          summary: d.summary,
          status: d.status,
        })),
        seller: seller
          ? {
              id: seller._id.toString(),
              displayName: seller.displayName,
              phoneMasked: maskPhone(seller.phone),
              avatarUrl: seller.avatarUrl,
              bio: seller.bio,
              state: seller.state,
              lga: seller.lga,
              badges: seller.verification,
              responseRatePercent: seller.responseStats.ratePercent,
              avgResponseMinutes: seller.responseStats.avgResponseMinutes,
              ratingAvg: seller.ratingStats.avg,
              reviewCount: seller.ratingStats.count,
              memberSince: seller.createdAt.toISOString(),
              dealerProfile: dealerProfile
                ? {
                    slug: dealerProfile.slug,
                    businessName: dealerProfile.businessName,
                    cacNumber: dealerProfile.cacNumber,
                    address: dealerProfile.address,
                  }
                : null,
            }
          : null,
        auction: auction
          ? {
              id: auction._id.toString(),
              status: auction.status,
              startPriceKobo: auction.startPrice,
              currentPriceKobo: auction.currentPrice,
              buyNowPriceKobo: auction.buyNowPrice ?? null,
              reserveStatus: !auction.reservePrice
                ? 'no_reserve'
                : auction.reserveMet
                  ? 'reserve_met'
                  : 'reserve_not_met',
              startsAt: auction.startsAt.toISOString(),
              endsAt: auction.endsAt.toISOString(),
              originalEndsAt: auction.originalEndsAt.toISOString(),
              extensions: auction.extensions,
              bidCount: auction.bidCount,
              winningBidderMasked,
              viewerState:
                req.user && auction.leader?.userId.toString() === req.user.sub
                  ? 'winning'
                  : 'not_bidding',
              serverTimeMs: Date.now(),
            }
          : null,
        fairPriceInsight,
        similarListings: similarDocs.map((s) => ({
          id: s._id.toString(),
          slug: s.slug,
          title: s.title,
          year: s.year,
          make: s.make,
          model: s.model,
          condition: s.condition,
          mileageKm: s.mileageKm,
          transmission: s.transmission,
          state: s.state,
          lga: s.lga,
          priceKobo: s.priceKobo,
          negotiable: s.negotiable,
          coverPhotoUrl: s.coverPhotoUrl,
          badges: s.badges,
        })),
        moreFromSeller: moreFromSellerDocs.map((s) => ({
          id: s._id.toString(),
          slug: s.slug,
          title: s.title,
          year: s.year,
          priceKobo: s.priceKobo,
          mileageKm: s.mileageKm,
          state: s.state,
          lga: s.lga,
          coverPhotoUrl: s.coverPhotoUrl,
          badges: s.badges,
        })),
      });
    } catch (err) {
      next(err);
    }
  },
);

// ============================================================================
// UPDATE / MARK SOLD / RENEW LISTING
// ============================================================================
listingsRouter.patch(
  '/listings/:id',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const listing = await ListingModel.findById(req.params.id);
      if (!listing) {
        throw AppError.notFound('LISTING_NOT_FOUND', 'Listing not found.');
      }

      const isAdmin = req.user!.roles.includes('admin') || req.user!.roles.includes('moderator');
      if (listing.sellerId.toString() !== req.user!.sub && !isAdmin) {
        throw AppError.forbidden('NOT_LISTING_OWNER', 'You can only update your own listings.');
      }

      const { action, priceKobo, negotiable, description } = req.body as {
        action?: 'mark_sold' | 'renew';
        priceKobo?: number;
        negotiable?: boolean;
        description?: string;
      };

      if (action === 'mark_sold') {
        listing.status = 'sold';
      } else if (action === 'renew') {
        listing.status = 'active';
        listing.expiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
      }

      if (typeof priceKobo === 'number' && priceKobo >= 5_000_000) {
        listing.priceKobo = Math.round(priceKobo);
      }
      if (typeof negotiable === 'boolean') {
        listing.negotiable = negotiable;
      }
      if (typeof description === 'string' && description.length >= 20) {
        listing.description = description;
      }

      await listing.save();
      res.status(200).json({
        message: 'Listing updated.',
        listing: {
          id: listing._id.toString(),
          slug: listing.slug,
          status: listing.status,
          priceKobo: listing.priceKobo,
          expiresAt: listing.expiresAt.toISOString(),
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

// ============================================================================
// FAVORITES / WATCHLIST
// ============================================================================
listingsRouter.post(
  '/favorites/:listingId',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.sub;
      const { listingId } = req.params;
      if (!listingId || !mongoose.isValidObjectId(listingId)) {
        throw AppError.badRequest('INVALID_LISTING_ID', 'Invalid listing ID.');
      }

      const existing = await FavoriteModel.findOne({ userId, listingId });
      let favorited = false;

      if (existing) {
        await FavoriteModel.deleteOne({ _id: existing._id });
        await ListingModel.findByIdAndUpdate(listingId, {
          $inc: { 'stats.favoritesCount': -1 },
        });
        favorited = false;
      } else {
        await FavoriteModel.create({ userId, listingId });
        await ListingModel.findByIdAndUpdate(listingId, {
          $inc: { 'stats.favoritesCount': 1 },
        });
        favorited = true;
      }

      const updated = await ListingModel.findById(listingId).select('stats.favoritesCount').lean();

      res.status(200).json({
        favorited,
        favoritesCount: Math.max(0, updated?.stats?.favoritesCount ?? 0),
      });
    } catch (err) {
      next(err);
    }
  },
);

listingsRouter.get(
  '/favorites',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const favs = await FavoriteModel.find({ userId: req.user!.sub })
        .sort({ createdAt: -1 })
        .populate('listingId')
        .lean();

      const items = favs
        .map((f) => f.listingId as unknown as Record<string, unknown> | null)
        .filter((l): l is Record<string, unknown> => Boolean(l && l._id))
        .map((l) => ({
          id: String(l._id),
          slug: String(l.slug),
          title: String(l.title),
          year: Number(l.year),
          make: String(l.make),
          model: String(l.model),
          condition: String(l.condition),
          mileageKm: Number(l.mileageKm),
          transmission: String(l.transmission),
          state: String(l.state),
          lga: String(l.lga),
          priceKobo: Number(l.priceKobo),
          negotiable: Boolean(l.negotiable),
          coverPhotoUrl: String(l.coverPhotoUrl),
          badges: l.badges,
          isAuction: Boolean(l.isAuction),
          isFavorited: true,
        }));

      res.status(200).json({ items });
    } catch (err) {
      next(err);
    }
  },
);

// ============================================================================
// SEO & WHATSAPP LINK PREVIEW ENDPOINT (/api/v1/seo/listings/:slug)
// ============================================================================
listingsRouter.get(
  '/seo/listings/:slug',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const listing = await ListingModel.findOne({ slug: req.params.slug }).lean();
      if (!listing) {
        res.status(404).send('Listing not found');
        return;
      }

      const formattedPrice = formatKobo(listing.priceKobo);
      const conditionLabel =
        listing.condition === 'foreign_used'
          ? 'Foreign Used (Tokunbo)'
          : listing.condition === 'nigerian_used'
            ? 'Nigerian Used'
            : 'Brand New';
      const ogTitle = `${listing.title} — ${formattedPrice} in ${listing.lga}, ${listing.state} | ${BRAND_CONFIG.name}`;
      const ogDesc = `${conditionLabel} • ${listing.mileageKm.toLocaleString()} km • ${listing.transmission.toUpperCase()} • ${
        listing.badges.vinChecked ? 'VIN Checked' : 'Verified Seller'
      }. Inspect in ${listing.lga}, ${listing.state}.`;
      const canonicalPath = `/cars/${listing.state.toLowerCase()}/${listing.slug}`;

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.status(200).send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${ogTitle}</title>
  <meta name="description" content="${ogDesc}" />
  <meta property="og:type" content="product" />
  <meta property="og:site_name" content="${BRAND_CONFIG.name}" />
  <meta property="og:title" content="${ogTitle}" />
  <meta property="og:description" content="${ogDesc}" />
  <meta property="og:image" content="${listing.coverPhotoUrl}" />
  <meta property="product:price:amount" content="${Math.round(listing.priceKobo / 100)}" />
  <meta property="product:price:currency" content="NGN" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${ogTitle}" />
  <meta name="twitter:description" content="${ogDesc}" />
  <meta name="twitter:image" content="${listing.coverPhotoUrl}" />
  <link rel="canonical" href="${canonicalPath}" />
</head>
<body style="font-family:Poppins,sans-serif;padding:24px;background:#F8F8F6;color:#0F1419;">
  <h1>${listing.title}</h1>
  <p><strong>${formattedPrice}</strong> — ${ogDesc}</p>
  <p><a href="${canonicalPath}">View vehicle on ${BRAND_CONFIG.name}</a></p>
</body>
</html>`);
    } catch (err) {
      next(err);
    }
  },
);

