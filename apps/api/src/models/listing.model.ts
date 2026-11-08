import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface IVehicleCatalog extends Document {
  make: string;
  models: string[];
  synonyms: string[];
}

const VehicleCatalogSchema = new Schema<IVehicleCatalog>(
  {
    make: { type: String, required: true, unique: true },
    models: { type: [String], default: [] },
    synonyms: { type: [String], default: [] },
  },
  { timestamps: true },
);

export const VehicleModel = mongoose.model<IVehicleCatalog>('Vehicle', VehicleCatalogSchema);

export interface IListing {
  _id: Types.ObjectId;
  sellerId: Types.ObjectId;
  slug: string;
  title: string;
  category: 'cars' | 'suvs' | 'buses_vans' | 'trucks' | 'motorcycles';
  make: string;
  model: string;
  trim?: string;
  year: number;
  condition: 'brand_new' | 'foreign_used' | 'nigerian_used';
  mileageKm: number;
  transmission: 'automatic' | 'manual' | 'cvt';
  fuelType: 'petrol' | 'diesel' | 'hybrid' | 'electric' | 'cng';
  bodyType: 'sedan' | 'suv' | 'hatchback' | 'coupe' | 'pickup' | 'minivan' | 'bus' | 'truck' | 'motorcycle';
  driveSide: 'lhd' | 'rhd';
  engineSize?: string;
  exteriorColor: string;
  interiorColor: string;
  ownersCount: number;
  state: string;
  lga: string;
  vin?: string;
  vinDecoded?: {
    make?: string;
    model?: string;
    year?: number;
    mismatchFlag: boolean;
  };
  customsStatus: 'yes' | 'no' | 'unsure';
  accidentHistory: 'none' | 'minor_repaired' | 'major_repaired' | 'unknown';
  priceKobo: number;
  negotiable: boolean;
  swapAccepted: boolean;
  description: string;
  features: string[];
  videoUrl?: string;
  coverPhotoUrl: string;
  badges: {
    vinChecked: boolean;
    customsReviewed: boolean;
    inspected: boolean;
  };
  status: 'draft' | 'pending_review' | 'active' | 'sold' | 'expired' | 'rejected' | 'removed';
  rejectionReason?: string;
  moderationFlags: string[];
  reportsCount: number;
  promotion: {
    topAdUntil?: Date | null;
    featuredUntil?: Date | null;
    urgentUntil?: Date | null;
    bumpedAt?: Date | null;
  };
  stats: {
    views: number;
    phoneReveals: number;
    chatStarts: number;
    favoritesCount: number;
  };
  isAuction: boolean;
  auctionId?: Types.ObjectId | null;
  expiresAt: Date;
  draftExpiresAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const ListingSchema = new Schema<IListing>(
  {
    sellerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    slug: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    category: {
      type: String,
      enum: ['cars', 'suvs', 'buses_vans', 'trucks', 'motorcycles'],
      default: 'cars',
    },
    make: { type: String, required: true },
    model: { type: String, required: true },
    trim: { type: String },
    year: { type: Number, required: true },
    condition: {
      type: String,
      enum: ['brand_new', 'foreign_used', 'nigerian_used'],
      required: true,
    },
    mileageKm: { type: Number, required: true, min: 0 },
    transmission: { type: String, enum: ['automatic', 'manual', 'cvt'], required: true },
    fuelType: {
      type: String,
      enum: ['petrol', 'diesel', 'hybrid', 'electric', 'cng'],
      default: 'petrol',
    },
    bodyType: {
      type: String,
      enum: ['sedan', 'suv', 'hatchback', 'coupe', 'pickup', 'minivan', 'bus', 'truck', 'motorcycle'],
      default: 'sedan',
    },
    driveSide: { type: String, enum: ['lhd', 'rhd'], default: 'lhd' },
    engineSize: { type: String },
    exteriorColor: { type: String, required: true },
    interiorColor: { type: String, default: 'Black' },
    ownersCount: { type: Number, default: 1 },
    state: { type: String, required: true },
    lga: { type: String, required: true },
    vin: { type: String, uppercase: true, trim: true },
    vinDecoded: {
      make: { type: String },
      model: { type: String },
      year: { type: Number },
      mismatchFlag: { type: Boolean, default: false },
    },
    customsStatus: { type: String, enum: ['yes', 'no', 'unsure'], default: 'yes' },
    accidentHistory: {
      type: String,
      enum: ['none', 'minor_repaired', 'major_repaired', 'unknown'],
      default: 'none',
    },
    priceKobo: { type: Number, required: true, min: 0 },
    negotiable: { type: Boolean, default: true },
    swapAccepted: { type: Boolean, default: false },
    description: { type: String, required: true },
    features: { type: [String], default: [] },
    videoUrl: { type: String },
    coverPhotoUrl: { type: String, required: true },
    badges: {
      vinChecked: { type: Boolean, default: false },
      customsReviewed: { type: Boolean, default: false },
      inspected: { type: Boolean, default: false },
    },
    status: {
      type: String,
      enum: ['draft', 'pending_review', 'active', 'sold', 'expired', 'rejected', 'removed'],
      default: 'active',
    },
    rejectionReason: { type: String },
    moderationFlags: { type: [String], default: [] },
    reportsCount: { type: Number, default: 0 },
    promotion: {
      topAdUntil: { type: Date, default: null },
      featuredUntil: { type: Date, default: null },
      urgentUntil: { type: Date, default: null },
      bumpedAt: { type: Date, default: () => new Date() },
    },
    stats: {
      views: { type: Number, default: 0 },
      phoneReveals: { type: Number, default: 0 },
      chatStarts: { type: Number, default: 0 },
      favoritesCount: { type: Number, default: 0 },
    },
    isAuction: { type: Boolean, default: false },
    auctionId: { type: Schema.Types.ObjectId, ref: 'Auction', default: null },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
    },
    draftExpiresAt: { type: Date, default: null },
  },
  { timestamps: true },
);

