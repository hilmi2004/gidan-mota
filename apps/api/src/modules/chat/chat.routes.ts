import mongoose from 'mongoose';
import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { SAFE_INSPECTION_LOCATIONS, formatKobo } from '@autodey/shared';
import { requireAuth } from '../../middleware/auth.js';
import { AppError, validateBody } from '../../middleware/errors.js';
import {
  ConversationModel,
  ListingModel,
  MessageModel,
  OfferModel,
  UserModel,
} from '../../models/index.js';
import { dispatchNotification } from '../notifications/notifications.service.js';
import { ioServer } from '../../server.js';

export const chatRouter = Router();

const StartConversationSchema = z.object({
  listingId: z.string().min(1),
  initialMessage: z.string().min(1).max(2000).optional(),
});

const SendMessageSchema = z.object({
  type: z.enum(['text', 'image']).default('text'),
  body: z.string().min(1).max(2000),
  mediaUrl: z.string().url().optional(),
});

const CreateOfferSchema = z.object({
  amountKobo: z.number().int().min(1_000_000, 'Minimum offer is ₦10,000'),
});

const RespondOfferSchema = z.object({
  action: z.enum(['accept', 'decline', 'counter']),
  counterAmountKobo: z.number().int().min(1_000_000).optional(),
});

const ProposeInspectionSchema = z.object({
  location: z.string().min(5).max(200),
  scheduledAt: z.string().min(1),
});

const RespondInspectionSchema = z.object({
  status: z.enum(['accepted', 'declined']),
});

function emitChatEvent(conversationId: string, event: string, payload: unknown): void {
  try {
    ioServer?.of('/chat').to(`conversation:${conversationId}`).emit(event, payload);
  } catch {
    // Ignore socket emit error in test mode
  }
}

