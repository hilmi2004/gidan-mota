import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Gavel, Heart, MapPin, ShieldCheck } from 'lucide-react';
import { Avatar, Badge, Button, Card, Countdown, PriceTag, useToast } from '../ui';
import { apiRequest } from '../../lib/api';
import { useAppStore } from '../../stores/useAppStore';

export interface ListingSummaryItem {
  id: string;
  slug: string;
  title: string;
  category?: string;
  make: string;
  model: string;
  trim?: string;
  year: number;
  condition: string;
  mileageKm: number;
  transmission: string;
  state: string;
  lga: string;
  priceKobo: number;
  negotiable: boolean;
  coverPhotoUrl: string;
  badges: {
    vinChecked: boolean;
    customsReviewed: boolean;
    inspected: boolean;
  };
  promotion?: {
    isTopAd?: boolean;
    isFeatured?: boolean;
    isUrgent?: boolean;
  };
  isAuction?: boolean;
  isFavorited?: boolean;
  seller?: {
    id: string;
    displayName: string;
    avatarUrl?: string;
    badges: {
      phoneVerified: boolean;
      idVerified: boolean;
      dealerVerified: boolean;
    };
  } | null;
  auction?: {
    id: string;
    status: string;
    startPriceKobo: number;
    currentPriceKobo: number;
    buyNowPriceKobo?: number | null;
    reserveStatus: 'no_reserve' | 'reserve_met' | 'reserve_not_met';
    endsAt: string;
    bidCount: number;
  } | null;
}

function formatConditionLabel(cond: string): string {
  if (cond === 'foreign_used') return 'Foreign Used (Tokunbo)';
  if (cond === 'nigerian_used') return 'Nigerian Used';
  if (cond === 'brand_new') return 'Brand New';
  return cond;
}

export const ListingCard: React.FC<{
  item: ListingSummaryItem;
  onFavoriteToggled?: (id: string, favorited: boolean) => void;
}> = ({ item, onFavoriteToggled }) => {
  const navigate = useNavigate();
  const { pushToast } = useToast();
  const user = useAppStore((s) => s.user);
  const dataSaver = useAppStore((s) => s.dataSaver);
  const [favorited, setFavorited] = useState(Boolean(item.isFavorited));

  const detailUrl = `/cars/${item.state.toLowerCase()}/${item.slug}`;
  const imgUrl = dataSaver
    ? item.coverPhotoUrl.replace('w=1000', 'w=480').replace('q=80', 'q=60')
    : item.coverPhotoUrl;

  const handleToggleFavorite = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      pushToast({
        type: 'info',
        title: 'Sign in to save cars',
        message: 'Verify your phone number to save favorites and price alerts.',
      });
      navigate('/auth');
      return;
    }

    const next = !favorited;
    setFavorited(next); // Optimistic UI for favorites
    onFavoriteToggled?.(item.id, next);

    try {
      const res = await apiRequest<{ favorited: boolean }>(`/favorites/${item.id}`, {
        method: 'POST',
      });
      setFavorited(res.favorited);
    } catch {
      setFavorited(!next);
    }
  };

  return (
    <Card
      padding="none"
      interactive
      onClick={() => navigate(detailUrl)}
      className="overflow-hidden flex flex-col group"
    >
      <div className="relative aspect-[4/3] bg-elevated overflow-hidden">
        <img
          src={imgUrl}
          alt={item.title}
          loading="lazy"
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
        />
        <div className="absolute top-2.5 left-2.5 flex flex-wrap gap-1.5">
          {item.promotion?.isTopAd && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-ink text-surface">
              Top Ad
            </span>
          )}
          {item.promotion?.isUrgent && <Badge variant="urgent" />}
          {item.badges.vinChecked && <Badge variant="vin_checked" />}
          {item.badges.customsReviewed && <Badge variant="customs_reviewed" />}
        </div>

        <button
          type="button"
          onClick={handleToggleFavorite}
          aria-label={favorited ? 'Remove from favorites' : 'Save to favorites'}
          className={`absolute top-2.5 right-2.5 w-9 h-9 rounded-full flex items-center justify-center backdrop-blur-md transition-transform active:scale-90 ${
            favorited
              ? 'bg-red-500 text-white shadow-sm'
              : 'bg-black/45 text-white hover:bg-black/65'
          }`}
        >
          <Heart className={`w-4 h-4 ${favorited ? 'fill-current' : ''}`} />
        </button>
      </div>

      <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
        <div>
          <PriceTag kobo={item.priceKobo} size="md" negotiable={item.negotiable} />
          <h3 className="text-sm font-semibold text-ink mt-1 line-clamp-1">{item.title}</h3>
          <p className="text-xs text-ink-secondary mt-0.5">
            {formatConditionLabel(item.condition)}
          </p>
          <p className="text-xs text-ink-muted mt-1.5 flex items-center gap-1.5">
            <span className="tabular-nums">{item.mileageKm.toLocaleString()} km</span>
            <span>•</span>
            <span className="capitalize">{item.transmission}</span>
            <span>•</span>
            <span className="inline-flex items-center gap-0.5 truncate">
              <MapPin className="w-3 h-3 shrink-0" /> {item.lga}, {item.state}
            </span>
          </p>
        </div>

        {item.seller && (
          <div className="pt-2.5 border-t border-line flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Avatar
                name={item.seller.displayName}
                src={item.seller.avatarUrl}
                size="sm"
                verified={item.seller.badges.idVerified || item.seller.badges.dealerVerified}
              />
              <span className="text-xs font-medium text-ink truncate">
                {item.seller.displayName}
              </span>
            </div>
            {item.seller.badges.dealerVerified && <Badge variant="dealer_verified">Dealer</Badge>}
          </div>
        )}
      </div>
    </Card>
  );
};