ListingSchema.index({ status: 1, state: 1, make: 1, model: 1, year: -1, priceKobo: 1 });
ListingSchema.index({ status: 1, 'promotion.topAdUntil': -1, 'promotion.bumpedAt': -1, createdAt: -1 });
ListingSchema.index({ make: 1, model: 1, year: 1, status: 1, priceKobo: 1 });
ListingSchema.index(
  { vin: 1 },
  {
    unique: true,
    partialFilterExpression: {
      vin: { $type: 'string', $gt: '' },
      status: { $in: ['pending_review', 'active'] },
    },
  },
);
ListingSchema.index({ draftExpiresAt: 1 }, { expireAfterSeconds: 0 });
ListingSchema.index({
  title: 'text',
  make: 'text',
  model: 'text',
  trim: 'text',
  description: 'text',
  state: 'text',
  lga: 'text',
});

export const ListingModel = mongoose.model<IListing>('Listing', ListingSchema);

export interface IListingMedia extends Document {
  listingId: Types.ObjectId;
  sellerId: Types.ObjectId;
  url: string;
  publicId?: string;
  angle: 'front' | 'rear' | 'left' | 'right' | 'interior' | 'dashboard' | 'engine' | 'boot' | 'other';
  order: number;
  blurHash?: string;
  perceptualHash?: string;
  width?: number;
  height?: number;
}

const ListingMediaSchema = new Schema<IListingMedia>(
  {
    listingId: { type: Schema.Types.ObjectId, ref: 'Listing', required: true },
    sellerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    url: { type: String, required: true },
    publicId: { type: String },
    angle: {
      type: String,
      enum: ['front', 'rear', 'left', 'right', 'interior', 'dashboard', 'engine', 'boot', 'other'],
      default: 'other',
    },
    order: { type: Number, default: 0 },
    blurHash: { type: String },
    perceptualHash: { type: String, index: true },
    width: { type: Number },
    height: { type: Number },
  },
  { timestamps: true },
);

ListingMediaSchema.index({ listingId: 1, order: 1 });

export const ListingMediaModel = mongoose.model<IListingMedia>('ListingMedia', ListingMediaSchema);

export interface IVehicleDocument extends Document {
  listingId: Types.ObjectId;
  sellerId: Types.ObjectId;
  type: 'customs_duty' | 'inspection_report';
  fileUrl: string;
  customsReferenceNumber?: string;
  summary?: string;
  status: 'pending' | 'approved' | 'rejected';
  adapterReference?: string;
  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;
  rejectionReason?: string;
  createdAt: Date;
}

const VehicleDocumentSchema = new Schema<IVehicleDocument>(
  {
    listingId: { type: Schema.Types.ObjectId, ref: 'Listing', required: true },
    sellerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['customs_duty', 'inspection_report'], required: true },
    fileUrl: { type: String, required: true },
    customsReferenceNumber: { type: String },
    summary: { type: String },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    adapterReference: { type: String },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
    rejectionReason: { type: String },
  },
  { timestamps: true },
);

VehicleDocumentSchema.index({ listingId: 1, type: 1 });
VehicleDocumentSchema.index({ status: 1, createdAt: 1 });

export const VehicleDocumentModel = mongoose.model<IVehicleDocument>(
  'VehicleDocument',
  VehicleDocumentSchema,
);

export interface IFavorite extends Document {
  userId: Types.ObjectId;
  listingId: Types.ObjectId;
  createdAt: Date;
}

const FavoriteSchema = new Schema<IFavorite>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    listingId: { type: Schema.Types.ObjectId, ref: 'Listing', required: true },
  },
  { timestamps: true },
);

FavoriteSchema.index({ userId: 1, listingId: 1 }, { unique: true });
FavoriteSchema.index({ userId: 1, createdAt: -1 });

export const FavoriteModel = mongoose.model<IFavorite>('Favorite', FavoriteSchema);

export interface ISavedSearch extends Document {
  userId: Types.ObjectId;
  name: string;
  filters: Record<string, unknown>;
  channels: {
    inApp: boolean;
    email: boolean;
    sms: boolean;
    push: boolean;
  };
  lastNotifiedAt?: Date;
  createdAt: Date;
}

const SavedSearchSchema = new Schema<ISavedSearch>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true },
    filters: { type: Schema.Types.Mixed, required: true },
    channels: {
      inApp: { type: Boolean, default: true },
      email: { type: Boolean, default: true },
      sms: { type: Boolean, default: false },
      push: { type: Boolean, default: true },
    },
    lastNotifiedAt: { type: Date },
  },
  { timestamps: true },
);

export const SavedSearchModel = mongoose.model<ISavedSearch>('SavedSearch', SavedSearchSchema);