// ============================================================================
// START OR GET CONVERSATION FOR A LISTING
// ============================================================================
chatRouter.post(
  '/conversations',
  requireAuth,
  validateBody(StartConversationSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const buyerId = req.user!.sub;
      const { listingId, initialMessage } = req.body as {
        listingId: string;
        initialMessage?: string;
      };

      if (!mongoose.isValidObjectId(listingId)) {
        throw AppError.badRequest('INVALID_LISTING_ID', 'Invalid listing ID.');
      }

      const listing = await ListingModel.findById(listingId);
      if (!listing) {
        throw AppError.notFound('LISTING_NOT_FOUND', 'Vehicle listing not found.');
      }

      const sellerId = listing.sellerId.toString();
      if (buyerId === sellerId) {
        throw AppError.badRequest('SELF_CHAT_NOT_ALLOWED', 'You cannot start a chat on your own listing.');
      }

      let conv = await ConversationModel.findOne({
        listingId: listing._id,
        buyerId,
        sellerId: listing.sellerId,
      });

      let isNew = false;
      if (!conv) {
        isNew = true;
        conv = await ConversationModel.create({
          listingId: listing._id,
          buyerId,
          sellerId: listing.sellerId,
          isSettlementChat: false,
          lastMessageAt: new Date(),
          lastMessagePreview: initialMessage || 'Started a conversation',
          buyerUnread: 0,
          sellerUnread: initialMessage ? 1 : 0,
          firstBuyerMessageAt: new Date(),
        });

        await Promise.all([
          ListingModel.findByIdAndUpdate(listing._id, { $inc: { 'stats.chatStarts': 1 } }),
          UserModel.findByIdAndUpdate(listing.sellerId, {
            $inc: { 'responseStats.totalConversations': 1 },
          }),
        ]);
      }

      if (initialMessage) {
        await MessageModel.create({
          conversationId: conv._id,
          senderId: buyerId,
          type: 'text',
          body: initialMessage,
        });
        conv.lastMessageAt = new Date();
        conv.lastMessagePreview = initialMessage;
        conv.sellerUnread += isNew ? 0 : 1;
        await conv.save();

        await dispatchNotification({
          userId: sellerId,
          type: 'new_message',
          title: `New inquiry on ${listing.title}`,
          body: initialMessage,
          actionUrl: `/chat?conversationId=${conv._id.toString()}`,
        });
      }

      res.status(isNew ? 201 : 200).json({
        conversation: {
          id: conv._id.toString(),
          listingId: conv.listingId.toString(),
          buyerId: conv.buyerId.toString(),
          sellerId: conv.sellerId.toString(),
          lastMessageAt: conv.lastMessageAt.toISOString(),
          lastMessagePreview: conv.lastMessagePreview,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

// ============================================================================
// LIST USER CONVERSATIONS
// ============================================================================
chatRouter.get(
  '/conversations',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.sub;
      const convs = await ConversationModel.find({
        $or: [{ buyerId: userId }, { sellerId: userId }],
      })
        .sort({ lastMessageAt: -1 })
        .populate('listingId', 'title slug state lga priceKobo coverPhotoUrl status')
        .populate('buyerId', 'displayName avatarUrl verification')
        .populate('sellerId', 'displayName avatarUrl verification responseStats')
        .lean();

      const items = convs.map((c) => {
        const isBuyer =
          c.buyerId &&
          typeof c.buyerId === 'object' &&
          '_id' in c.buyerId &&
          (c.buyerId as { _id: mongoose.Types.ObjectId })._id.toString() === userId;

        const counterparty = (isBuyer ? c.sellerId : c.buyerId) as unknown as {
          _id: mongoose.Types.ObjectId;
          displayName: string;
          avatarUrl?: string;
          verification: {
            phoneVerified: boolean;
            idVerified: boolean;
            dealerVerified: boolean;
          };
        } | null;

        const listing = c.listingId as unknown as {
          _id: mongoose.Types.ObjectId;
          title: string;
          slug: string;
          state: string;
          lga: string;
          priceKobo: number;
          coverPhotoUrl: string;
          status: string;
        } | null;

        return {
          id: c._id.toString(),
          isSettlementChat: c.isSettlementChat,
          lastMessageAt: c.lastMessageAt.toISOString(),
          lastMessagePreview: c.lastMessagePreview,
          unreadCount: isBuyer ? c.buyerUnread : c.sellerUnread,
          roleInChat: isBuyer ? 'buyer' : 'seller',
          inspectionProposal: c.inspectionProposal ?? null,
          counterparty: counterparty
            ? {
                id: counterparty._id.toString(),
                displayName: counterparty.displayName,
                avatarUrl: counterparty.avatarUrl,
                badges: counterparty.verification,
              }
            : null,
          listing: listing
            ? {
                id: listing._id.toString(),
                title: listing.title,
                slug: listing.slug,
                state: listing.state,
                lga: listing.lga,
                priceKobo: listing.priceKobo,
                coverPhotoUrl: listing.coverPhotoUrl,
                status: listing.status,
              }
            : null,
        };
      });

      res.status(200).json({ items });
    } catch (err) {
      next(err);
    }
  },
);

// ============================================================================
// GET MESSAGES, OFFERS & SAFE INSPECTION LOCATIONS FOR A CONVERSATION
// ============================================================================
chatRouter.get(
  '/conversations/:id/messages',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.sub;
      const conv = await ConversationModel.findById(req.params.id).populate(
        'listingId',
        'title slug state lga priceKobo negotiable coverPhotoUrl status',
      );
      if (!conv) {
        throw AppError.notFound('CONVERSATION_NOT_FOUND', 'Conversation not found.');
      }

      const isBuyer = conv.buyerId.toString() === userId;
      const isSeller = conv.sellerId.toString() === userId;
      if (!isBuyer && !isSeller) {
        throw AppError.forbidden('NOT_PARTICIPANT', 'You are not a participant in this chat.');
      }

      // Mark unread messages from counterparty as read
      await MessageModel.updateMany(
        { conversationId: conv._id, senderId: { $ne: userId }, readAt: null },
        { $set: { readAt: new Date() } },
      );

      if (isBuyer && conv.buyerUnread > 0) {
        conv.buyerUnread = 0;
        await conv.save();
      } else if (isSeller && conv.sellerUnread > 0) {
        conv.sellerUnread = 0;
        await conv.save();
      }

      const [messages, offers] = await Promise.all([
        MessageModel.find({ conversationId: conv._id }).sort({ createdAt: 1 }).limit(200).lean(),
        OfferModel.find({ conversationId: conv._id }).sort({ createdAt: -1 }).lean(),
      ]);

      const listingObj = conv.listingId as unknown as { state?: string } | null;
      const stateKey = listingObj?.state || 'Default';
      const safeLocations =
        SAFE_INSPECTION_LOCATIONS[stateKey] ?? SAFE_INSPECTION_LOCATIONS.Default ?? [];

      emitChatEvent(conv._id.toString(), 'messages_read', {
        conversationId: conv._id.toString(),
        readerId: userId,
        readAt: new Date().toISOString(),
      });

      res.status(200).json({
        conversationId: conv._id.toString(),
        buyerId: conv.buyerId.toString(),
        sellerId: conv.sellerId.toString(),
        inspectionProposal: conv.inspectionProposal ?? null,
        safeLocations,
        messages: messages.map((m) => ({
          id: m._id.toString(),
          senderId: m.senderId.toString(),
          type: m.type,
          body: m.body,
          mediaUrl: m.mediaUrl,
          offerId: m.offerId ? m.offerId.toString() : undefined,
          readAt: m.readAt ? m.readAt.toISOString() : null,
          createdAt: m.createdAt.toISOString(),
        })),
        offers: offers.map((o) => ({
          id: o._id.toString(),
          buyerId: o.buyerId.toString(),
          sellerId: o.sellerId.toString(),
          amountKobo: o.amountKobo,
          counterAmountKobo: o.counterAmountKobo,
          status: o.status,
          createdAt: o.createdAt.toISOString(),
        })),
      });
    } catch (err) {
      next(err);
    }
  },
);

// ============================================================================
// SEND MESSAGE (Updates Seller Response-Time Metric on First Reply)
// ============================================================================
chatRouter.post(
  '/conversations/:id/messages',
  requireAuth,
  validateBody(SendMessageSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.sub;
      const conv = await ConversationModel.findById(req.params.id);
      if (!conv) {
        throw AppError.notFound('CONVERSATION_NOT_FOUND', 'Conversation not found.');
      }

      const isBuyer = conv.buyerId.toString() === userId;
      const isSeller = conv.sellerId.toString() === userId;
      if (!isBuyer && !isSeller) {
        throw AppError.forbidden('NOT_PARTICIPANT', 'You are not a participant in this chat.');
      }

      const { type, body, mediaUrl } = req.body as {
        type: 'text' | 'image';
        body: string;
        mediaUrl?: string;
      };

      const msg = await MessageModel.create({
        conversationId: conv._id,
        senderId: userId,
        type,
        body,
        mediaUrl,
      });

      conv.lastMessageAt = new Date();
      conv.lastMessagePreview = body.slice(0, 120);
      if (isBuyer) {
        conv.sellerUnread += 1;
      } else {
        conv.buyerUnread += 1;
      }

      // Compute seller response-time metric on first seller reply
      if (isSeller && !conv.firstSellerReplyAt && conv.firstBuyerMessageAt) {
        conv.firstSellerReplyAt = new Date();
        const replyMinutes = Math.max(
          1,
          Math.round((conv.firstSellerReplyAt.getTime() - conv.firstBuyerMessageAt.getTime()) / 60000),
        );
        const seller = await UserModel.findById(conv.sellerId);
        if (seller) {
          const prevResponded = seller.responseStats.respondedConversations || 0;
          const prevAvg = seller.responseStats.avgResponseMinutes || 8;
          const nextResponded = prevResponded + 1;
          const totalConvs = Math.max(nextResponded, seller.responseStats.totalConversations || 1);
          seller.responseStats.respondedConversations = nextResponded;
          seller.responseStats.ratePercent = Math.min(
            100,
            Math.round((nextResponded / totalConvs) * 100),
          );
          seller.responseStats.avgResponseMinutes = Math.round(
            (prevAvg * prevResponded + replyMinutes) / nextResponded,
          );
          await seller.save();
        }
      }

      await conv.save();

      const serialized = {
        id: msg._id.toString(),
        conversationId: conv._id.toString(),
        senderId: userId,
        type: msg.type,
        body: msg.body,
        mediaUrl: msg.mediaUrl,
        readAt: null,
        createdAt: msg.createdAt.toISOString(),
      };

      emitChatEvent(conv._id.toString(), 'new_message', serialized);

      const recipientId = isBuyer ? conv.sellerId.toString() : conv.buyerId.toString();
      await dispatchNotification({
        userId: recipientId,
        type: 'new_message',
        title: 'New chat message',
        body: msg.body.slice(0, 120),
        actionUrl: `/chat?conversationId=${conv._id.toString()}`,
      });

      res.status(201).json({ message: serialized });
    } catch (err) {
      next(err);
    }
  },
);

