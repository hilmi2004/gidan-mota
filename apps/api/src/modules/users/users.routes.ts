import { Router, type Request, type Response, type NextFunction } from 'express';
import {
  SubmitDealerApplicationSchema,
  SubmitKycSchema,
  UpdateProfileSchema,
  maskPhone,
} from '@autodey/shared';
import { kycAdapter } from '../../adapters/index.js';
import { requireAuth } from '../../middleware/auth.js';
import { AppError, validateBody } from '../../middleware/errors.js';
import {
  DealerProfileModel,
  KycRecordModel,
  ListingModel,
  ReviewModel,
  SessionModel,
  UserModel,
  WalletAccountModel,
} from '../../models/index.js';

export const usersRouter = Router();

function slugifyBusinessName(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') +
    '-' +
    Math.random().toString(36).slice(2, 6)
  );
}

usersRouter.get('/me', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await UserModel.findById(req.user!.sub);
    if (!user || user.deletedAt) {
      throw AppError.notFound('USER_NOT_FOUND', 'User account not found.');
    }

    const [kycRecords, dealerProfile, wallet, activeListingsCount] = await Promise.all([
      KycRecordModel.find({ userId: user._id }).sort({ createdAt: -1 }).lean(),
      DealerProfileModel.findOne({ userId: user._id }).lean(),
      WalletAccountModel.findOne({ userId: user._id }).lean(),
      ListingModel.countDocuments({ sellerId: user._id, status: 'active' }),
    ]);

    res.status(200).json({
      user: {
        id: user._id.toString(),
        phone: user.phone,
        phoneMasked: maskPhone(user.phone),
        email: user.email,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        bio: user.bio,
        state: user.state,
        lga: user.lga,
        whatsappNumber: user.whatsappNumber,
        roles: user.roles,
        verification: user.verification,
        strikes: user.strikes,
        responseStats: user.responseStats,
        ratingStats: user.ratingStats,
        notificationPrefs: user.notificationPrefs,
        ndpaConsentAt: user.ndpaConsentAt,
        memberSince: user.createdAt.toISOString(),
        activeListingsCount,
      },
      kycRecords: kycRecords.map((k) => ({
        id: k._id.toString(),
        provider: k.provider,
        providerReference: k.providerReference,
        documentType: k.documentType,
        status: k.status,
        verifiedAt: k.verifiedAt,
      })),
      dealerProfile: dealerProfile
        ? {
            id: dealerProfile._id.toString(),
            slug: dealerProfile.slug,
            businessName: dealerProfile.businessName,
            cacNumber: dealerProfile.cacNumber,
            address: dealerProfile.address,
            state: dealerProfile.state,
            lga: dealerProfile.lga,
            shopPhotos: dealerProfile.shopPhotos,
            openingHours: dealerProfile.openingHours,
            status: dealerProfile.status,
            planTier: dealerProfile.planTier,
            listingLimit: dealerProfile.listingLimit,
          }
        : null,
      wallet: wallet
        ? {
            availableKobo: wallet.availableKobo,
            heldKobo: wallet.heldKobo,
            forfeitedKobo: wallet.forfeitedKobo,
            currency: wallet.currency,
          }
        : { availableKobo: 0, heldKobo: 0, forfeitedKobo: 0, currency: 'NGN' },
    });
  } catch (err) {
    next(err);
  }
});

