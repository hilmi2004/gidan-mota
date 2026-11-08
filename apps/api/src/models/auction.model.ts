import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface IAuctionLeader {
  userId: Types.ObjectId;
  proxyMax: number; // NEVER serialized to public responses
  placedAt: Date;
}

export interface IAuction extends Document {
  _id: Types.ObjectId;
  listingId: Types.ObjectId;
  sellerId: Types.ObjectId;
  status:
    | 'draft'
    | 'pending_review'
    | 'scheduled'
    | 'live'
    | 'sold_pending_settlement'
    | 'ended_reserve_not_met'
    | 'settled'
    | 'cancelled'
    | 'disputed';
  startPrice: number; // integer kobo
  currentPrice: number; // integer kobo
  reservePrice?: number | null; // integer kobo, hidden from public
  reserveMet: boolean;
  buyNowPrice?: number | null; // integer kobo
  startsAt: Date;
  endsAt: Date;
  originalEndsAt: Date;
  extensions: number;
  bidCount: number;
  leader: IAuctionLeader | null;
  watchers: Types.ObjectId[];
  settlementMode: 'DIRECT' | 'HOLD';
  createdAt: Date;
  updatedAt: Date;
}

const AuctionSchema = new Schema<IAuction>(
  {
    listingId: { type: Schema.Types.ObjectId, ref: 'Listing', required: true, unique: true },
    sellerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: {
      type: String,
      enum: [
        'draft',
        'pending_review',
        'scheduled',
        'live',
        'sold_pending_settlement',
        'ended_reserve_not_met',
        'settled',
        'cancelled',
        'disputed',
      ],
      default: 'live',
    },
    startPrice: { type: Number, required: true },
    currentPrice: { type: Number, required: true },
    reservePrice: { type: Number, default: null },
    reserveMet: { type: Boolean, default: false },
    buyNowPrice: { type: Number, default: null },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    originalEndsAt: { type: Date, required: true },
    extensions: { type: Number, default: 0 },
    bidCount: { type: Number, default: 0 },
    leader: {
      type: {
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        proxyMax: { type: Number, required: true },
        placedAt: { type: Date, required: true },
      },
      default: null,
    },
    watchers: { type: [{ type: Schema.Types.ObjectId, ref: 'User' }], default: [] },
    /**
     * Settlement mode:
     * - DIRECT (default): Buyer and seller complete the vehicle purchase directly; platform holds only the refundable bidding deposit.
     * - HOLD (admin-flagged placeholder): A legally compliant CBN-licensed escrow partner must be integrated before enabling HOLD publicly.
     */
    settlementMode: { type: String, enum: ['DIRECT', 'HOLD'], default: 'DIRECT' },
  },
  {
    timestamps: true,
    optimisticConcurrency: true,
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        delete ret.reservePrice;
        if (ret.leader && typeof ret.leader === 'object') {
          const leaderCopy = { ...(ret.leader as Record<string, unknown>) };
          delete leaderCopy.proxyMax;
          ret.leader = leaderCopy;
        }
        return ret;
      },
    },
  },
);

AuctionSchema.index({ status: 1, endsAt: 1 });
AuctionSchema.index({ sellerId: 1, status: 1 });

export const AuctionModel = mongoose.model<IAuction>('Auction', AuctionSchema);

export interface IBid extends Document {
  auctionId: Types.ObjectId;
  bidderId: Types.ObjectId;
  maskedBidderName: string;
  amountKobo: number;
  type: 'manual' | 'proxy' | 'buy_now';
  ipHash?: string;
  deviceFingerprintHash?: string;
  sequence: number;
  createdAt: Date;
}

const BidSchema = new Schema<IBid>(
  {
    auctionId: { type: Schema.Types.ObjectId, ref: 'Auction', required: true },
    bidderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    maskedBidderName: { type: String, required: true },
    amountKobo: { type: Number, required: true },
    type: { type: String, enum: ['manual', 'proxy', 'buy_now'], required: true },
    ipHash: { type: String },
    deviceFingerprintHash: { type: String },
    sequence: { type: Number, required: true },
  },
  { timestamps: true },
);

BidSchema.index({ auctionId: 1, sequence: -1, createdAt: -1 });
BidSchema.index({ bidderId: 1, createdAt: -1 });

export const BidModel = mongoose.model<IBid>('Bid', BidSchema);

export interface IAuctionAuditLog extends Document {
  auctionId: Types.ObjectId;
  bidderId: Types.ObjectId;
  eventType: 'bid_placed' | 'max_updated' | 'reserve_met' | 'soft_close_extended' | 'admin_action';
  submittedMaxKobo?: number;
  resultingPriceKobo: number;
  ipHash?: string;
  deviceFingerprintHash?: string;
  notes?: string;
  createdAt: Date;
}