// ============================================================================
// STRUCTURED OFFERS IN CHAT (Make Offer, Accept, Decline, Counter)
// ============================================================================
chatRouter.post(
  '/conversations/:id/offers',
  requireAuth,
  validateBody(CreateOfferSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.sub;
      const conv = await ConversationModel.findById(req.params.id);
      if (!conv) {
        throw AppError.notFound('CONVERSATION_NOT_FOUND', 'Conversation not found.');
      }

      const isBuyer = conv.buyerId.toString() === userId;
      const isSeller = conv.sellerId.toString() === userId;
      if (!isBuyer && !isSeller) {
        throw AppError.forbidden();
      }

      const { amountKobo } = req.body as { amountKobo: number };

      const offer = await OfferModel.create({
        conversationId: conv._id,
        listingId: conv.listingId,
        buyerId: conv.buyerId,
        sellerId: conv.sellerId,
        amountKobo,
        status: 'pending',
      });

      const bodyText = `Structured Offer: ${formatKobo(amountKobo)}`;
      const msg = await MessageModel.create({
        conversationId: conv._id,
        senderId: userId,
        type: 'offer',
        body: bodyText,
        offerId: offer._id,
      });

      conv.lastMessageAt = new Date();
      conv.lastMessagePreview = bodyText;
      if (isBuyer) conv.sellerUnread += 1;
      else conv.buyerUnread += 1;
      await conv.save();

      emitChatEvent(conv._id.toString(), 'offer_updated', {
        offerId: offer._id.toString(),
        amountKobo: offer.amountKobo,
        status: offer.status,
      });

      const recipientId = isBuyer ? conv.sellerId.toString() : conv.buyerId.toString();
      await dispatchNotification({
        userId: recipientId,
        type: 'offer_received',
        title: `New Offer: ${formatKobo(amountKobo)}`,
        body: `A buyer offered ${formatKobo(amountKobo)} in chat.`,
        actionUrl: `/chat?conversationId=${conv._id.toString()}`,
      });

      res.status(201).json({
        offer: {
          id: offer._id.toString(),
          amountKobo: offer.amountKobo,
          status: offer.status,
          createdAt: offer.createdAt.toISOString(),
        },
        messageId: msg._id.toString(),
      });
    } catch (err) {
      next(err);
    }
  },
);

