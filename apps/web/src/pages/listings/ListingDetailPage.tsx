import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  Calculator,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Expand,
  FileCheck2,
  Gavel,
  Heart,
  MapPin,
  MessageCircle,
  MessageSquare,
  Phone,
  Share2,
  ShieldCheck,
  TrendingDown,
} from 'lucide-react';
import { BRAND_CONFIG, formatKobo, getBidIncrementKobo } from '@autodey/shared';
import {
  Avatar,
  Badge,
  Button,
  Card,
  Countdown,
  EmptyState,
  Modal,
  PriceTag,
  Select,
  Skeleton,
  useToast,
} from '../../components/ui';
import { ListingCard, type ListingSummaryItem } from '../../components/listings/ListingCards';
import { apiRequest } from '../../lib/api';
import { useAppStore } from '../../stores/useAppStore';

interface ListingDetailResponse {
  listing: {
    id: string;
    slug: string;
    title: string;
    category: string;
    make: string;
    model: string;
    trim?: string;
    year: number;
    condition: string;
    mileageKm: number;
    transmission: string;
    fuelType: string;
    bodyType: string;
    driveSide: string;
    engineSize?: string;
    exteriorColor: string;
    interiorColor: string;
    ownersCount: number;
    state: string;
    lga: string;
    vin?: string;
    customsStatus: string;
    accidentHistory: string;
    priceKobo: number;
    negotiable: boolean;
    swapAccepted: boolean;
    description: string;
    features: string[];
    coverPhotoUrl: string;
    badges: {
      vinChecked: boolean;
      customsReviewed: boolean;
      inspected: boolean;
    };
    stats: {
      views: number;
      phoneReveals: number;
      chatStarts: number;
      favoritesCount: number;
    };
    isAuction: boolean;
    isFavorited: boolean;
    createdAt: string;
  };
  media: Array<{
    id: string;
    url: string;
    angle: string;
    order: number;
  }>;
  documents: Array<{
    id: string;
    type: string;
    customsReferenceNumber?: string;
    summary?: string;
    status: string;
  }>;
  seller: {
    id: string;
    displayName: string;
    phoneMasked: string;
    avatarUrl?: string;
    bio?: string;
    state?: string;
    lga?: string;
    badges: {
      phoneVerified: boolean;
      idVerified: boolean;
      dealerVerified: boolean;
    };
    responseRatePercent: number;
    avgResponseMinutes: number;
    ratingAvg: number;
    reviewCount: number;
    memberSince: string;
    dealerProfile?: {
      slug: string;
      businessName: string;
      cacNumber: string;
      address: string;
    } | null;
  } | null;
  auction: {
    id: string;
    status: string;
    startPriceKobo: number;
    currentPriceKobo: number;
    buyNowPriceKobo?: number | null;
    reserveStatus: 'no_reserve' | 'reserve_met' | 'reserve_not_met';
    startsAt: string;
    endsAt: string;
    extensions: number;
    bidCount: number;
    winningBidderMasked?: string;
    serverTimeMs: number;
  } | null;
  fairPriceInsight: {
    available: boolean;
    comparableCount: number;
    medianPriceKobo: number | null;
    minPriceKobo: number | null;
    maxPriceKobo: number | null;
    verdict: 'below_market' | 'fair_price' | 'above_market' | 'insufficient_data';
    deltaPercent: number | null;
  };
  similarListings: ListingSummaryItem[];
  moreFromSeller: ListingSummaryItem[];
}