export const AuctionCard: React.FC<{ item: ListingSummaryItem }> = ({ item }) => {
  const navigate = useNavigate();
  const dataSaver = useAppStore((s) => s.dataSaver);
  const auction = item.auction;
  const detailUrl = auction ? `/auctions/${auction.id}` : `/cars/${item.state.toLowerCase()}/${item.slug}`;
  const imgUrl = dataSaver
    ? item.coverPhotoUrl.replace('w=1000', 'w=480').replace('q=80', 'q=60')
    : item.coverPhotoUrl;

  if (!auction) return <ListingCard item={item} />;

  return (
    <Card
      padding="none"
      interactive
      onClick={() => navigate(detailUrl)}
      className="overflow-hidden flex flex-col ring-1 ring-brand-500/35 group"
    >
      <div className="relative aspect-[4/3] bg-elevated overflow-hidden">
        <img
          src={imgUrl}
          alt={item.title}
          loading="lazy"
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
        />
        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
          {auction.status === 'live' ? (
            <Badge variant="live" />
          ) : (
            <Badge variant="neutral">{auction.status.replace(/_/g, ' ').toUpperCase()}</Badge>
          )}
          <Badge variant={auction.reserveStatus} />
        </div>
        <div className="absolute bottom-3 left-3">
          <Countdown endsAt={auction.endsAt} size="md" />
        </div>
      </div>

      <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
        <div>
          <div className="flex items-baseline justify-between gap-2">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted block">
                Current Bid ({auction.bidCount} bids)
              </span>
              <PriceTag kobo={auction.currentPriceKobo} size="lg" />
            </div>
            {item.badges.vinChecked && <Badge variant="vin_checked" />}
          </div>
          <h3 className="text-base font-semibold text-ink mt-1.5 line-clamp-1">{item.title}</h3>
          <p className="text-xs text-ink-secondary mt-1 flex items-center gap-1.5">
            <span className="tabular-nums">{item.mileageKm.toLocaleString()} km</span>
            <span>•</span>
            <span className="capitalize">{item.transmission}</span>
            <span>•</span>
            <span className="truncate">
              {item.lga}, {item.state}
            </span>
          </p>
        </div>

        <div className="pt-3 border-t border-line flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1 text-[11px] text-ink-secondary">
            <ShieldCheck className="w-3.5 h-3.5 text-brand-600" />
            <span>Refundable Deposit</span>
          </span>
          <Link to={detailUrl} onClick={(e) => e.stopPropagation()}>
            <Button variant="primary" size="sm" leftIcon={<Gavel className="w-3.5 h-3.5" />}>
              {auction.status === 'live' ? 'Bid Now' : 'View Result'}
            </Button>
          </Link>
        </div>
      </div>
    </Card>
  );
};

