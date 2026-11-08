import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface IWalletAccount extends Document {
  userId: Types.ObjectId;
  availableKobo: number;
  heldKobo: number;
  forfeitedKobo: number;
  currency: 'NGN';
  updatedAt: Date;
}

const WalletAccountSchema = new Schema<IWalletAccount>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    availableKobo: { type: Number, default: 0, min: 0 },
    heldKobo: { type: Number, default: 0, min: 0 },
    forfeitedKobo: { type: Number, default: 0, min: 0 },
    currency: { type: String, enum: ['NGN'], default: 'NGN' },
  },
  { timestamps: true },
);

export const WalletAccountModel = mongoose.model<IWalletAccount>('WalletAccount', WalletAccountSchema);

/**
 * Double-entry-style immutable ledger collection (WalletTransaction).
 * Balances on WalletAccount are NEVER mutated without an accompanying WalletTransaction record.
 */
export interface IWalletTransaction extends Document {
  walletId: Types.ObjectId;
  userId: Types.ObjectId;
  idempotencyKey: string;
  type: 'deposit' | 'hold' | 'release' | 'forfeit' | 'refund' | 'fee';
  direction: 'credit' | 'debit';
  amountKobo: number;
  balanceAfterAvailableKobo: number;
  balanceAfterHeldKobo: number;
  referenceType: 'payment' | 'auction' | 'settlement' | 'withdrawal' | 'admin';
  referenceId: string;
  description: string;
  createdAt: Date;
}

const WalletTransactionSchema = new Schema<IWalletTransaction>(
  {
    walletId: { type: Schema.Types.ObjectId, ref: 'WalletAccount', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    idempotencyKey: { type: String, required: true, unique: true },
    type: {
      type: String,
      enum: ['deposit', 'hold', 'release', 'forfeit', 'refund', 'fee'],
      required: true,
    },
    direction: { type: String, enum: ['credit', 'debit'], required: true },
    amountKobo: { type: Number, required: true, min: 1 },
    balanceAfterAvailableKobo: { type: Number, required: true },
    balanceAfterHeldKobo: { type: Number, required: true },
    referenceType: {
      type: String,
      enum: ['payment', 'auction', 'settlement', 'withdrawal', 'admin'],
      required: true,
    },
    referenceId: { type: String, required: true },
    description: { type: String, required: true },
  },
  { timestamps: true },
);

WalletTransactionSchema.index({ userId: 1, createdAt: -1 });
WalletTransactionSchema.index({ referenceType: 1, referenceId: 1 });

export const WalletTransactionModel = mongoose.model<IWalletTransaction>(
  'WalletTransaction',
  WalletTransactionSchema,
);

export interface IPayment extends Document {
  userId: Types.ObjectId;
  reference: string;
  idempotencyKey: string;
  purpose: 'bidding_deposit' | 'promotion' | 'dealer_subscription' | 'auction_fee';
  amountKobo: number;
  status: 'pending' | 'success' | 'failed' | 'refunded';
  provider: 'mock' | 'paystack';
  metadata?: Record<string, unknown>;
  paidAt?: Date;
  createdAt: Date;
}

const PaymentSchema = new Schema<IPayment>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    reference: { type: String, required: true, unique: true },
    idempotencyKey: { type: String, required: true, unique: true },
    purpose: {
      type: String,
      enum: ['bidding_deposit', 'promotion', 'dealer_subscription', 'auction_fee'],
      required: true,
    },
    amountKobo: { type: Number, required: true },
    status: {
      type: String,
      enum: ['pending', 'success', 'failed', 'refunded'],
      default: 'pending',
    },
    provider: { type: String, enum: ['mock', 'paystack'], default: 'mock' },
    metadata: { type: Schema.Types.Mixed },
    paidAt: { type: Date },
  },
  { timestamps: true },
);

PaymentSchema.index({ userId: 1, status: 1, createdAt: -1 });

export const PaymentModel = mongoose.model<IPayment>('Payment', PaymentSchema);

export interface IPromotion extends Document {
  listingId: Types.ObjectId;
  sellerId: Types.ObjectId;
  paymentId?: Types.ObjectId;
  type: 'top_ad' | 'featured' | 'urgent' | 'bump_up';
  priceKobo: number;
  startsAt: Date;
  expiresAt: Date;
  active: boolean;
}

const PromotionSchema = new Schema<IPromotion>(
  {
    listingId: { type: Schema.Types.ObjectId, ref: 'Listing', required: true },
    sellerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    paymentId: { type: Schema.Types.ObjectId, ref: 'Payment' },
    type: { type: String, enum: ['top_ad', 'featured', 'urgent', 'bump_up'], required: true },
    priceKobo: { type: Number, required: true },
    startsAt: { type: Date, default: () => new Date() },
    expiresAt: { type: Date, required: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

PromotionSchema.index({ listingId: 1, type: 1, expiresAt: 1 });

export const PromotionModel = mongoose.model<IPromotion>('Promotion', PromotionSchema);

export interface ISubscription extends Document {
  dealerId: Types.ObjectId;
  userId: Types.ObjectId;
  planTier: 'starter' | 'pro' | 'premier';
  priceKobo: number;
  status: 'active' | 'expired' | 'cancelled';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
}

const SubscriptionSchema = new Schema<ISubscription>(
  {
    dealerId: { type: Schema.Types.ObjectId, ref: 'DealerProfile', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    planTier: { type: String, enum: ['starter', 'pro', 'premier'], required: true },
    priceKobo: { type: Number, required: true },
    status: { type: String, enum: ['active', 'expired', 'cancelled'], default: 'active' },
    currentPeriodStart: { type: Date, default: () => new Date() },
    currentPeriodEnd: { type: Date, required: true },
  },
  { timestamps: true },
);

SubscriptionSchema.index({ dealerId: 1, status: 1, currentPeriodEnd: 1 });

export const SubscriptionModel = mongoose.model<ISubscription>('Subscription', SubscriptionSchema);

export interface IAuditLog extends Document {
  actorId: Types.ObjectId;
  action: string;
  entityType: string;
  entityId: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  ip?: string;
  createdAt: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    actorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    action: { type: String, required: true },
    entityType: { type: String, required: true },
    entityId: { type: String, required: true },
    before: { type: Schema.Types.Mixed },
    after: { type: Schema.Types.Mixed },
    ip: { type: String },
  },
  { timestamps: true },
);

AuditLogSchema.index({ actorId: 1, createdAt: -1 });
AuditLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });

export const AuditLogModel = mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);

export interface IConfigEntry extends Document {
  key: string;
  value: unknown;
  updatedBy?: Types.ObjectId;
  updatedAt: Date;
}

const ConfigEntrySchema = new Schema<IConfigEntry>(
  {
    key: { type: String, required: true, unique: true },
    value: { type: Schema.Types.Mixed, required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

export const ConfigEntryModel = mongoose.model<IConfigEntry>('ConfigEntry', ConfigEntrySchema);