export const ListingDetailPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { pushToast } = useToast();
  const user = useAppStore((s) => s.user);
  const setServerClockOffset = useAppStore((s) => s.setServerClockOffset);

  const [data, setData] = useState<ListingDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [phoneRevealed, setPhoneRevealed] = useState<string | null>(null);
  const [favorited, setFavorited] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportReason, setReportReason] = useState('scam_or_advance_fee');
  const [reportDetails, setReportDetails] = useState('');
  const [startingChat, setStartingChat] = useState(false);

  // Naira Finance Calculator state
  const [downPaymentPercent, setDownPaymentPercent] = useState(30);
  const [tenureMonths, setTenureMonths] = useState(24);
  const [annualRatePercent, setAnnualRatePercent] = useState(22);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    setActivePhotoIdx(0);
    setPhoneRevealed(null);

    apiRequest<ListingDetailResponse>(`/listings/${slug}`)
      .then((res) => {
        setData(res);
        setFavorited(res.listing.isFavorited);
        if (res.auction?.serverTimeMs) {
          setServerClockOffset(res.auction.serverTimeMs);
        }
      })
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          <Skeleton className="aspect-[16/10] w-full rounded-card" />
          <Skeleton className="h-32 w-full rounded-card" />
        </div>
        <div>
          <Skeleton className="h-96 w-full rounded-card" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12">
        <EmptyState
          icon={<AlertTriangle className="w-6 h-6" />}
          title="Vehicle listing not found"
          description="This car may have been sold or removed."
          actionLabel="Browse Available Cars"
          onAction={() => navigate('/search')}
        />
      </div>
    );
  }

  const { listing, media, documents, seller, auction, fairPriceInsight, similarListings } = data;
  const photos =
    media.length > 0
      ? media
      : [{ id: 'cover', url: listing.coverPhotoUrl, angle: 'front', order: 0 }];
  const currentPhoto = photos[activePhotoIdx] ?? photos[0]!;

  // Finance calculation in integer kobo
  const downPaymentKobo = Math.round((listing.priceKobo * downPaymentPercent) / 100);
  const principalKobo = Math.max(0, listing.priceKobo - downPaymentKobo);
  const monthlyRate = annualRatePercent / 100 / 12;
  const monthlyPaymentKobo =
    monthlyRate > 0
      ? Math.round(
          (principalKobo * monthlyRate * Math.pow(1 + monthlyRate, tenureMonths)) /
            (Math.pow(1 + monthlyRate, tenureMonths) - 1),
        )
      : Math.round(principalKobo / tenureMonths);

  const shareUrl = `${window.location.origin}/cars/${listing.state.toLowerCase()}/${listing.slug}`;
  const whatsappText = encodeURIComponent(
    `Hello ${seller?.displayName ?? 'Seller'}, I saw your ${listing.title} (${formatKobo(
      listing.priceKobo,
    )}) on ${BRAND_CONFIG.name}: ${shareUrl} — Is it still available for inspection?`,
  );

  const handleToggleFavorite = async () => {
    if (!user) {
      navigate('/auth');
      return;
    }
    const next = !favorited;
    setFavorited(next);
    try {
      const res = await apiRequest<{ favorited: boolean }>(`/favorites/${listing.id}`, {
        method: 'POST',
      });
      setFavorited(res.favorited);
      pushToast({
        type: 'success',
        title: res.favorited ? 'Saved to Favorites' : 'Removed from Favorites',
      });
    } catch {
      setFavorited(!next);
    }
  };

  const handleRevealPhone = async () => {
    if (!user) {
      pushToast({
        type: 'info',
        title: 'Sign in to reveal seller phone',
        message: 'Phone numbers are protected from scrapers. Sign in with OTP to view.',
      });
      navigate('/auth');
      return;
    }
    try {
      const res = await apiRequest<{ phone: string; safetyReminder: string }>(
        `/listings/${listing.id}/reveal-phone`,
        { method: 'POST' },
      );
      setPhoneRevealed(res.phone);
      pushToast({
        type: 'info',
        title: `Phone: ${res.phone}`,
        message: res.safetyReminder,
      });
    } catch (err) {
      pushToast({
        type: 'error',
        title: 'Could Not Reveal Phone',
        message: err instanceof Error ? err.message : 'Try again shortly.',
      });
    }
  };

  const handleStartChat = async () => {
    if (!user) {
      navigate('/auth');
      return;
    }
    setStartingChat(true);
    try {
      const res = await apiRequest<{ conversation: { id: string } }>('/conversations', {
        method: 'POST',
        body: JSON.stringify({
          listingId: listing.id,
          initialMessage: `Hello, I am interested in your ${listing.title}. Is it available for inspection?`,
        }),
      });
      navigate(`/chat?conversationId=${res.conversation.id}`);
    } catch (err) {
      pushToast({
        type: 'error',
        title: 'Could Not Start Chat',
        message: err instanceof Error ? err.message : 'Unable to start chat.',
      });
    } finally {
      setStartingChat(false);
    }
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      navigate('/auth');
      return;
    }
    try {
      const res = await apiRequest<{ message: string }>('/reports', {
        method: 'POST',
        body: JSON.stringify({
          targetType: 'listing',
          targetId: listing.id,
          reason: reportReason,
          details: reportDetails,
        }),
      });
      setReportModalOpen(false);
      pushToast({ type: 'info', title: 'Report Submitted', message: res.message });
    } catch (err) {
      pushToast({
        type: 'error',
        title: 'Could Not Submit Report',
        message: err instanceof Error ? err.message : 'Already reported.',
      });
    }
  };

  const handleShare = async () => {
    await navigator.clipboard?.writeText(shareUrl).catch(() => null);
    pushToast({
      type: 'success',
      title: 'Link Copied for WhatsApp',
      message: 'OpenGraph preview ready with car photo and Naira price.',
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6 pb-28 md:pb-12 space-y-6 sm:space-y-10">
      {/* Breadcrumb & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-ink-secondary">
        <div className="flex items-center gap-2 flex-wrap">
          <Link to="/search" className="hover:text-ink font-medium">
            All Nigeria
          </Link>
          <span>/</span>
          <Link to={`/search?state=${listing.state}`} className="hover:text-ink font-medium">
            {listing.state}
          </Link>
          <span>/</span>
          <Link to={`/search?make=${listing.make}`} className="hover:text-ink font-medium">
            {listing.make}
          </Link>
          <span>/</span>
          <span className="text-ink font-semibold truncate max-w-[200px]">{listing.title}</span>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            variant="outline"
            size="sm"
            leftIcon={<Heart className={`w-4 h-4 ${favorited ? 'fill-red-500 text-red-500' : ''}`} />}
            onClick={handleToggleFavorite}
          >
            {favorited ? 'Saved' : 'Save'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            leftIcon={<Share2 className="w-4 h-4" />}
            onClick={handleShare}
          >
            Share on WhatsApp
          </Button>
        </div>
      </div>

      {/* Main 2-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* LEFT COLUMN: Gallery, Specs, Fair Price, Description, Finance Calculator */}
        <div className="lg:col-span-2 space-y-6">
          {/* Swipeable Gallery */}
          <Card padding="none" className="overflow-hidden">
            <div className="relative aspect-[16/10] bg-elevated overflow-hidden">
              <img
                src={currentPhoto.url}
                alt={`${listing.title} - ${currentPhoto.angle}`}
                className="w-full h-full object-cover"
              />
              <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
                {listing.badges.vinChecked && <Badge variant="vin_checked" />}
                {listing.badges.customsReviewed && <Badge variant="customs_reviewed" />}
                {listing.badges.inspected && <Badge variant="inspected" />}
              </div>

              <div className="absolute bottom-3 left-3 px-2.5 py-1 rounded-full bg-black/65 text-white text-xs font-medium capitalize">
                Angle: {currentPhoto.angle} ({activePhotoIdx + 1} / {photos.length})
              </div>

              <button
                type="button"
                onClick={() => setLightboxOpen(true)}
                aria-label="Open fullscreen gallery"
                className="absolute bottom-3 right-3 px-3 py-1.5 rounded-control bg-black/65 hover:bg-black/80 text-white text-xs font-medium inline-flex items-center gap-1.5"
              >
                <Expand className="w-3.5 h-3.5" />
                <span>Fullscreen</span>
              </button>

              {photos.length > 1 && (
                <>
                  <button
                    type="button"
                    aria-label="Previous photo"
                    onClick={() =>
                      setActivePhotoIdx((prev) => (prev === 0 ? photos.length - 1 : prev - 1))
                    }
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 hover:bg-black/75 text-white flex items-center justify-center"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    aria-label="Next photo"
                    onClick={() =>
                      setActivePhotoIdx((prev) => (prev === photos.length - 1 ? 0 : prev + 1))
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 hover:bg-black/75 text-white flex items-center justify-center"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </>
              )}
            </div>

            {/* Thumbnail Strip */}
            <div className="p-3 bg-surface border-t border-line flex items-center gap-2 overflow-x-auto">
              {photos.map((p, idx) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setActivePhotoIdx(idx)}
                  className={`relative w-20 aspect-[4/3] rounded-control overflow-hidden shrink-0 border-2 transition-all ${
                    idx === activePhotoIdx
                      ? 'border-brand-600 ring-2 ring-brand-500/30'
                      : 'border-transparent opacity-70 hover:opacity-100'
                  }`}
                >
                  <img src={p.url} alt={p.angle} className="w-full h-full object-cover" />
                  <span className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[9px] uppercase text-center py-0.5">
                    {p.angle}
                  </span>
                </button>
              ))}
            </div>
          </Card>

          {/* Vehicle Specification Grid */}
          <Card className="space-y-4">
            <h2 className="text-lg font-semibold text-ink">Vehicle Specifications & History</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3 text-xs">
              {[
                {
                  label: 'Condition',
                  value:
                    listing.condition === 'foreign_used'
                      ? 'Foreign Used (Tokunbo)'
                      : listing.condition === 'nigerian_used'
                        ? 'Nigerian Used'
                        : 'Brand New',
                },
                { label: 'Mileage', value: `${listing.mileageKm.toLocaleString()} km` },
                { label: 'Transmission', value: listing.transmission.toUpperCase() },
                { label: 'Fuel Type', value: listing.fuelType.toUpperCase() },
                { label: 'Body Style', value: listing.bodyType.toUpperCase() },
                { label: 'Drive Side', value: listing.driveSide === 'lhd' ? 'Left-Hand Drive' : 'Right-Hand Drive' },
                { label: 'Exterior Color', value: listing.exteriorColor },
                { label: 'Interior', value: listing.interiorColor },
                {
                  label: 'Customs Duty Papers',
                  value:
                    listing.badges.customsReviewed
                      ? 'Verified on File'
                      : listing.customsStatus === 'yes'
                        ? 'Declared Yes'
                        : 'Ask Seller',
                },
                {
                  label: 'Accident History',
                  value: listing.accidentHistory.replace(/_/g, ' ').toUpperCase(),
                },
                {
                  label: '17-Character VIN',
                  value: listing.vin || 'Not Provided',
                },
                {
                  label: 'Swap / Trade-In',
                  value: listing.swapAccepted ? 'Swap Accepted' : 'Cash / Transfer Only',
                },
              ].map((spec) => (
                <div key={spec.label} className="p-3 rounded-control bg-elevated border border-line min-w-0">
                  <span className="text-ink-muted block">{spec.label}</span>
                  <span className="font-semibold text-ink tabular-nums mt-0.5 block truncate" title={spec.value}>
                    {spec.value}
                  </span>
                </div>
              ))}
            </div>

            {listing.features.length > 0 && (
              <div className="pt-3 border-t border-line">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-muted mb-2.5">
                  Verified Equipment & Features
                </h3>
                <div className="flex flex-wrap gap-2">
                  {listing.features.map((feat) => (
                    <span
                      key={feat}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-elevated text-xs font-medium text-ink"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-brand-600" />
                      <span>{feat}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </Card>

          {/* Fair Price Market Insight Meter (Only shown when >= 5 comparable listings exist) */}
          {fairPriceInsight.available && fairPriceInsight.medianPriceKobo && (
            <Card className="space-y-3 border-brand-500/30">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-600">
                    <TrendingDown className="w-4 h-4" />
                    <span>{BRAND_CONFIG.name} Fair Price Market Meter</span>
                  </div>
                  <h3 className="text-base font-semibold text-ink mt-1">
                    {fairPriceInsight.verdict === 'below_market'
                      ? 'Priced Below Market Median'
                      : fairPriceInsight.verdict === 'fair_price'
                        ? 'Fair Market Price'
                        : 'Priced Above Comparable Median'}
                  </h3>
                  <p className="text-xs text-ink-secondary mt-0.5">
                    Based on <strong>{fairPriceInsight.comparableCount}</strong> active{' '}
                    {listing.make} {listing.model} ({listing.year - 2}–{listing.year + 2}) listings
                    in Nigeria.
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-[11px] text-ink-muted block">Market Median</span>
                  <span className="font-mono tabular-nums text-base font-bold text-ink">
                    {formatKobo(fairPriceInsight.medianPriceKobo)}
                  </span>
                </div>
              </div>

              <div className="pt-2">
                <div className="h-2.5 rounded-full bg-elevated overflow-hidden flex">
                  <div className="w-1/3 bg-emerald-500" />
                  <div className="w-1/3 bg-brand-600" />
                  <div className="w-1/3 bg-amber-500" />
                </div>
                <div className="flex justify-between text-[11px] font-mono tabular-nums text-ink-muted mt-1.5">
                  <span>Low: {formatKobo(fairPriceInsight.minPriceKobo ?? 0)}</span>
                  <span>This Car: {formatKobo(listing.priceKobo)}</span>
                  <span>High: {formatKobo(fairPriceInsight.maxPriceKobo ?? 0)}</span>
                </div>
              </div>
            </Card>
          )}

          {/* Seller Description & Verified Customs Documents */}
          <Card className="space-y-4">
            <h2 className="text-lg font-semibold text-ink">Seller Notes & Condition Report</h2>
            <p className="text-sm text-ink-secondary leading-relaxed whitespace-pre-line">
              {listing.description}
            </p>

            {documents.length > 0 ? (
              <div className="p-3.5 rounded-control bg-emerald-500/10 border border-brand-500/30 flex items-start gap-3">
                <FileCheck2 className="w-5 h-5 text-brand-600 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <p className="font-semibold text-ink">
                    Customs Duty Papers Reviewed by Moderator
                  </p>
                  <p className="text-ink-secondary mt-0.5">
                    Ref: <span className="font-mono">{documents[0]?.customsReferenceNumber}</span> —{' '}
                    {documents[0]?.summary}
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-3.5 rounded-control bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-signal-amber shrink-0 mt-0.5" />
                <div className="text-xs">
                  <p className="font-semibold text-ink">
                    No verified customs papers uploaded yet
                  </p>
                  <p className="text-ink-secondary mt-0.5">
                    Inspect original Nigeria Customs Service duty papers in person before paying.
                  </p>
                </div>
              </div>
            )}
          </Card>

          {/* Naira Auto Finance Calculator Widget */}
          <Card className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calculator className="w-5 h-5 text-brand-600" />
                <h2 className="text-base font-semibold text-ink">Naira Car Finance Estimator</h2>
              </div>
              <span className="text-xs text-ink-muted">Estimate only</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Select
                label="Down Payment (%)"
                value={String(downPaymentPercent)}
                onChange={(e) => setDownPaymentPercent(Number(e.target.value))}
                options={[
                  { value: '20', label: `20% (${formatKobo(listing.priceKobo * 0.2, { compact: true })})` },
                  { value: '30', label: `30% (${formatKobo(listing.priceKobo * 0.3, { compact: true })})` },
                  { value: '40', label: `40% (${formatKobo(listing.priceKobo * 0.4, { compact: true })})` },
                  { value: '50', label: `50% (${formatKobo(listing.priceKobo * 0.5, { compact: true })})` },
                ]}
              />

              <Select
                label="Tenure (Months)"
                value={String(tenureMonths)}
                onChange={(e) => setTenureMonths(Number(e.target.value))}
                options={[
                  { value: '12', label: '12 Months (1 Year)' },
                  { value: '24', label: '24 Months (2 Years)' },
                  { value: '36', label: '36 Months (3 Years)' },
                  { value: '48', label: '48 Months (4 Years)' },
                ]}
              />

              <Select
                label="Annual Rate (p.a.)"
                value={String(annualRatePercent)}
                onChange={(e) => setAnnualRatePercent(Number(e.target.value))}
                options={[
                  { value: '18', label: '18% p.a.' },
                  { value: '22', label: '22% p.a. (Standard)' },
                  { value: '26', label: '26% p.a.' },
                ]}
              />
            </div>

            <div className="p-4 rounded-control bg-elevated border border-line flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-xs text-ink-secondary block">
                  Estimated Monthly Repayment ({tenureMonths} months)
                </span>
                <PriceTag kobo={monthlyPaymentKobo} size="lg" />
              </div>
              <div className="text-xs text-ink-secondary sm:text-right tabular-nums">
                <div>Down Payment: {formatKobo(downPaymentKobo)}</div>
                <div>Financed Amount: {formatKobo(principalKobo)}</div>
              </div>
            </div>
          </Card>
        </div>

        {/* RIGHT COLUMN: Sticky Pricing, Live Auction Panel & Seller Contact Card */}
        <div className="space-y-5 lg:sticky lg:top-20">
          {listing.isAuction && auction ? (
            <Card id="auction-bidding-card" padding="lg" className="space-y-4 ring-1 ring-brand-500/40">
              <div className="flex items-center justify-between gap-2">
                <Badge variant={auction.status === 'live' ? 'live' : 'neutral'}>
                  {auction.status === 'live' ? 'LIVE AUCTION' : auction.status.toUpperCase()}
                </Badge>
                <Badge variant={auction.reserveStatus} />
              </div>

              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted block">
                  Current High Bid ({auction.bidCount} bids)
                </span>
                <PriceTag kobo={auction.currentPriceKobo} size="xl" />
                {auction.winningBidderMasked && (
                  <p className="text-xs font-mono text-ink-secondary mt-1">
                    Leading Bidder: <strong>{auction.winningBidderMasked}</strong>
                  </p>
                )}
              </div>

              <div className="p-3.5 rounded-control bg-elevated border border-line flex items-center justify-between">
                <span className="text-xs text-ink-secondary">Time Remaining</span>
                <Countdown endsAt={auction.endsAt} size="md" />
              </div>

              <div className="text-xs text-ink-secondary space-y-1">
                <div className="flex justify-between">
                  <span>Next Minimum Bid:</span>
                  <span className="font-mono tabular-nums font-semibold text-ink">
                    {formatKobo(
                      auction.currentPriceKobo + getBidIncrementKobo(auction.currentPriceKobo),
                    )}
                  </span>
                </div>
                {auction.buyNowPriceKobo && (
                  <div className="flex justify-between">
                    <span>Instant Buy Now Price:</span>
                    <span className="font-mono tabular-nums font-semibold text-brand-600">
                      {formatKobo(auction.buyNowPriceKobo)}
                    </span>
                  </div>
                )}
              </div>

              <Button
                variant="primary"
                size="lg"
                fullWidth
                leftIcon={<Gavel className="w-4 h-4" />}
                onClick={() =>
                  pushToast({
                    type: 'info',
                    title: 'Proxy Bidding Engine',
                    message:
                      'Live proxy bidding modal & refundable deposit lock connect in Phase 4.',
                  })
                }
              >
                Place Proxy Bid
              </Button>
            </Card>
          ) : (
            <Card padding="lg" className="space-y-4">
              <div>
                <span className="text-xs text-ink-muted block">Asking Price</span>
                <PriceTag
                  kobo={listing.priceKobo}
                  size="xl"
                  negotiable={listing.negotiable}
                />
                <p className="text-xs text-ink-secondary mt-1.5 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-brand-600" />
                  <span>
                    Inspect in <strong>{listing.lga}, {listing.state}</strong>
                  </span>
                </p>
              </div>

              <div className="space-y-2.5 pt-2">
                <Button
                  variant="primary"
                  size="md"
                  fullWidth
                  loading={startingChat}
                  leftIcon={<MessageSquare className="w-4 h-4" />}
                  onClick={handleStartChat}
                >
                  Found something you like? Chat Seller
                </Button>

                <Button
                  variant="outline"
                  size="md"
                  fullWidth
                  leftIcon={<Phone className="w-4 h-4" />}
                  onClick={handleRevealPhone}
                >
                  {phoneRevealed ? phoneRevealed : `Reveal Phone (${seller?.phoneMasked})`}
                </Button>

                <a
                  href={`https://wa.me/2348031000001?text=${whatsappText}`}
                  target="_blank"
                  rel="noreferrer"
                  className="block"
                >
                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    fullWidth
                    leftIcon={<MessageCircle className="w-4 h-4 text-brand-600" />}
                  >
                    WhatsApp Seller
                  </Button>
                </a>

                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={() => setReportModalOpen(true)}
                    className="text-xs text-ink-muted hover:text-signal-danger underline"
                  >
                    Report suspicious listing or fake documents
                  </button>
                </div>
              </div>
            </Card>
          )}

          {/* Seller Trust Card */}
          {seller && (
            <Card className="space-y-4">
              <div className="flex items-center gap-3">
                <Avatar
                  name={seller.displayName}
                  src={seller.avatarUrl}
                  size="md"
                  verified={seller.badges.idVerified || seller.badges.dealerVerified}
                />
                <div className="min-w-0">
                  <Link
                    to={`/users/${seller.id}`}
                    className="text-sm font-semibold text-ink hover:text-brand-600 truncate block"
                  >
                    {seller.displayName}
                  </Link>
                  <p className="text-xs text-ink-secondary flex items-center gap-1 mt-0.5">
                    <Clock className="w-3 h-3" />
                    <span>
                      Replies in ~{seller.avgResponseMinutes} mins ({seller.responseRatePercent}%
                      rate)
                    </span>
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {seller.badges.phoneVerified && <Badge variant="phone_verified" />}
                {seller.badges.idVerified && <Badge variant="id_verified" />}
                {seller.badges.dealerVerified && <Badge variant="dealer_verified" />}
              </div>

              {seller.dealerProfile && (
                <div className="p-3 rounded-control bg-elevated border border-line text-xs space-y-1">
                  <p className="font-semibold text-ink">{seller.dealerProfile.businessName}</p>
                  <p className="text-ink-secondary">{seller.dealerProfile.address}</p>
                  <p className="font-mono text-[11px] text-ink-muted">
                    CAC Verified: {seller.dealerProfile.cacNumber}
                  </p>
                </div>
              )}

              <Link to={`/users/${seller.id}`} className="block">
                <Button variant="ghost" size="sm" fullWidth>
                  View Seller Profile & Reviews ({seller.reviewCount})
                </Button>
              </Link>
            </Card>
          )}

          {/* Calm Collapsible Safety Banner */}
          <details className="rounded-card bg-surface border border-line p-4 text-xs group">
            <summary className="font-semibold text-ink cursor-pointer flex items-center justify-between list-none">
              <span className="inline-flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-brand-600" />
                <span>Safety Checklist Before You Pay</span>
              </span>
              <span className="text-ink-muted group-open:rotate-180 transition-transform">▼</span>
            </summary>
            <ul className="mt-3 space-y-1.5 text-ink-secondary pl-6 list-disc">
              <li>Never pay any inspection fee, delivery fee, or deposit before seeing the car.</li>
              <li>Meet in a busy daylight location with CCTV (e.g., Ikeja City Mall, Jabi Lake Mall).</li>
              <li>Verify the physical 17-digit VIN on the chassis matches the customs duty papers.</li>
            </ul>
          </details>
        </div>
      </div>

      {/* Similar Cars */}
      {similarListings.length > 0 && (
        <section className="space-y-4 pt-6 border-t border-line">
          <h2 className="text-xl font-bold text-ink">Similar Verified Cars</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {similarListings.map((sim) => (
              <ListingCard key={sim.id} item={sim} />
            ))}
          </div>
        </section>
      )}

      {/* Mobile Sticky Bottom CTA Bar */}
      <div className="md:hidden fixed bottom-16 inset-x-0 z-30 bg-surface/95 backdrop-blur-md border-t border-line p-3 flex items-center gap-2">
        <Button
          variant="primary"
          size="md"
          fullWidth
          loading={startingChat}
          leftIcon={<MessageSquare className="w-4 h-4" />}
          onClick={handleStartChat}
        >
          Chat
        </Button>
        <Button variant="outline" size="md" onClick={handleRevealPhone}>
          {phoneRevealed ? 'Call' : 'Phone'}
        </Button>
        <a
          href={`https://wa.me/2348031000001?text=${whatsappText}`}
          target="_blank"
          rel="noreferrer"
        >
          <Button variant="secondary" size="md">
            WhatsApp
          </Button>
        </a>
      </div>

      {/* Report Listing Modal */}
      <Modal
        open={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        title="Report Suspicious Listing"
        description="Listings with 3 unique reports are automatically hidden pending moderator inspection."
      >
        <form onSubmit={handleSubmitReport} className="space-y-4">
          <Select
            label="Reason for Report"
            value={reportReason}
            onChange={(e) => setReportReason(e.target.value)}
            options={[
              { value: 'scam_or_advance_fee', label: 'Asks for payment/transport fee before inspection' },
              { value: 'fake_customs_documents', label: 'Suspected fake customs duty documents' },
              { value: 'cloned_vin_or_odometer', label: 'Cloned VIN or rolled-back odometer' },
              { value: 'wrong_price_or_bait', label: 'Unrealistic bait price' },
            ]}
          />
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-ink-secondary">
              Additional Details
            </label>
            <textarea
              rows={3}
              value={reportDetails}
              onChange={(e) => setReportDetails(e.target.value)}
              placeholder="Share what happened so our moderators can investigate..."
              className="w-full rounded-control bg-surface border border-line p-3 text-sm text-ink"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setReportModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="danger">
              Submit Report
            </Button>
          </div>
        </form>
      </Modal>

      {/* Fullscreen Lightbox Modal */}
      <Modal
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        title={`${listing.title} — ${currentPhoto.angle.toUpperCase()}`}
        description={`Photo ${activePhotoIdx + 1} of ${photos.length}`}
      >
        <div className="space-y-4">
          <img
            src={currentPhoto.url}
            alt={listing.title}
            className="w-full rounded-control object-contain max-h-[60vh]"
          />
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setActivePhotoIdx((prev) => (prev === 0 ? photos.length - 1 : prev - 1))
              }
            >
              Previous Angle
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setActivePhotoIdx((prev) => (prev === photos.length - 1 ? 0 : prev + 1))
              }
            >
              Next Angle
            </Button>
          </div>
        </div>
      </Modal>

      {/* Mobile Sticky Contact & Bidding Action Bar */}
      <div className="lg:hidden fixed bottom-[calc(3.5rem+env(safe-area-inset-bottom))] inset-x-0 z-30 bg-surface/95 backdrop-blur-md border-t border-line px-3.5 py-2.5 shadow-lg flex items-center justify-between gap-3">
        <div className="min-w-0">
          <span className="text-[10px] text-ink-muted block uppercase tracking-wider font-semibold">
            {listing.isAuction ? 'Current High Bid' : 'Asking Price'}
          </span>
          <p className="font-bold text-ink text-sm sm:text-base font-mono tabular-nums truncate">
            {listing.isAuction && auction
              ? formatKobo(auction.currentPriceKobo)
              : formatKobo(listing.priceKobo)}
          </p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {listing.isAuction ? (
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Gavel className="w-3.5 h-3.5" />}
              onClick={() => {
                document.getElementById('auction-bidding-card')?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              Place Bid
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                className="px-2.5 min-w-[38px]"
                onClick={handleRevealPhone}
                aria-label="Call seller"
                title="Call seller"
              >
                <Phone className="w-4 h-4 text-brand-600" />
              </Button>
              <a
                href={`https://wa.me/2348031000001?text=${whatsappText}`}
                target="_blank"
                rel="noreferrer"
                aria-label="WhatsApp seller"
                title="WhatsApp seller"
              >
                <Button variant="secondary" size="sm" className="px-2.5 min-w-[38px]">
                  <MessageCircle className="w-4 h-4 text-brand-600" />
                </Button>
              </a>
              <Button
                variant="primary"
                size="sm"
                loading={startingChat}
                leftIcon={<MessageSquare className="w-3.5 h-3.5" />}
                onClick={handleStartChat}
              >
                Chat Seller
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

