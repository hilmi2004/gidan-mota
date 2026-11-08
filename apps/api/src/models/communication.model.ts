import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface IConversation extends Document {
  listingId: Types.ObjectId;
  buyerId: Types.ObjectId;
  sellerId: Types.ObjectId;
  isSettlementChat: boolean;
  lastMessageAt: Date;
  lastMessagePreview: string;
  buyerUnread: number;
  sellerUnread: number;
  firstBuyerMessageAt?: Date;
  firstSellerReplyAt?: Date;
  inspectionProposal?: {
    proposedBy: Types.ObjectId;
    location: string;
    scheduledAt: Date;
    status: 'proposed' | 'accepted' | 'declined';
  };
  createdAt: Date;
  updatedAt: Date;
}

const ConversationSchema = new Schema<IConversation>(
  {
    listingId: { type: Schema.Types.ObjectId, ref: 'Listing', required: true },
    buyerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    sellerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    isSettlementChat: { type: Boolean, default: false },
    lastMessageAt: { type: Date, default: () => new Date() },
    lastMessagePreview: { type: String, default: '' },
    buyerUnread: { type: Number, default: 0 },
    sellerUnread: { type: Number, default: 0 },
    firstBuyerMessageAt: { type: Date },
    firstSellerReplyAt: { type: Date },
    inspectionProposal: {
      proposedBy: { type: Schema.Types.ObjectId, ref: 'User' },
      location: { type: String },
      scheduledAt: { type: Date },
      status: { type: String, enum: ['proposed', 'accepted', 'declined'] },
    },
  },
  { timestamps: true },
);

ConversationSchema.index({ listingId: 1, buyerId: 1, sellerId: 1 }, { unique: true });
ConversationSchema.index({ buyerId: 1, lastMessageAt: -1 });
ConversationSchema.index({ sellerId: 1, lastMessageAt: -1 });

export const ConversationModel = mongoose.model<IConversation>('Conversation', ConversationSchema);

export interface IMessage extends Document {
  conversationId: Types.ObjectId;
  senderId: Types.ObjectId;
  type: 'text' | 'image' | 'offer' | 'inspection' | 'system';
  body: string;
  mediaUrl?: string;
  offerId?: Types.ObjectId;
  readAt?: Date | null;
  createdAt: Date;
}

const MessageSchema = new Schema<IMessage>(
  {
    conversationId: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true },
    senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: {
      type: String,
      enum: ['text', 'image', 'offer', 'inspection', 'system'],
      default: 'text',
    },
    body: { type: String, required: true },
    mediaUrl: { type: String },
    offerId: { type: Schema.Types.ObjectId, ref: 'Offer' },
    readAt: { type: Date, default: null },
  },
  { timestamps: true },
);

MessageSchema.index({ conversationId: 1, createdAt: 1 });

export const MessageModel = mongoose.model<IMessage>('Message', MessageSchema);

export interface IOffer extends Document {
  conversationId: Types.ObjectId;
  listingId: Types.ObjectId;
  buyerId: Types.ObjectId;
  sellerId: Types.ObjectId;
  amountKobo: number;
  counterAmountKobo?: number;
  status: 'pending' | 'accepted' | 'declined' | 'countered' | 'expired';
  createdAt: Date;
  updatedAt: Date;
}

const OfferSchema = new Schema<IOffer>(
  {
    conversationId: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true },
    listingId: { type: Schema.Types.ObjectId, ref: 'Listing', required: true },
    buyerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    sellerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    amountKobo: { type: Number, required: true },
    counterAmountKobo: { type: Number },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'declined', 'countered', 'expired'],
      default: 'pending',
    },
  },
  { timestamps: true },
);

OfferSchema.index({ conversationId: 1, createdAt: -1 });
OfferSchema.index({ listingId: 1, status: 1 });

export const OfferModel = mongoose.model<IOffer>('Offer', OfferSchema);

export interface IReview extends Document {
  reviewerId: Types.ObjectId;
  sellerId: Types.ObjectId;
  listingId: Types.ObjectId;
  interactionType: 'chat' | 'auction';
  interactionRefId: Types.ObjectId;
  rating: number;
  comment: string;
  createdAt: Date;
}

const ReviewSchema = new Schema<IReview>(
  {
    reviewerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    sellerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    listingId: { type: Schema.Types.ObjectId, ref: 'Listing', required: true },
    interactionType: { type: String, enum: ['chat', 'auction'], required: true },
    interactionRefId: { type: Schema.Types.ObjectId, required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, required: true, maxlength: 1000 },
  },
  { timestamps: true },
);

ReviewSchema.index({ reviewerId: 1, interactionType: 1, interactionRefId: 1 }, { unique: true });
ReviewSchema.index({ sellerId: 1, createdAt: -1 });

export const ReviewModel = mongoose.model<IReview>('Review', ReviewSchema);

export interface IReport extends Document {
  reporterId: Types.ObjectId;
  targetType: 'listing' | 'user' | 'message';
  targetId: Types.ObjectId;
  reason: string;
  details?: string;
  status: 'pending' | 'resolved' | 'dismissed';
  resolvedBy?: Types.ObjectId;
  resolvedAt?: Date;
  createdAt: Date;
}

const ReportSchema = new Schema<IReport>(
  {
    reporterId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    targetType: { type: String, enum: ['listing', 'user', 'message'], required: true },
    targetId: { type: Schema.Types.ObjectId, required: true },
    reason: { type: String, required: true },
    details: { type: String },
    status: { type: String, enum: ['pending', 'resolved', 'dismissed'], default: 'pending' },
    resolvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    resolvedAt: { type: Date },
  },
  { timestamps: true },
);

ReportSchema.index({ targetType: 1, targetId: 1, reporterId: 1 }, { unique: true });
ReportSchema.index({ status: 1, createdAt: -1 });

export const ReportModel = mongoose.model<IReport>('Report', ReportSchema);

export interface INotification extends Document {
  userId: Types.ObjectId;
  type: string;
  title: string;
  body: string;
  actionUrl?: string;
  readAt?: Date | null;
  createdAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, required: true },
    title: { type: String, required: true },
    body: { type: String, required: true },
    actionUrl: { type: String },
    readAt: { type: Date, default: null },
  },
  { timestamps: true },
);

NotificationSchema.index({ userId: 1, readAt: 1, createdAt: -1 });

export const NotificationModel = mongoose.model<INotification>('Notification', NotificationSchema);

