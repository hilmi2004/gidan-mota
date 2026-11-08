import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { io } from 'socket.io-client';
import {
  AlertTriangle,
  Award,
  CheckCircle2,
  Clock,
  Gavel,
  Gauge,
  MapPin,
  MessageSquare,
  Phone,
  ShieldAlert,
  Sparkles,
  Wallet,
  Zap,
} from 'lucide-react';
import { formatKobo, getBidIncrementKobo, koboToNaira, nairaToKobo } from '@autodey/shared';
import { apiRequest } from '../../lib/api';
import { useAppStore } from '../../stores/useAppStore';
import {
  Badge,
  Button,
  Card,
  Countdown,
  Input,
  Modal,
  PriceTag,
  Skeleton,
  useToast,
} from '../../components/ui';

interface AuctionDetailResponse {
  auction: {
    _id: string;
    listingId: string;
    sellerId: string;
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
    startPrice: number;
    currentPrice: number;
    reserveMet: boolean;
    hasReserve: boolean;
    buyNowPrice: number | null;
    buyNowAvailable: boolean;
    startsAt: string;
    endsAt: string;
    originalEndsAt: string;
    extensions: number;
    bidCount: number;
    nextMinBidKobo: number;
    leader: {
      userId: string;
      maskedName?: string;
      placedAt: string;
    } | null;
    myProxyMaxKobo?: number | null;
    settlementMode: 'DIRECT' | 'HOLD';
  };
  listing: {
    _id: string;
    title: string;
    slug: string;
    make: string;
    model: string;
    year: number;
    trim?: string;
    condition: string;
    mileageKm: number;
    transmission: string;
    fuelType: string;
    state: string;
    lga: string;
    vin?: string;
    vinVerified: boolean;
    customsPapers: string;
    customsVerified: boolean;
    inspected: boolean;
    description: string;
    images: Array<{ url: string; angle: string }>;
  } | null;
  seller: {
    _id: string;
    displayName: string;
    kycStatus: string;
    dealerVerified: boolean;
    ratingAvg: number;
    ratingCount: number;
    phone?: string;
    email?: string;
  } | null;
  winnerContact?: {
    _id: string;
    displayName: string;
    phone?: string;
    email?: string;
  } | null;
  bids: Array<{
    _id: string;
    maskedBidderName: string;
    amountKobo: number;
    type: 'manual' | 'proxy' | 'buy_now';
    sequence: number;
    createdAt: string;
  }>;
  settlement: {
    _id: string;
    hammerPriceKobo: number;
    platformFeeKobo: number;
    status: string;
    buyerConfirmedAt?: string;
    sellerConfirmedAt?: string;
    deadlineAt: string;
    conversationId?: string;
    postAuctionOffer?: {
      amountKobo: number;
      counterAmountKobo?: number;
      status: string;
    };
  } | null;
  serverTimeMs: number;
}