const AuctionAuditLogSchema = new Schema<IAuctionAuditLog>(
  {
    auctionId: { type: Schema.Types.ObjectId, ref: 'Auction', required: true },
    bidderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    eventType: {
      type: String,
      enum: ['bid_placed', 'max_updated', 'reserve_met', 'soft_close_extended', 'admin_action'],
      required: true,
    },
    submittedMaxKobo: { type: Number },
    resultingPriceKobo: { type: Number, required: true },
    ipHash: { type: String },
    deviceFingerprintHash: { type: String },
    notes: { type: String },
  },
  { timestamps: true },
);

AuctionAuditLogSchema.index({ auctionId: 1, createdAt: 1 });

export const AuctionAuditLogModel = mongoose.model<IAuctionAuditLog>(
  'AuctionAuditLog',
  AuctionAuditLogSchema,
);

export interface ISettlement extends Document {
  auctionId: Types.ObjectId;
  listingId: Types.ObjectId;
  sellerId: Types.ObjectId;
  winnerId: Types.ObjectId;
  hammerPriceKobo: number;
  platformFeeKobo: number;
  mode: 'DIRECT' | 'HOLD';
  status:
    | 'pending'
    | 'buyer_confirmed'
    | 'seller_confirmed'
    | 'completed'
    | 'buyer_defaulted'
    | 'seller_cancelled'
    | 'disputed';
  buyerConfirmedAt?: Date;
  sellerConfirmedAt?: Date;
  deadlineAt: Date;
  conversationId?: Types.ObjectId;
  postAuctionOffer?: {
    amountKobo: number;
    counterAmountKobo?: number;
    status: 'offered' | 'accepted' | 'countered' | 'declined';
  };
  createdAt: Date;
  updatedAt: Date;
}

const SettlementSchema = new Schema<ISettlement>(
  {
    auctionId: { type: Schema.Types.ObjectId, ref: 'Auction', required: true, unique: true },
    listingId: { type: Schema.Types.ObjectId, ref: 'Listing', required: true },
    sellerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    winnerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    hammerPriceKobo: { type: Number, required: true },
    platformFeeKobo: { type: Number, required: true },
    mode: { type: String, enum: ['DIRECT', 'HOLD'], default: 'DIRECT' },
    status: {
      type: String,
      enum: [
        'pending',
        'buyer_confirmed',
        'seller_confirmed',
        'completed',
        'buyer_defaulted',
        'seller_cancelled',
        'disputed',
      ],
      default: 'pending',
    },
    buyerConfirmedAt: { type: Date },
    sellerConfirmedAt: { type: Date },
    deadlineAt: { type: Date, required: true },
    conversationId: { type: Schema.Types.ObjectId, ref: 'Conversation' },
    postAuctionOffer: {
      amountKobo: { type: Number },
      counterAmountKobo: { type: Number },
      status: { type: String, enum: ['offered', 'accepted', 'countered', 'declined'] },
    },
  },
  { timestamps: true },
);

SettlementSchema.index({ status: 1, deadlineAt: 1 });

export const SettlementModel = mongoose.model<ISettlement>('Settlement', SettlementSchema);

export interface IDispute extends Document {
  settlementId: Types.ObjectId;
  auctionId: Types.ObjectId;
  openedBy: Types.ObjectId;
  reason: string;
  details: string;
  status: 'open' | 'resolved';
  outcome?: 'forfeit_deposit' | 'refund_deposit' | 'ban_user' | 'no_action';
  adminNotes?: string;
  resolvedBy?: Types.ObjectId;
  resolvedAt?: Date;
  createdAt: Date;
}

const DisputeSchema = new Schema<IDispute>(
  {
    settlementId: { type: Schema.Types.ObjectId, ref: 'Settlement', required: true, index: true },
    auctionId: { type: Schema.Types.ObjectId, ref: 'Auction', required: true },
    openedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    reason: { type: String, required: true },
    details: { type: String, required: true },
    status: { type: String, enum: ['open', 'resolved'], default: 'open' },
    outcome: {
      type: String,
      enum: ['forfeit_deposit', 'refund_deposit', 'ban_user', 'no_action'],
    },
    adminNotes: { type: String },
    resolvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    resolvedAt: { type: Date },
  },
  { timestamps: true },
);

DisputeSchema.index({ status: 1, createdAt: -1 });

export const DisputeModel = mongoose.model<IDispute>('Dispute', DisputeSchema);