usersRouter.patch(
  '/me',
  requireAuth,
  validateBody(UpdateProfileSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await UserModel.findById(req.user!.sub);
      if (!user || user.deletedAt) {
        throw AppError.notFound('USER_NOT_FOUND', 'User not found.');
      }

      const { displayName, email, bio, state, lga, whatsappNumber, avatarUrl, notificationPrefs } =
        req.body;

      user.displayName = displayName;
      if (email !== undefined) user.email = email || undefined;
      if (bio !== undefined) user.bio = bio;
      if (state !== undefined) user.state = state;
      if (lga !== undefined) user.lga = lga;
      if (whatsappNumber !== undefined) user.whatsappNumber = whatsappNumber;
      if (avatarUrl !== undefined) user.avatarUrl = avatarUrl || undefined;
      if (notificationPrefs) {
        user.notificationPrefs = { ...user.notificationPrefs, ...notificationPrefs };
      }

      await user.save();

      res.status(200).json({
        message: 'Profile updated.',
        user: {
          id: user._id.toString(),
          displayName: user.displayName,
          email: user.email,
          bio: user.bio,
          state: user.state,
          lga: user.lga,
          whatsappNumber: user.whatsappNumber,
          avatarUrl: user.avatarUrl,
          roles: user.roles,
          verification: user.verification,
          notificationPrefs: user.notificationPrefs,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

usersRouter.post(
  '/me/kyc',
  requireAuth,
  validateBody(SubmitKycSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await UserModel.findById(req.user!.sub);
      if (!user || user.deletedAt) {
        throw AppError.notFound('USER_NOT_FOUND', 'User not found.');
      }

      const { documentType, idNumber, firstName, lastName } = req.body;

      const result = await kycAdapter.verifyIdentity({
        userId: user._id.toString(),
        documentType,
        idNumber,
        firstName,
        lastName,
      });

      const kycRecord = await KycRecordModel.findOneAndUpdate(
        { providerReference: result.providerReference },
        {
          userId: user._id,
          provider: result.provider,
          providerReference: result.providerReference,
          documentType,
          status: result.status,
          verifiedAt: result.status === 'verified' ? new Date() : undefined,
          rejectionReason: result.rejectionReason,
        },
        { upsert: true, new: true },
      );

      if (result.status === 'verified') {
        user.verification.idVerified = true;
        await user.save();
      } else {
        throw AppError.badRequest(
          'KYC_REJECTED',
          result.rejectionReason || 'Identity verification failed.',
        );
      }

      res.status(200).json({
        message: 'Identity verified. Your ID Verified badge is now active.',
        kycRecord: {
          id: kycRecord._id.toString(),
          provider: kycRecord.provider,
          providerReference: kycRecord.providerReference,
          documentType: kycRecord.documentType,
          status: kycRecord.status,
          verifiedAt: kycRecord.verifiedAt,
        },
        verification: user.verification,
      });
    } catch (err) {
      next(err);
    }
  },
);

usersRouter.post(
  '/me/dealer-application',
  requireAuth,
  validateBody(SubmitDealerApplicationSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await UserModel.findById(req.user!.sub);
      if (!user || user.deletedAt) {
        throw AppError.notFound('USER_NOT_FOUND', 'User not found.');
      }

      const { businessName, cacNumber, address, state, lga, shopPhotos, openingHours } = req.body;

      let profile = await DealerProfileModel.findOne({ userId: user._id });
      if (!profile) {
        profile = await DealerProfileModel.create({
          userId: user._id,
          slug: slugifyBusinessName(businessName),
          businessName,
          cacNumber: cacNumber.toUpperCase(),
          address,
          state,
          lga,
          shopPhotos,
          openingHours,
          status: 'pending',
          planTier: 'free',
          listingLimit: 15,
        });
      } else {
        profile.businessName = businessName;
        profile.cacNumber = cacNumber.toUpperCase();
        profile.address = address;
        profile.state = state;
        profile.lga = lga;
        profile.shopPhotos = shopPhotos;
        profile.openingHours = openingHours;
        profile.status = 'pending';
        await profile.save();
      }

      if (!user.roles.includes('dealer')) {
        user.roles.push('dealer');
        await user.save();
      }

      res.status(201).json({
        message: 'Dealer verification application submitted for moderator review.',
        dealerProfile: {
          id: profile._id.toString(),
          slug: profile.slug,
          businessName: profile.businessName,
          cacNumber: profile.cacNumber,
          address: profile.address,
          state: profile.state,
          lga: profile.lga,
          status: profile.status,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

usersRouter.get('/me/export', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.sub;
    const [user, kycRecords, dealerProfile, listings, reviews] = await Promise.all([
      UserModel.findById(userId).lean(),
      KycRecordModel.find({ userId }).lean(),
      DealerProfileModel.findOne({ userId }).lean(),
      ListingModel.find({ sellerId: userId }).lean(),
      ReviewModel.find({ reviewerId: userId }).lean(),
    ]);

    res.status(200).json({
      exportedAt: new Date().toISOString(),
      complianceFramework: 'Nigeria Data Protection Act (NDPA) 2023',
      user,
      kycRecords,
      dealerProfile,
      listings,
      reviews,
    });
  } catch (err) {
    next(err);
  }
});

usersRouter.delete('/me', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await UserModel.findById(req.user!.sub);
    if (!user) {
      throw AppError.notFound('USER_NOT_FOUND', 'User not found.');
    }

    user.deletedAt = new Date();
    user.displayName = 'Deleted User';
    user.phone = `deleted_${user._id.toString()}`;
    user.email = undefined;
    user.bio = undefined;
    user.avatarUrl = undefined;
    await user.save();

    await SessionModel.updateMany({ userId: user._id }, { $set: { revokedAt: new Date() } });
    res.clearCookie('autodey_refresh', { path: '/api/v1/auth' });

    res.status(200).json({
      message: 'Your account and personal data have been anonymized and scheduled for removal per NDPA 2023.',
    });
  } catch (err) {
    next(err);
  }
});

usersRouter.get('/:id/profile', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await UserModel.findOne({ _id: req.params.id, deletedAt: null }).lean();
    if (!user) {
      throw AppError.notFound('USER_NOT_FOUND', 'Seller profile not found.');
    }

    const [activeListingsCount, dealerProfile, reviews] = await Promise.all([
      ListingModel.countDocuments({ sellerId: user._id, status: 'active' }),
      DealerProfileModel.findOne({ userId: user._id }).lean(),
      ReviewModel.find({ sellerId: user._id })
        .sort({ createdAt: -1 })
        .limit(20)
        .populate('reviewerId', 'displayName avatarUrl')
        .lean(),
    ]);

    res.status(200).json({
      profile: {
        id: user._id.toString(),
        displayName: user.displayName,
        phoneMasked: maskPhone(user.phone),
        avatarUrl: user.avatarUrl,
        bio: user.bio,
        state: user.state,
        lga: user.lga,
        roles: user.roles,
        badges: user.verification,
        memberSince: user.createdAt.toISOString(),
        activeListingsCount,
        responseRatePercent: user.responseStats.ratePercent,
        avgResponseMinutes: user.responseStats.avgResponseMinutes,
        ratingAvg: user.ratingStats.avg,
        reviewCount: user.ratingStats.count,
        dealerProfile: dealerProfile
          ? {
              slug: dealerProfile.slug,
              businessName: dealerProfile.businessName,
              cacNumber: dealerProfile.cacNumber,
              address: dealerProfile.address,
              state: dealerProfile.state,
              lga: dealerProfile.lga,
              status: dealerProfile.status,
              planTier: dealerProfile.planTier,
            }
          : null,
      },
      reviews: reviews.map((r) => ({
        id: r._id.toString(),
        rating: r.rating,
        comment: r.comment,
        interactionType: r.interactionType,
        createdAt: r.createdAt.toISOString(),
        reviewer:
          r.reviewerId && typeof r.reviewerId === 'object' && 'displayName' in r.reviewerId
            ? {
                displayName: (r.reviewerId as { displayName: string }).displayName,
              }
            : { displayName: 'Verified Buyer' },
      })),
    });
  } catch (err) {
    next(err);
  }
});

