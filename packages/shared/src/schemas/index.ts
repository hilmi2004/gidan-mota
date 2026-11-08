import { z } from 'zod';
import { normalizeNigerianPhone } from '../utils/index.js';

export const UserRoleSchema = z.enum(['buyer', 'seller', 'dealer', 'moderator', 'admin']);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const NigerianPhoneSchema = z
  .string()
  .min(10, 'Enter a valid Nigerian phone number')
  .transform((val) => normalizeNigerianPhone(val))
  .refine((val) => /^\+234[789][01]\d{8}$/.test(val), {
    message: 'Enter a valid Nigerian mobile number (e.g. 0803 123 4567)',
  });

export const RequestOtpSchema = z.object({
  phone: NigerianPhoneSchema,
});

export const VerifyOtpSchema = z.object({
  phone: NigerianPhoneSchema,
  code: z.string().regex(/^\d{6}$/, 'OTP code must be 6 digits'),
  displayName: z.string().min(2).max(60).optional(),
  email: z.string().email().optional().or(z.literal('')),
  password: z.string().min(8).max(72).optional(),
  ndpaConsent: z.boolean().optional().default(true),
  deviceFingerprint: z.string().max(128).optional(),
});

export const PasswordLoginSchema = z.object({
  phone: NigerianPhoneSchema,
  password: z.string().min(1, 'Password is required'),
  deviceFingerprint: z.string().max(128).optional(),
});

export const UpdateProfileSchema = z.object({
  displayName: z.string().min(2, 'Display name must be at least 2 characters').max(60),
  email: z.string().email().optional().or(z.literal('')),
  bio: z.string().max(400).optional(),
  state: z.string().min(2).max(40).optional(),
  lga: z.string().min(2).max(60).optional(),
  whatsappNumber: z.string().optional(),
  avatarUrl: z.string().url().optional().or(z.literal('')),
  notificationPrefs: z
    .object({
      inApp: z.boolean().default(true),
      email: z.boolean().default(true),
      sms: z.boolean().default(true),
      webPush: z.boolean().default(true),
    })
    .optional(),
});

export const SubmitKycSchema = z.object({
  documentType: z.enum(['nin', 'bvn', 'voters_card', 'drivers_license', 'international_passport']),
  /**
   * Raw ID number is passed once to the KYC adapter to obtain a verification reference
   * and is NEVER persisted in MongoDB or logs (NDPA 2023 compliance).
   */
  idNumber: z.string().min(8).max(20),
  firstName: z.string().min(2).max(50),
  lastName: z.string().min(2).max(50),
});

export const SubmitDealerApplicationSchema = z.object({
  businessName: z.string().min(3).max(100),
  cacNumber: z.string().regex(/^(RC|BN)[-\s]?\d{4,10}$/i, 'Enter a valid CAC RC or BN number (e.g. RC-1482910)'),
  address: z.string().min(10).max(200),
  state: z.string().min(2),
  lga: z.string().min(2),
  shopPhotos: z.array(z.string().url()).min(1, 'Upload at least 1 photo of your car lot/office'),
  openingHours: z.string().max(120).optional().default('Mon–Sat: 8:00 AM – 6:00 PM'),
});

export const ListingCategorySchema = z.enum(['cars', 'suvs', 'buses_vans', 'trucks', 'motorcycles']);
export const VehicleConditionSchema = z.enum(['brand_new', 'foreign_used', 'nigerian_used']);
export const TransmissionSchema = z.enum(['automatic', 'manual', 'cvt']);
export const FuelTypeSchema = z.enum(['petrol', 'diesel', 'hybrid', 'electric', 'cng']);
export const BodyTypeSchema = z.enum([
  'sedan',
  'suv',
  'hatchback',
  'coupe',
  'pickup',
  'minivan',
  'bus',
  'truck',
  'motorcycle',
]);
export const DriveSideSchema = z.enum(['lhd', 'rhd']);
export const CustomsStatusSchema = z.enum(['yes', 'no', 'unsure']);

export const CreateListingSchema = z.object({
  category: ListingCategorySchema,
  make: z.string().min(1),
  model: z.string().min(1),
  trim: z.string().max(50).optional(),
  year: z.number().int().min(1985).max(new Date().getFullYear() + 1),
  condition: VehicleConditionSchema,
  mileageKm: z.number().int().min(0).max(2_000_000),
  transmission: TransmissionSchema,
  fuelType: FuelTypeSchema,
  bodyType: BodyTypeSchema,
  driveSide: DriveSideSchema.default('lhd'),
  engineSize: z.string().max(30).optional(),
  exteriorColor: z.string().min(2).max(30),
  interiorColor: z.string().min(2).max(30).optional().default('Black'),
  ownersCount: z.number().int().min(0).max(20).optional().default(1),
  state: z.string().min(2),
  lga: z.string().min(2),
  vin: z.string().max(17).optional().or(z.literal('')),
  customsStatus: CustomsStatusSchema,
  accidentHistory: z.enum(['none', 'minor_repaired', 'major_repaired', 'unknown']).default('none'),
  priceKobo: z.number().int().min(5_000_000, 'Minimum price is ₦50,000'),
  negotiable: z.boolean().default(true),
  swapAccepted: z.boolean().default(false),
  description: z.string().min(20).max(4000),
  features: z.array(z.string()).default([]),
  videoUrl: z.string().url().optional().or(z.literal('')),
  photos: z
    .array(
      z.object({
        url: z.string().url(),
        angle: z
          .enum(['front', 'rear', 'left', 'right', 'interior', 'dashboard', 'engine', 'boot', 'other'])
          .default('other'),
        order: z.number().int().min(0),
        perceptualHash: z.string().optional(),
      }),
    )
    .min(1),
  isDraft: z.boolean().optional().default(false),
});

export const PlaceBidSchema = z.object({
  maxBidKobo: z.number().int().positive('Bid amount must be a positive integer in kobo'),
  deviceFingerprint: z.string().max(128).optional(),
});

export const CreateAuctionSchema = z.object({
  listingId: z.string().min(1),
  startPriceKobo: z.number().int().min(10_000_000),
  reservePriceKobo: z.number().int().min(10_000_000).optional(),
  buyNowPriceKobo: z.number().int().min(10_000_000).optional(),
  durationDays: z.enum(['1', '3', '5', '7', '10']).transform(Number),
  scheduledStartAt: z.string().datetime().optional(),
});

export type RequestOtpInput = z.infer<typeof RequestOtpSchema>;
export type VerifyOtpInput = z.infer<typeof VerifyOtpSchema>;
export type PasswordLoginInput = z.infer<typeof PasswordLoginSchema>;
export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;
export type SubmitKycInput = z.infer<typeof SubmitKycSchema>;
export type SubmitDealerApplicationInput = z.infer<typeof SubmitDealerApplicationSchema>;
export type CreateListingInput = z.infer<typeof CreateListingSchema>;
export type PlaceBidInput = z.infer<typeof PlaceBidSchema>;
export type CreateAuctionInput = z.infer<typeof CreateAuctionSchema>;

