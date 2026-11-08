import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { io, type Socket } from 'socket.io-client';
import {
  Calendar,
  Check,
  CheckCheck,
  DollarSign,
  MapPin,
  MessageSquare,
  Send,
  ShieldCheck,
} from 'lucide-react';
import { formatKobo, nairaToKobo } from '@autodey/shared';
import {
  Avatar,
  Badge,
  Button,
  Card,
  Chip,
  EmptyState,
  Input,
  Modal,
  PriceTag,
  Select,
  Skeleton,
  useToast,
} from '../../components/ui';
import { apiRequest } from '../../lib/api';
import { useAppStore } from '../../stores/useAppStore';

interface ConversationListItem {
  id: string;
  isSettlementChat: boolean;
  lastMessageAt: string;
  lastMessagePreview: string;
  unreadCount: number;
  roleInChat: 'buyer' | 'seller';
  inspectionProposal: {
    proposedBy: string;
    location: string;
    scheduledAt: string;
    status: 'proposed' | 'accepted' | 'declined';
  } | null;
  counterparty: {
    id: string;
    displayName: string;
    avatarUrl?: string;
    badges: {
      phoneVerified: boolean;
      idVerified: boolean;
      dealerVerified: boolean;
    };
  } | null;
  listing: {
    id: string;
    title: string;
    slug: string;
    state: string;
    lga: string;
    priceKobo: number;
    coverPhotoUrl: string;
    status: string;
  } | null;
}

interface ChatMessageItem {
  id: string;
  senderId: string;
  type: 'text' | 'image' | 'offer' | 'inspection' | 'system';
  body: string;
  mediaUrl?: string;
  offerId?: string;
  readAt: string | null;
  createdAt: string;
}

interface OfferItem {
  id: string;
  buyerId: string;
  sellerId: string;
  amountKobo: number;
  counterAmountKobo?: number;
  status: 'pending' | 'accepted' | 'declined' | 'countered' | 'expired';
  createdAt: string;
}

const QUICK_REPLIES = [
  'Is it still available?',
  'What is your last price?',
  'Can I inspect it today?',
  'Are full customs duty papers available?',
];