chatRouter.patch(
  '/offers/:id',
  requireAuth,
  validateBody(RespondOfferSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.sub;
      const offer = await OfferModel.findById(req.params.id);
      if (!offer) {
        throw AppError.notFound('OFFER_NOT_FOUND', 'Offer not found.');
      }

      if (offer.sellerId.toString() !== userId && offer.buyerId.toString() !== userId) {
        throw AppError.forbidden();
      }

      const { action, counterAmountKobo } = req.body as {
        action: 'accept' | 'decline' | 'counter';
        counterAmountKobo?: number;
      };

      let summaryText = '';
      if (action === 'accept') {
        offer.status = 'accepted';
        summaryText = `Offer Accepted at ${formatKobo(offer.counterAmountKobo ?? offer.amountKobo)}`;
      } else if (action === 'decline') {
        offer.status = 'declined';
        summaryText = `Offer Declined (${formatKobo(offer.amountKobo)})`;
      } else {
        if (!counterAmountKobo) {
          throw AppError.badRequest('COUNTER_AMOUNT_REQUIRED', 'Enter a counter-offer amount.');
        }
        offer.status = 'countered';
        offer.counterAmountKobo = counterAmountKobo;
        summaryText = `Counter-Offer Proposed: ${formatKobo(counterAmountKobo)}`;
      }

      await offer.save();

      await MessageModel.create({
        conversationId: offer.conversationId,
        senderId: userId,
        type: 'offer',
        body: summaryText,
        offerId: offer._id,
      });

      await ConversationModel.findByIdAndUpdate(offer.conversationId, {
        $set: { lastMessageAt: new Date(), lastMessagePreview: summaryText },
      });

      emitChatEvent(offer.conversationId.toString(), 'offer_updated', {
        offerId: offer._id.toString(),
        status: offer.status,
        counterAmountKobo: offer.counterAmountKobo,
      });

      const recipientId =
        offer.sellerId.toString() === userId
          ? offer.buyerId.toString()
          : offer.sellerId.toString();

      await dispatchNotification({
        userId: recipientId,
        type: 'offer_responded',
        title: summaryText,
        body: summaryText,
        actionUrl: `/chat?conversationId=${offer.conversationId.toString()}`,
      });

      res.status(200).json({
        offer: {
          id: offer._id.toString(),
          amountKobo: offer.amountKobo,
          counterAmountKobo: offer.counterAmountKobo,
          status: offer.status,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

// ============================================================================
// SAFE INSPECTION SCHEDULER IN CHAT
// ============================================================================
chatRouter.post(
  '/conversations/:id/inspection',
  requireAuth,
  validateBody(ProposeInspectionSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.sub;
      const conv = await ConversationModel.findById(req.params.id);
      if (!conv) {
        throw AppError.notFound('CONVERSATION_NOT_FOUND', 'Conversation not found.');
      }

      const isParticipant =
        conv.buyerId.toString() === userId || conv.sellerId.toString() === userId;
      if (!isParticipant) {
        throw AppError.forbidden();
      }

      const { location, scheduledAt } = req.body as { location: string; scheduledAt: string };
      const parsedDate = new Date(scheduledAt);
      if (Number.isNaN(parsedDate.getTime())) {
        throw AppError.badRequest('INVALID_DATE', 'Provide a valid inspection date and time.');
      }

      conv.inspectionProposal = {
        proposedBy: new mongoose.Types.ObjectId(userId),
        location,
        scheduledAt: parsedDate,
        status: 'proposed',
      };
      const bodyText = `Inspection Proposed: ${location} on ${parsedDate.toLocaleString('en-NG')}`;
      conv.lastMessageAt = new Date();
      conv.lastMessagePreview = bodyText;
      await conv.save();

      await MessageModel.create({
        conversationId: conv._id,
        senderId: userId,
        type: 'inspection',
        body: bodyText,
      });

      emitChatEvent(conv._id.toString(), 'inspection_updated', conv.inspectionProposal);

      const recipientId =
        conv.buyerId.toString() === userId ? conv.sellerId.toString() : conv.buyerId.toString();
      await dispatchNotification({
        userId: recipientId,
        type: 'inspection_proposed',
        title: 'Vehicle Inspection Proposed',
        body: bodyText,
        actionUrl: `/chat?conversationId=${conv._id.toString()}`,
      });

      res.status(201).json({
        inspectionProposal: conv.inspectionProposal,
      });
    } catch (err) {
      next(err);
    }
  },
);

chatRouter.patch(
  '/conversations/:id/inspection',
  requireAuth,
  validateBody(RespondInspectionSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.sub;
      const conv = await ConversationModel.findById(req.params.id);
      if (!conv || !conv.inspectionProposal) {
        throw AppError.notFound('INSPECTION_NOT_FOUND', 'No inspection proposal found.');
      }

      const { status } = req.body as { status: 'accepted' | 'declined' };
      conv.inspectionProposal.status = status;
      const bodyText = `Inspection ${status.toUpperCase()}: ${conv.inspectionProposal.location}`;
      conv.lastMessageAt = new Date();
      conv.lastMessagePreview = bodyText;
      await conv.save();

      await MessageModel.create({
        conversationId: conv._id,
        senderId: userId,
        type: 'inspection',
        body: bodyText,
      });

      emitChatEvent(conv._id.toString(), 'inspection_updated', conv.inspectionProposal);

      res.status(200).json({ inspectionProposal: conv.inspectionProposal });
    } catch (err) {
      next(err);
    }
  },
);

