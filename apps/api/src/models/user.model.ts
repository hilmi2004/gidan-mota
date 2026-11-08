import mongoose, { Schema, type Document, type Types } from 'mongoose';
import type { UserRole } from '@autodey/shared';

export interface IUser extends Document {
  _id: Types.ObjectId;
  phone: string;
  email?: string;
  passwordHash?: string;
  displayName: string;
  avatarUrl?: string;
  bio?: string;
  state?: string;
  lga?: string;
  whatsappNumber?: string;
  roles: UserRole[];
  verification: {
    phoneVerified: boolean;
    idVerified: boolean;
    dealerVerified: boolean;
  };
  strikes: number;
  bannedUntil?: Date | null;
  banReason?: string;
  responseStats: {
    ratePercent: number;
    avgResponseMinutes: number;
    totalConversations: number;
    respondedConversations: number;
  };
  ratingStats: {
    avg: number;
    count: number;
  };
  notificationPrefs: {
    inApp: boolean;
    email: boolean;
    sms: boolean;
    webPush: boolean;
  };
  ndpaConsentAt: Date;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    phone: { type: String, required: true, unique: true, index: true },
    email: { type: String, sparse: true, unique: true },
    passwordHash: { type: String, select: false },
    displayName: { type: String, required: true, trim: true },
    avatarUrl: { type: String },
    bio: { type: String, maxlength: 400 },
    state: { type: String, default: 'Lagos' },
    lga: { type: String, default: 'Ikeja' },
    whatsappNumber: { type: String },
    roles: {
      type: [String],
      enum: ['buyer', 'seller', 'dealer', 'moderator', 'admin'],
      default: ['buyer', 'seller'],
    },
    verification: {
      phoneVerified: { type: Boolean, default: false },
      idVerified: { type: Boolean, default: false },
      dealerVerified: { type: Boolean, default: false },
    },
    strikes: { type: Number, default: 0, min: 0 },
    bannedUntil: { type: Date, default: null },
    banReason: { type: String },
    responseStats: {
      ratePercent: { type: Number, default: 96 },
      avgResponseMinutes: { type: Number, default: 8 },
      totalConversations: { type: Number, default: 0 },
      respondedConversations: { type: Number, default: 0 },
    },
    ratingStats: {
      avg: { type: Number, default: 0 },
      count: { type: Number, default: 0 },
    },
    notificationPrefs: {
      inApp: { type: Boolean, default: true },
      email: { type: Boolean, default: true },
      sms: { type: Boolean, default: true },
      webPush: { type: Boolean, default: true },
    },
    ndpaConsentAt: { type: Date, default: () => new Date() },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

UserSchema.index({ roles: 1, createdAt: -1 });
UserSchema.index({ state: 1, 'verification.dealerVerified': 1 });

export const UserModel = mongoose.model<IUser>('User', UserSchema);

export interface ISession extends Document {
  userId: Types.ObjectId;
  tokenHash: string;
  familyId: string;
  deviceFingerprint?: string;
  ip?: string;
  userAgent?: string;
  expiresAt: Date;
  revokedAt?: Date | null;
  createdAt: Date;
}

const SessionSchema = new Schema<ISession>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    familyId: { type: String, required: true, index: true },
    deviceFingerprint: { type: String },
    ip: { type: String },
    userAgent: { type: String },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const SessionModel = mongoose.model<ISession>('Session', SessionSchema);

export interface IOtpCode extends Document {
  phone: string;
  codeHash: string;
  attempts: number;
  ip?: string;
  expiresAt: Date;
  createdAt: Date;
}

const OtpCodeSchema = new Schema<IOtpCode>(
  {
    phone: { type: String, required: true, index: true },
    codeHash: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    ip: { type: String },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

OtpCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const OtpCodeModel = mongoose.model<IOtpCode>('OtpCode', OtpCodeSchema);

/**
 * KYC Record: Stores ONLY the verification provider's reference and status.
 * NEVER stores raw NIN or BVN numbers (NDPA 2023 compliance).
 */
export interface IKycRecord extends Document {
  userId: Types.ObjectId;
  provider: 'mock' | 'dojah' | 'smile_id';
  providerReference: string;
  documentType: 'nin' | 'bvn' | 'voters_card' | 'drivers_license' | 'international_passport';
  status: 'pending' | 'verified' | 'rejected';
  verifiedAt?: Date;
  rejectionReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const KycRecordSchema = new Schema<IKycRecord>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    provider: { type: String, enum: ['mock', 'dojah', 'smile_id'], required: true },
    providerReference: { type: String, required: true, unique: true },
    documentType: {
      type: String,
      enum: ['nin', 'bvn', 'voters_card', 'drivers_license', 'international_passport'],
      required: true,
    },
    status: { type: String, enum: ['pending', 'verified', 'rejected'], default: 'pending' },
    verifiedAt: { type: Date },
    rejectionReason: { type: String },
  },
  { timestamps: true },
);

KycRecordSchema.index({ userId: 1, status: 1 });

export const KycRecordModel = mongoose.model<IKycRecord>('KycRecord', KycRecordSchema);

export interface IDealerProfile extends Document {
  userId: Types.ObjectId;
  slug: string;
  businessName: string;
  cacNumber: string;
  address: string;
  state: string;
  lga: string;
  coordinates?: { lat: number; lng: number };
  shopPhotos: string[];
  logoUrl?: string;
  bannerUrl?: string;
  openingHours: string;
  status: 'pending' | 'approved' | 'rejected';
  planTier: 'free' | 'starter' | 'pro' | 'premier';
  listingLimit: number;
  approvedBy?: Types.ObjectId;
  approvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const DealerProfileSchema = new Schema<IDealerProfile>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    slug: { type: String, required: true, unique: true },
    businessName: { type: String, required: true, trim: true },
    cacNumber: { type: String, required: true, trim: true },
    address: { type: String, required: true },
    state: { type: String, required: true },
    lga: { type: String, required: true },
    coordinates: {
      lat: { type: Number },
      lng: { type: Number },
    },
    shopPhotos: { type: [String], default: [] },
    logoUrl: { type: String },
    bannerUrl: { type: String },
    openingHours: { type: String, default: 'Mon–Sat: 8:00 AM – 6:00 PM' },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    planTier: { type: String, enum: ['free', 'starter', 'pro', 'premier'], default: 'free' },
    listingLimit: { type: Number, default: 10 },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date },
  },
  { timestamps: true },
);

DealerProfileSchema.index({ status: 1, state: 1 });

export const DealerProfileModel = mongoose.model<IDealerProfile>('DealerProfile', DealerProfileSchema);

export interface IDeviceFingerprint extends Document {
  userId: Types.ObjectId;
  fingerprintHash: string;
  ipHash: string;
  userAgent?: string;
  lastSeenAt: Date;
}

const DeviceFingerprintSchema = new Schema<IDeviceFingerprint>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    fingerprintHash: { type: String, required: true },
    ipHash: { type: String, required: true },
    userAgent: { type: String },
    lastSeenAt: { type: Date, default: () => new Date() },
  },
  { timestamps: true },
);

DeviceFingerprintSchema.index({ fingerprintHash: 1, userId: 1 });
DeviceFingerprintSchema.index({ ipHash: 1, userId: 1 });

export const DeviceFingerprintModel = mongoose.model<IDeviceFingerprint>(
  'DeviceFingerprint',
  DeviceFingerprintSchema,
);