export const ChatPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { pushToast } = useToast();
  const user = useAppStore((s) => s.user);

  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(
    searchParams.get('conversationId'),
  );
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [offers, setOffers] = useState<OfferItem[]>([]);
  const [safeLocations, setSafeLocations] = useState<string[]>([]);
  const [inspectionProposal, setInspectionProposal] =
    useState<ConversationListItem['inspectionProposal']>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);

  const [draftText, setDraftText] = useState('');
  const [sending, setSending] = useState(false);
  const [typingUser, setTypingUser] = useState<string | null>(null);

  // Offer Modal
  const [offerModalOpen, setOfferModalOpen] = useState(false);
  const [offerNaira, setOfferNaira] = useState('');
  const [counterModalOfferId, setCounterModalOfferId] = useState<string | null>(null);
  const [counterNaira, setCounterNaira] = useState('');

  // Inspection Scheduler Modal
  const [inspectionModalOpen, setInspectionModalOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState('');
  const [scheduledAt, setScheduledAt] = useState(() => {
    const tomorrow = new Date(Date.now() + 24 * 3600 * 1000);
    return tomorrow.toISOString().slice(0, 16);
  });

  const socketRef = useRef<Socket | null>(null);
  const threadBottomRef = useRef<HTMLDivElement | null>(null);

  const loadConversations = async () => {
    setLoadingList(true);
    try {
      const res = await apiRequest<{ items: ConversationListItem[] }>('/conversations');
      setConversations(res.items);
      if (!activeConvId && res.items[0]) {
        setActiveConvId(res.items[0].id);
      }
    } catch {
      setConversations([]);
    } finally {
      setLoadingList(false);
    }
  };

  const loadThread = async (convId: string) => {
    setLoadingThread(true);
    try {
      const res = await apiRequest<{
        messages: ChatMessageItem[];
        offers: OfferItem[];
        safeLocations: string[];
        inspectionProposal: ConversationListItem['inspectionProposal'];
      }>(`/conversations/${convId}/messages`);
      setMessages(res.messages);
      setOffers(res.offers);
      setSafeLocations(res.safeLocations);
      setSelectedLocation(res.safeLocations[0] || '');
      setInspectionProposal(res.inspectionProposal);
    } catch {
      setMessages([]);
    } finally {
      setLoadingThread(false);
    }
  };

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    void loadConversations();
  }, [user]);

  useEffect(() => {
    if (!activeConvId) return;
    setSearchParams({ conversationId: activeConvId }, { replace: true });
    void loadThread(activeConvId);

    const sock = io('/chat', { transports: ['websocket', 'polling'] });
    socketRef.current = sock;
    sock.emit('join_conversation', activeConvId);

    sock.on('new_message', (msg: ChatMessageItem) => {
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
    });

    sock.on('offer_updated', () => {
      void loadThread(activeConvId);
    });

    sock.on('inspection_updated', () => {
      void loadThread(activeConvId);
    });

    sock.on('user_typing', (payload: { userId: string; displayName: string }) => {
      if (payload.userId !== user?.id) {
        setTypingUser(payload.displayName);
        setTimeout(() => setTypingUser(null), 2500);
      }
    });

    return () => {
      sock.emit('leave_conversation', activeConvId);
      sock.disconnect();
    };
  }, [activeConvId]);

  useEffect(() => {
    threadBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const activeConversation = conversations.find((c) => c.id === activeConvId) ?? null;

  const handleSendMessage = async (textToSend?: string) => {
    const body = (textToSend ?? draftText).trim();
    if (!body || !activeConvId) return;
    setSending(true);
    try {
      const res = await apiRequest<{ message: ChatMessageItem }>(
        `/conversations/${activeConvId}/messages`,
        {
          method: 'POST',
          body: JSON.stringify({ type: 'text', body }),
        },
      );
      setMessages((prev) =>
        prev.some((m) => m.id === res.message.id) ? prev : [...prev, res.message],
      );
      if (!textToSend) setDraftText('');
    } catch (err) {
      pushToast({
        type: 'error',
        title: 'Message Failed',
        message: err instanceof Error ? err.message : 'Try again.',
      });
    } finally {
      setSending(false);
    }
  };

  const handleCreateOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeConvId || !offerNaira) return;
    try {
      await apiRequest(`/conversations/${activeConvId}/offers`, {
        method: 'POST',
        body: JSON.stringify({ amountKobo: nairaToKobo(Number(offerNaira)) }),
      });
      setOfferModalOpen(false);
      setOfferNaira('');
      await loadThread(activeConvId);
      pushToast({ type: 'success', title: 'Offer Sent to Seller' });
    } catch (err) {
      pushToast({
        type: 'error',
        title: 'Could Not Send Offer',
        message: err instanceof Error ? err.message : 'Invalid amount.',
      });
    }
  };

  const handleRespondOffer = async (
    offerId: string,
    action: 'accept' | 'decline' | 'counter',
    counterKobo?: number,
  ) => {
    if (!activeConvId) return;
    try {
      await apiRequest(`/offers/${offerId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          action,
          ...(counterKobo ? { counterAmountKobo: counterKobo } : {}),
        }),
      });
      setCounterModalOfferId(null);
      setCounterNaira('');
      await loadThread(activeConvId);
      pushToast({ type: 'success', title: `Offer ${action}ed` });
    } catch (err) {
      pushToast({
        type: 'error',
        title: 'Action Failed',
        message: err instanceof Error ? err.message : 'Unable to update offer.',
      });
    }
  };

  const handleProposeInspection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeConvId || !selectedLocation) return;
    try {
      await apiRequest(`/conversations/${activeConvId}/inspection`, {
        method: 'POST',
        body: JSON.stringify({
          location: selectedLocation,
          scheduledAt: new Date(scheduledAt).toISOString(),
        }),
      });
      setInspectionModalOpen(false);
      await loadThread(activeConvId);
      pushToast({
        type: 'success',
        title: 'Inspection Appointment Proposed',
        message: 'Public CCTV-covered location sent in chat.',
      });
    } catch (err) {
      pushToast({
        type: 'error',
        title: 'Could Not Schedule Inspection',
        message: err instanceof Error ? err.message : 'Check date and location.',
      });
    }
  };

  const handleRespondInspection = async (status: 'accepted' | 'declined') => {
    if (!activeConvId) return;
    await apiRequest(`/conversations/${activeConvId}/inspection`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    await loadThread(activeConvId);
    pushToast({ type: 'info', title: `Inspection ${status}` });
  };

  if (loadingList) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8 grid grid-cols-1 md:grid-cols-3 gap-6">
        <Skeleton className="h-[520px] w-full rounded-card" />
        <Skeleton className="md:col-span-2 h-[520px] w-full rounded-card" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {conversations.length === 0 ? (
        <EmptyState
          icon={<MessageSquare className="w-6 h-6" />}
          title="No active conversations yet"
          description="Open any vehicle listing and tap 'Chat Seller' to negotiate price or book a safe inspection."
          actionLabel="Browse Verified Cars"
          onAction={() => navigate('/search')}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
          {/* LEFT SIDEBAR: CONVERSATIONS */}
          <Card padding="none" className="md:col-span-4 overflow-hidden divide-y divide-line">
            <div className="p-4 bg-elevated/50">
              <h1 className="text-base font-bold text-ink">Messages & Offers</h1>
              <p className="text-xs text-ink-secondary">Direct buyer-seller connection</p>
            </div>

            <div className="max-h-[65vh] overflow-y-auto divide-y divide-line">
              {conversations.map((c) => {
                const isSelected = c.id === activeConvId;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setActiveConvId(c.id)}
                    className={`w-full text-left p-3.5 flex items-start gap-3 transition-colors ${
                      isSelected ? 'bg-brand-600/10' : 'hover:bg-elevated/60'
                    }`}
                  >
                    <Avatar
                      name={c.counterparty?.displayName || 'Seller'}
                      src={c.counterparty?.avatarUrl}
                      size="md"
                      verified={Boolean(
                        c.counterparty?.badges.idVerified || c.counterparty?.badges.dealerVerified,
                      )}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-ink truncate">
                          {c.counterparty?.displayName || 'Verified Member'}
                        </span>
                        {c.unreadCount > 0 && (
                          <span className="px-1.5 py-0.5 rounded-full bg-brand-600 text-white text-[10px] font-bold tabular-nums">
                            {c.unreadCount}
                          </span>
                        )}
                      </div>
                      {c.listing && (
                        <p className="text-[11px] font-medium text-brand-600 truncate">
                          {c.listing.title}
                        </p>
                      )}
                      <p className="text-xs text-ink-secondary truncate mt-0.5">
                        {c.lastMessagePreview}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>

          {/* RIGHT THREAD PANEL */}
          <Card padding="none" className="md:col-span-8 flex flex-col overflow-hidden">
            {/* Pinned Listing Header & Actions */}
            {activeConversation?.listing && (
              <div className="p-3.5 bg-surface border-b border-line flex flex-wrap items-center justify-between gap-3">
                <Link
                  to={`/cars/${activeConversation.listing.state.toLowerCase()}/${activeConversation.listing.slug}`}
                  className="flex items-center gap-3 min-w-0 group"
                >
                  <img
                    src={activeConversation.listing.coverPhotoUrl}
                    alt={activeConversation.listing.title}
                    className="w-14 h-11 rounded-control object-cover shrink-0 border border-line"
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-ink group-hover:text-brand-600 truncate">
                      {activeConversation.listing.title}
                    </p>
                    <div className="flex items-center gap-2">
                      <PriceTag kobo={activeConversation.listing.priceKobo} size="sm" />
                      <span className="text-[11px] text-ink-muted">
                        • {activeConversation.listing.lga}, {activeConversation.listing.state}
                      </span>
                    </div>
                  </div>
                </Link>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    leftIcon={<DollarSign className="w-3.5 h-3.5 text-brand-600" />}
                    onClick={() => {
                      setOfferNaira(
                        String(Math.round((activeConversation.listing!.priceKobo * 0.92) / 100)),
                      );
                      setOfferModalOpen(true);
                    }}
                  >
                    Make Offer
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    leftIcon={<Calendar className="w-3.5 h-3.5 text-brand-600" />}
                    onClick={() => setInspectionModalOpen(true)}
                  >
                    Book Inspection
                  </Button>
                </div>
              </div>
            )}

            {/* Calm Scam Safety Banner */}
            <div className="px-4 py-2 bg-elevated/70 border-b border-line flex items-center gap-2 text-xs text-ink-secondary">
              <ShieldCheck className="w-4 h-4 text-brand-600 shrink-0" />
              <span>
                <strong>Safety reminder:</strong> Never pay before physically seeing the car and
                verifying original customs papers in daylight.
              </span>
            </div>

            {/* Active Offer & Inspection Cards */}
            {(offers.length > 0 || inspectionProposal) && (
              <div className="px-4 py-3 bg-surface border-b border-line space-y-2">
                {offers[0] && (
                  <div className="p-3 rounded-control bg-elevated border border-line flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div>
                      <span className="font-semibold text-ink block">
                        Latest Offer:{' '}
                        <span className="font-mono tabular-nums">
                          {formatKobo(offers[0].counterAmountKobo ?? offers[0].amountKobo)}
                        </span>
                      </span>
                      <span className="text-ink-secondary uppercase text-[11px]">
                        Status: {offers[0].status}
                      </span>
                    </div>
                    {(offers[0].status === 'pending' || offers[0].status === 'countered') && (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleRespondOffer(offers[0]!.id, 'accept')}
                        >
                          Accept
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCounterModalOfferId(offers[0]!.id)}
                        >
                          Counter
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRespondOffer(offers[0]!.id, 'decline')}
                        >
                          Decline
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {inspectionProposal && (
                  <div className="p-3 rounded-control bg-emerald-500/10 border border-brand-500/30 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-brand-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold text-ink block">
                          Safe Meet-Up: {inspectionProposal.location}
                        </span>
                        <span className="text-ink-secondary">
                          {new Date(inspectionProposal.scheduledAt).toLocaleString('en-NG')} •{' '}
                          <strong>{inspectionProposal.status.toUpperCase()}</strong>
                        </span>
                      </div>
                    </div>
                    {inspectionProposal.status === 'proposed' && (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleRespondInspection('accepted')}
                        >
                          Confirm Meet-Up
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRespondInspection('declined')}
                        >
                          Decline
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Message History Stream */}
            <div className="p-4 h-[380px] overflow-y-auto space-y-3 bg-canvas/40">
              {loadingThread ? (
                <div className="space-y-3">
                  <Skeleton className="h-12 w-2/3" />
                  <Skeleton className="h-12 w-1/2 ml-auto" />
                </div>
              ) : (
                messages.map((msg) => {
                  const isMine = msg.senderId === user?.id;
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-card px-3.5 py-2.5 text-sm ${
                          msg.type === 'offer' || msg.type === 'inspection'
                            ? 'bg-emerald-500/15 text-ink border border-brand-500/30 font-medium'
                            : isMine
                              ? 'bg-brand-600 text-white'
                              : 'bg-surface text-ink border border-line'
                        }`}
                      >
                        <p className="leading-relaxed">{msg.body}</p>
                      </div>
                      <div className="flex items-center gap-1 mt-1 text-[10px] text-ink-muted tabular-nums">
                        <span>
                          {new Date(msg.createdAt).toLocaleTimeString('en-NG', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        {isMine &&
                          (msg.readAt ? (
                            <CheckCheck className="w-3 h-3 text-brand-600" />
                          ) : (
                            <Check className="w-3 h-3" />
                          ))}
                      </div>
                    </div>
                  );
                })
              )}
              {typingUser && (
                <p className="text-xs italic text-ink-muted">{typingUser} is typing...</p>
              )}
              <div ref={threadBottomRef} />
            </div>

            {/* Quick Reply Chips */}
            <div className="px-4 py-2 bg-surface border-t border-line flex items-center gap-2 overflow-x-auto">
              {QUICK_REPLIES.map((qr) => (
                <Chip key={qr} label={qr} onClick={() => handleSendMessage(qr)} />
              ))}
            </div>

            {/* Message Input Bar */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleSendMessage();
              }}
              className="p-3 bg-surface border-t border-line flex items-center gap-2"
            >
              <input
                type="text"
                value={draftText}
                onChange={(e) => {
                  setDraftText(e.target.value);
                  if (activeConvId && user) {
                    socketRef.current?.emit('typing', {
                      conversationId: activeConvId,
                      userId: user.id,
                      displayName: user.displayName,
                    });
                  }
                }}
                placeholder="Write a message to the seller..."
                className="flex-1 min-h-[44px] rounded-control bg-elevated border border-line px-3.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <Button
                type="submit"
                variant="primary"
                loading={sending}
                leftIcon={<Send className="w-4 h-4" />}
              >
                Send
              </Button>
            </form>
          </Card>
        </div>
      )}

      {/* Make an Offer Modal */}
      <Modal
        open={offerModalOpen}
        onClose={() => setOfferModalOpen(false)}
        title="Make a Structured Offer"
        description="The seller can accept, decline, or counter your offer directly in chat."
      >
        <form onSubmit={handleCreateOffer} className="space-y-4">
          <Input
            label="Your Offer Price (NGN)"
            type="number"
            value={offerNaira}
            onChange={(e) => setOfferNaira(e.target.value)}
            leftAddon="₦"
            tabular
            required
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOfferModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Send Offer
            </Button>
          </div>
        </form>
      </Modal>

      {/* Counter Offer Modal */}
      <Modal
        open={Boolean(counterModalOfferId)}
        onClose={() => setCounterModalOfferId(null)}
        title="Send Counter-Offer"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (counterModalOfferId && counterNaira) {
              void handleRespondOffer(
                counterModalOfferId,
                'counter',
                nairaToKobo(Number(counterNaira)),
              );
            }
          }}
          className="space-y-4"
        >
          <Input
            label="Counter Amount (NGN)"
            type="number"
            value={counterNaira}
            onChange={(e) => setCounterNaira(e.target.value)}
            leftAddon="₦"
            tabular
            required
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setCounterModalOfferId(null)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Send Counter-Offer
            </Button>
          </div>
        </form>
      </Modal>

      {/* Safe Inspection Scheduler Modal */}
      <Modal
        open={inspectionModalOpen}
        onClose={() => setInspectionModalOpen(false)}
        title="Schedule Safe Daylight Inspection"
        description="Choose a busy, CCTV-covered public location."
      >
        <form onSubmit={handleProposeInspection} className="space-y-4">
          <Select
            label="Recommended Public CCTV Location"
            value={selectedLocation}
            onChange={(e) => setSelectedLocation(e.target.value)}
            options={safeLocations.map((loc) => ({ value: loc, label: loc }))}
          />
          <Input
            label="Date & Time (Daylight Recommended)"
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            required
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setInspectionModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Propose Inspection
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