export function AuctionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { pushToast } = useToast();
  const queryClient = useQueryClient();
  const user = useAppStore((s) => s.user);
  const setServerClockOffset = useAppStore((s) => s.setServerClockOffset);

  const [selectedImageIdx, setSelectedImageIdx] = useState(0);
  const [maxBidNairaInput, setMaxBidNairaInput] = useState<string>('');
  const [confirmBidModalOpen, setConfirmBidModalOpen] = useState(false);
  const [buyNowModalOpen, setBuyNowModalOpen] = useState(false);
  const [disputeModalOpen, setDisputeModalOpen] = useState(false);
  const [disputeReason, setDisputeReason] = useState('Vehicle condition mismatch at inspection');
  const [disputeDetails, setDisputeDetails] = useState('');
  const [postOfferNaira, setPostOfferNaira] = useState('');
  const [pricePulse, setPricePulse] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['auction', id],
    queryFn: async () => {
      const res = await apiRequest<AuctionDetailResponse>(`/auctions/${id}`);
      if (res.serverTimeMs) {
        setServerClockOffset(res.serverTimeMs);
      }
      return res;
    },
    enabled: Boolean(id),
    refetchInterval: 10000,
  });

  const auction = data?.auction;
  const listing = data?.listing;
  const seller = data?.seller;
  const bids = data?.bids ?? [];
  const settlement = data?.settlement;

  useEffect(() => {
    if (auction && !maxBidNairaInput) {
      setMaxBidNairaInput(String(koboToNaira(auction.nextMinBidKobo)));
    }
  }, [auction, maxBidNairaInput]);

  useEffect(() => {
    if (!auction?._id) return;
    const apiBase = 'http://localhost:4000';
    const socket = io(`${apiBase}/auctions`, {
      transports: ['websocket', 'polling'],
      withCredentials: true,
    });

    socket.on('connect', () => {
      socket.emit('join_auction', auction._id);
    });

    socket.on('server_clock', (payload: { serverTimeMs: number }) => {
      setServerClockOffset(payload.serverTimeMs);
    });

    socket.on('price_updated', (payload: { currentPrice: number; nextMinBidKobo: number }) => {
      setPricePulse(true);
      setTimeout(() => setPricePulse(false), 600);
      setMaxBidNairaInput(String(koboToNaira(payload.nextMinBidKobo)));
      void queryClient.invalidateQueries({ queryKey: ['auction', id] });
    });

    socket.on('reserve_met', () => {
      pushToast({
        type: 'success',
        title: 'Reserve Price Met!',
        message: 'This vehicle will now be sold to the highest bidder when the timer ends.',
      });
      void queryClient.invalidateQueries({ queryKey: ['auction', id] });
    });

    socket.on('ends_at_extended', (payload: { extensions: number }) => {
      pushToast({
        type: 'info',
        title: 'Soft-Close Anti-Sniping Triggered (+2m)',
        message: `Late bid placed in the final 2 minutes. Timer extended (Extension #${payload.extensions}).`,
      });
      void queryClient.invalidateQueries({ queryKey: ['auction', id] });
    });

    socket.on('auction_ended', () => {
      void queryClient.invalidateQueries({ queryKey: ['auction', id] });
    });

    return () => {
      socket.emit('leave_auction', auction._id);
      socket.disconnect();
    };
  }, [auction?._id, id, queryClient, setServerClockOffset, pushToast]);

  const placeBidMutation = useMutation({
    mutationFn: async (maxBidKobo: number) => {
      return apiRequest<{
        auction: AuctionDetailResponse['auction'];
        reserveJustMet: boolean;
        softCloseExtended: boolean;
      }>(`/auctions/${auction!._id}/bids`, {
        method: 'POST',
        body: JSON.stringify({ maxBidKobo }),
      });
    },
    onSuccess: (res) => {
      setConfirmBidModalOpen(false);
      setMaxBidNairaInput(String(koboToNaira(res.auction.nextMinBidKobo)));
      void queryClient.invalidateQueries({ queryKey: ['auction', id] });
      void queryClient.invalidateQueries({ queryKey: ['wallet'] });
      pushToast({
        type: res.auction.leader?.userId === user?.id ? 'success' : 'info',
        title:
          res.auction.leader?.userId === user?.id
            ? 'You Are Leading the Auction!'
            : 'Bid Recorded — Outbid by Earlier Proxy Max',
        message:
          res.auction.leader?.userId === user?.id
            ? `Current price is ${formatKobo(
                res.auction.currentPrice,
              )}. Our proxy engine will bid for you up to your max.`
            : `Another bidder had a higher maximum proxy bid. Current price is now ${formatKobo(
                res.auction.currentPrice,
              )}.`,
      });
    },
    onError: (err: Error) => {
      setConfirmBidModalOpen(false);
      pushToast({
        type: 'error',
        title: 'Bid Not Accepted',
        message: err.message,
      });
    },
  });

  const buyNowMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(`/auctions/${auction!._id}/buy-now`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      setBuyNowModalOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['auction', id] });
      void queryClient.invalidateQueries({ queryKey: ['wallet'] });
      pushToast({
        type: 'success',
        title: 'Congratulations! Vehicle Purchased via Buy Now',
        message: '72-hour settlement workspace is now open below.',
      });
    },
    onError: (err: Error) => {
      setBuyNowModalOpen(false);
      pushToast({
        type: 'error',
        title: 'Buy Now Failed',
        message: err.message,
      });
    },
  });

  const confirmSettlementMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(`/settlements/${settlement!._id}/confirm`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['auction', id] });
      void queryClient.invalidateQueries({ queryKey: ['wallet'] });
      pushToast({
        type: 'success',
        title: 'Settlement Confirmation Recorded',
        message:
          'Once both buyer and seller confirm handover, the refundable bidding deposit is unlocked.',
      });
    },
    onError: (err: Error) => {
      pushToast({
        type: 'error',
        title: 'Confirmation Failed',
        message: err.message,
      });
    },
  });

  const openDisputeMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(`/settlements/${settlement!._id}/dispute`, {
        method: 'POST',
        body: JSON.stringify({
          reason: disputeReason,
          details: disputeDetails,
        }),
      });
    },
    onSuccess: () => {
      setDisputeModalOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['auction', id] });
      pushToast({
        type: 'info',
        title: 'Dispute Opened',
        message: 'Bidding deposit remains frozen while our moderation team reviews the case.',
      });
    },
    onError: (err: Error) => {
      pushToast({
        type: 'error',
        title: 'Could Not Open Dispute',
        message: err.message,
      });
    },
  });

  const postOfferMutation = useMutation({
    mutationFn: async (payload: { amountKobo: number; action: 'offer' | 'accept' | 'decline' }) => {
      return apiRequest(`/auctions/${auction!._id}/post-offer`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['auction', id] });
      pushToast({
        type: 'success',
        title: 'Post-Auction Offer Updated',
        message: 'Your post-auction response has been sent.',
      });
    },
    onError: (err: Error) => {
      pushToast({
        type: 'error',
        title: 'Offer Action Failed',
        message: err.message,
      });
    },
  });

  if (isLoading || !auction) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7 space-y-4">
          <Skeleton className="h-96 w-full rounded-card" />
          <Skeleton className="h-48 w-full rounded-card" />
        </div>
        <div className="lg:col-span-5">
          <Skeleton className="h-[520px] w-full rounded-card" />
        </div>
      </div>
    );
  }

  const images = listing?.images?.length
    ? listing.images
    : [
        {
          url: 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=1200&q=80',
          angle: 'front',
        },
      ];

  const isViewerLeader = Boolean(user && auction.leader?.userId === user.id);
  const isViewerSeller = Boolean(user && auction.sellerId === user.id);
  const hasViewerBidBefore = bids.some(
    (b) => user && b.maskedBidderName.startsWith(user.displayName.slice(0, 2)),
  );
  const currentIncrementKobo = getBidIncrementKobo(auction.currentPrice);
  const enteredMaxKobo = nairaToKobo(Number(maxBidNairaInput) || 0);

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-8">
      {/* Top Status Banner for Leader / Outbid */}
      {auction.status === 'live' && isViewerLeader && (
        <div className="p-4 rounded-card bg-brand-600 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-card">
          <div className="flex items-center gap-2.5 font-semibold">
            <Award className="w-5 h-5 shrink-0" />
            <span>
              You are currently the highest bidder at {formatKobo(auction.currentPrice)}!
            </span>
          </div>
          {auction.myProxyMaxKobo && (
            <div className="text-xs font-mono tabular-nums bg-brand-700/90 px-3 py-1.5 rounded-control">
              Your Protected Proxy Max: {formatKobo(auction.myProxyMaxKobo)}
            </div>
          )}
        </div>
      )}

      {auction.status === 'live' && !isViewerLeader && hasViewerBidBefore && (
        <div className="p-4 rounded-card bg-amber-600 text-white flex items-center justify-between gap-3 shadow-card">
          <div className="flex items-center gap-2.5 font-semibold">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span>
              You have been outbid! Current price is {formatKobo(auction.currentPrice)}. Place a
              higher maximum bid below to reclaim the lead.
            </span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Vehicle Media, Trust Badges & Specs */}
        <div className="lg:col-span-7 space-y-6">
          <Card padding="none" className="overflow-hidden">
            <div className="relative aspect-[16/10] bg-black">
              <img
                src={images[selectedImageIdx]?.url}
                alt={listing?.title ?? 'Auction Vehicle'}
                className="w-full h-full object-cover"
              />
              <div className="absolute top-3 left-3 flex flex-wrap gap-2">
                <Badge variant="live">LIVE TIMED AUCTION</Badge>
                {listing?.vinVerified && <Badge variant="vin_checked" />}
                {listing?.customsVerified && <Badge variant="customs_reviewed" />}
                {listing?.inspected && <Badge variant="inspected" />}
              </div>
            </div>

            {images.length > 1 && (
              <div className="p-3 flex gap-2 overflow-x-auto bg-elevated">
                {images.map((img, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedImageIdx(idx)}
                    className={`relative w-20 h-14 rounded-control overflow-hidden shrink-0 border-2 transition ${
                      selectedImageIdx === idx ? 'border-brand-600' : 'border-transparent opacity-70'
                    }`}
                  >
                    <img src={img.url} alt={img.angle} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-6 space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-xs text-ink-secondary">
              <span className="inline-flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-brand-600" />
                {listing?.lga}, {listing?.state}
              </span>
              <span>·</span>
              <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                <Gauge className="w-3.5 h-3.5" />
                {listing?.mileageKm?.toLocaleString()} km
              </span>
              <span>·</span>
              <span>{listing?.condition}</span>
              {listing?.vin && (
                <>
                  <span>·</span>
                  <span className="font-mono text-xs">VIN: {listing.vin}</span>
                </>
              )}
            </div>

            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-ink">
              {listing?.title ?? 'Verified Auction Vehicle'}
            </h1>

            <p className="text-sm text-ink-secondary whitespace-pre-line leading-relaxed">
              {listing?.description}
            </p>

            {seller && (
              <div className="pt-4 border-t border-line flex items-center justify-between">
                <div>
                  <div className="text-xs text-ink-muted">Verified Auction Seller</div>
                  <Link
                    to={`/users/${seller._id}`}
                    className="font-semibold text-ink hover:text-brand-600 transition"
                  >
                    {seller.displayName}
                  </Link>
                </div>
                <div className="flex gap-2">
                  {seller.dealerVerified && <Badge variant="dealer_verified" />}
                  {seller.kycStatus === 'verified' && <Badge variant="id_verified" />}
                </div>
              </div>
            )}
          </Card>

          {/* Masked Bid History */}
          <Card className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-ink flex items-center gap-2">
                <Gavel className="w-5 h-5 text-brand-600" />
                Authoritative Bid Ledger ({auction.bidCount} bids)
              </h2>
              <span className="text-xs text-ink-muted">
                Bidder identities masked for anti-collusion safety
              </span>
            </div>

            {bids.length === 0 ? (
              <p className="text-sm text-ink-secondary py-4">
                No bids yet. Be the first to bid at the starting price of{' '}
                <span className="font-mono font-semibold">{formatKobo(auction.startPrice)}</span>!
              </p>
            ) : (
              <div className="divide-y divide-line max-h-80 overflow-y-auto">
                {bids.map((b, index) => (
                  <div
                    key={b._id}
                    className={`py-3 flex items-center justify-between text-sm ${
                      index === 0 ? 'bg-emerald-500/10 px-3 rounded-control' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs text-ink-muted">#{b.sequence}</span>
                      <span className="font-semibold font-mono text-ink">{b.maskedBidderName}</span>
                      <span
                        className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                          b.type === 'proxy'
                            ? 'bg-emerald-500/15 text-brand-700'
                            : b.type === 'buy_now'
                              ? 'bg-amber-500/15 text-amber-700'
                              : 'bg-elevated text-ink-secondary'
                        }`}
                      >
                        {b.type === 'proxy'
                          ? 'Auto-Proxy Bid'
                          : b.type === 'buy_now'
                            ? 'Buy Now'
                            : 'Manual Bid'}
                      </span>
                    </div>
                    <div className="text-right font-mono tabular-nums">
                      <div className="font-bold text-ink">{formatKobo(b.amountKobo)}</div>
                      <div className="text-[11px] text-ink-muted">
                        {new Date(b.createdAt).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Right Column: Live Bidding Terminal & Settlement Workspace */}
        <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-20">
          <Card className="p-6 space-y-5 border-2 border-brand-600/30 shadow-cardHover">
            {/* Timer & Reserve Header */}
            <div className="flex items-center justify-between gap-2 pb-4 border-b border-line">
              <div>
                <div className="text-xs font-medium text-ink-muted uppercase">
                  {auction.status === 'live' ? 'Time Remaining' : 'Auction Status'}
                </div>
                {auction.status === 'live' ? (
                  <div className="mt-1">
                    <Countdown endsAt={auction.endsAt} />
                  </div>
                ) : (
                  <div className="mt-1 font-bold text-amber-600 uppercase text-sm">
                    {auction.status.replace(/_/g, ' ')}
                  </div>
                )}
              </div>

              <div className="text-right space-y-1">
                {!auction.hasReserve ? (
                  <Badge variant="no_reserve" />
                ) : auction.reserveMet ? (
                  <Badge variant="reserve_met" />
                ) : (
                  <Badge variant="reserve_not_met" />
                )}
                {auction.extensions > 0 && (
                  <div className="text-[11px] font-mono text-amber-600">
                    +{auction.extensions} Soft-Close Ext.
                  </div>
                )}
              </div>
            </div>

            {/* Current Bid Price */}
            <div
              className={`p-4 rounded-control transition-transform duration-300 ${
                pricePulse ? 'scale-[1.02] bg-emerald-500/10' : 'bg-elevated'
              }`}
            >
              <div className="flex items-center justify-between text-xs text-ink-muted">
                <span>
                  {auction.bidCount === 0 ? 'STARTING BID' : 'CURRENT HIGHEST BID'}
                </span>
                <span className="font-mono tabular-nums">
                  {auction.bidCount} {auction.bidCount === 1 ? 'bid' : 'bids'}
                </span>
              </div>
              <div className="mt-1">
                <PriceTag kobo={auction.currentPrice} size="xl" />
              </div>
              {auction.leader?.maskedName && (
                <div className="mt-2 text-xs text-ink-secondary flex items-center justify-between">
                  <span>Current Leader:</span>
                  <span className="font-mono font-semibold text-ink">
                    {auction.leader.maskedName}
                  </span>
                </div>
              )}
            </div>

            {/* Live Proxy Bidding Controls */}
            {auction.status === 'live' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-ink-secondary">Minimum Next Bid:</span>
                  <span className="font-mono font-semibold tabular-nums text-ink">
                    {formatKobo(auction.nextMinBidKobo)} (+{formatKobo(currentIncrementKobo)} step)
                  </span>
                </div>

                {/* Quick Increment Chips */}
                <div className="grid grid-cols-3 gap-2">
                  {[0, 1, 3].map((mult) => {
                    const targetKobo =
                      auction.nextMinBidKobo + mult * currentIncrementKobo;
                    return (
                      <button
                        key={mult}
                        type="button"
                        onClick={() => setMaxBidNairaInput(String(koboToNaira(targetKobo)))}
                        className="py-2 px-2 rounded-control border border-line hover:border-brand-600 text-xs font-mono font-semibold tabular-nums text-ink transition"
                      >
                        {formatKobo(targetKobo)}
                      </button>
                    );
                  })}
                </div>

                <Input
                  label="Your Maximum Proxy Bid (NGN)"
                  type="number"
                  value={maxBidNairaInput}
                  onChange={(e) => setMaxBidNairaInput(e.target.value)}
                  helperText="Enter the maximum you are willing to pay. Our engine will only bid the minimum increment needed to keep you in the lead."
                />

                <Button
                  size="lg"
                  fullWidth
                  disabled={isViewerSeller}
                  leftIcon={<Gavel className="w-4 h-4" />}
                  onClick={() => {
                    if (!user) {
                      navigate('/auth');
                      return;
                    }
                    setConfirmBidModalOpen(true);
                  }}
                >
                  {isViewerSeller
                    ? 'Your Listing (Seller Cannot Bid)'
                    : isViewerLeader
                      ? 'Raise My Maximum Proxy Bid'
                      : `Place Proxy Bid (${formatKobo(enteredMaxKobo)})`}
                </Button>

                {auction.buyNowAvailable && auction.buyNowPrice && (
                  <Button
                    variant="amber"
                    size="lg"
                    fullWidth
                    disabled={isViewerSeller}
                    leftIcon={<Zap className="w-4 h-4" />}
                    onClick={() => {
                      if (!user) {
                        navigate('/auth');
                        return;
                      }
                      setBuyNowModalOpen(true);
                    }}
                  >
                    Buy It Now Instantly for {formatKobo(auction.buyNowPrice)}
                  </Button>
                )}

                <div className="pt-2 flex items-center justify-between text-xs text-ink-secondary">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-amber-500" />
                    Soft-close +2m anti-sniping active
                  </span>
                  <Link
                    to="/wallet"
                    className="inline-flex items-center gap-1 text-brand-600 font-semibold hover:underline"
                  >
                    <Wallet className="w-3.5 h-3.5" />
                    Manage Deposit Wallet
                  </Link>
                </div>
              </div>
            )}

            {/* Post-Auction Offer Negotiation when ended_reserve_not_met */}
            {auction.status === 'ended_reserve_not_met' && (
              <div className="p-4 rounded-control bg-amber-500/10 border border-amber-500/30 space-y-3">
                <div className="font-semibold text-sm text-ink flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  Ended — Reserve Price Not Met
                </div>
                <p className="text-xs text-ink-secondary leading-relaxed">
                  All bidding deposits have been unlocked. If you are the seller or the highest
                  bidder, you can propose or accept a direct post-auction price below.
                </p>

                {(isViewerLeader || isViewerSeller) && (
                  <div className="space-y-2 pt-2">
                    <Input
                      label="Propose Post-Auction Price (NGN)"
                      type="number"
                      placeholder={String(koboToNaira(auction.currentPrice))}
                      value={postOfferNaira}
                      onChange={(e) => setPostOfferNaira(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        loading={postOfferMutation.isPending}
                        onClick={() =>
                          postOfferMutation.mutate({
                            amountKobo: nairaToKobo(
                              Number(postOfferNaira) || koboToNaira(auction.currentPrice),
                            ),
                            action: 'offer',
                          })
                        }
                      >
                        Send Post-Auction Offer
                      </Button>
                      {settlement?.postAuctionOffer && (
                        <Button
                          size="sm"
                          variant="outline"
                          loading={postOfferMutation.isPending}
                          onClick={() =>
                            postOfferMutation.mutate({
                              amountKobo: settlement.postAuctionOffer!.amountKobo,
                              action: 'accept',
                            })
                          }
                        >
                          Accept {formatKobo(settlement.postAuctionOffer.amountKobo)}
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 72-Hour Settlement Workspace */}
            {settlement &&
              (auction.status === 'sold_pending_settlement' ||
                auction.status === 'settled' ||
                auction.status === 'disputed') && (
                <div className="p-4 rounded-control bg-emerald-500/10 border border-brand-500/30 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-brand-700">
                      72-Hour Settlement Workspace
                    </span>
                    <Badge variant="reserve_met">{settlement.status.toUpperCase()}</Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs font-mono tabular-nums">
                    <div>
                      <div className="text-ink-muted">Winning Hammer Price</div>
                      <div className="font-bold text-sm text-ink">
                        {formatKobo(settlement.hammerPriceKobo)}
                      </div>
                    </div>
                    <div>
                      <div className="text-ink-muted">Platform Success Fee (2.5%)</div>
                      <div className="font-bold text-sm text-ink">
                        {formatKobo(settlement.platformFeeKobo)}
                      </div>
                    </div>
                  </div>

                  {/* Mutual Contact Reveal */}
                  <div className="p-3 rounded-control bg-surface border border-line text-xs space-y-1.5">
                    <div className="font-semibold text-ink">Verified Settlement Contacts</div>
                    {seller?.phone && (
                      <div className="flex items-center justify-between text-ink-secondary">
                        <span>Seller ({seller.displayName}):</span>
                        <a
                          href={`tel:${seller.phone}`}
                          className="font-mono font-bold text-brand-600 inline-flex items-center gap-1"
                        >
                          <Phone className="w-3.5 h-3.5" />
                          {seller.phone}
                        </a>
                      </div>
                    )}
                    {data?.winnerContact?.phone && (
                      <div className="flex items-center justify-between text-ink-secondary">
                        <span>Winner ({data.winnerContact.displayName}):</span>
                        <a
                          href={`tel:${data.winnerContact.phone}`}
                          className="font-mono font-bold text-brand-600 inline-flex items-center gap-1"
                        >
                          <Phone className="w-3.5 h-3.5" />
                          {data.winnerContact.phone}
                        </a>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-2">
                    {settlement.status !== 'completed' && (
                      <Button
                        fullWidth
                        loading={confirmSettlementMutation.isPending}
                        leftIcon={<CheckCircle2 className="w-4 h-4" />}
                        onClick={() => confirmSettlementMutation.mutate()}
                      >
                        Confirm Inspection & Handover Completed
                      </Button>
                    )}

                    <div className="flex gap-2">
                      <Link to="/chat" className="flex-1">
                        <Button
                          variant="outline"
                          size="sm"
                          fullWidth
                          leftIcon={<MessageSquare className="w-4 h-4" />}
                        >
                          Open Settlement Chat
                        </Button>
                      </Link>
                      {settlement.status !== 'completed' &&
                        settlement.status !== 'disputed' && (
                          <Button
                            variant="danger"
                            size="sm"
                            leftIcon={<ShieldAlert className="w-4 h-4" />}
                            onClick={() => setDisputeModalOpen(true)}
                          >
                            Open Dispute
                          </Button>
                        )}
                    </div>
                  </div>
                </div>
              )}
          </Card>
        </div>
      </div>

      {/* Binding Bid Confirmation Modal */}
      <Modal
        open={confirmBidModalOpen}
        onClose={() => setConfirmBidModalOpen(false)}
        title="Confirm Binding Proxy Bid"
      >
        <div className="space-y-4">
          <div className="p-4 rounded-control bg-elevated space-y-2">
            <div className="flex justify-between text-xs text-ink-secondary">
              <span>Your Maximum Proxy Bid:</span>
              <span className="font-mono font-bold text-base text-ink">
                {formatKobo(enteredMaxKobo)}
              </span>
            </div>
            <div className="flex justify-between text-xs text-ink-secondary">
              <span>Current Auction Price:</span>
              <span className="font-mono text-ink">{formatKobo(auction.currentPrice)}</span>
            </div>
          </div>

          <p className="text-xs text-ink-secondary leading-relaxed">
            By confirming, your refundable bidding deposit will be locked while this auction is
            active. If you win, you agree to inspect the vehicle and complete settlement with the
            seller within 72 hours. Defaulting after winning forfeits 50% of your locked deposit.
          </p>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setConfirmBidModalOpen(false)}>
              Cancel
            </Button>
            <Button
              loading={placeBidMutation.isPending}
              leftIcon={<Gavel className="w-4 h-4" />}
              onClick={() => placeBidMutation.mutate(enteredMaxKobo)}
            >
              Confirm Binding Bid
            </Button>
          </div>
        </div>
      </Modal>

      {/* Buy Now Confirmation Modal */}
      <Modal
        open={buyNowModalOpen}
        onClose={() => setBuyNowModalOpen(false)}
        title="Confirm Instant Buy Now"
      >
        <div className="space-y-4">
          <p className="text-sm text-ink">
            Purchase <strong>{listing?.title}</strong> immediately at the Buy Now price of{' '}
            <span className="font-mono font-bold">
              {formatKobo(auction.buyNowPrice ?? 0)}
            </span>
            ? This ends the auction immediately and opens the 72-hour settlement workspace.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setBuyNowModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="amber"
              loading={buyNowMutation.isPending}
              leftIcon={<Zap className="w-4 h-4" />}
              onClick={() => buyNowMutation.mutate()}
            >
              Confirm Buy Now
            </Button>
          </div>
        </div>
      </Modal>

      {/* Open Dispute Modal */}
      <Modal
        open={disputeModalOpen}
        onClose={() => setDisputeModalOpen(false)}
        title="Report Settlement Dispute"
      >
        <div className="space-y-4">
          <Input
            label="Reason"
            value={disputeReason}
            onChange={(e) => setDisputeReason(e.target.value)}
          />
          <div>
            <label className="block text-xs font-medium mb-1 text-ink">
              Detailed Explanation (min 10 chars)
            </label>
            <textarea
              rows={4}
              value={disputeDetails}
              onChange={(e) => setDisputeDetails(e.target.value)}
              placeholder="Describe what happened during the inspection or communication..."
              className="w-full rounded-control border border-line bg-surface p-3 text-sm text-ink"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDisputeModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={openDisputeMutation.isPending}
              onClick={() => openDisputeMutation.mutate()}
            >
              Submit Dispute
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
