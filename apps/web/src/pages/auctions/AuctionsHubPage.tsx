import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Gavel, ShieldCheck, Wallet, Zap } from 'lucide-react';
import { apiRequest } from '../../lib/api';
import {
  Badge,
  Button,
  Card,
  Countdown,
  EmptyState,
  PriceTag,
  Skeleton,
  Tabs,
} from '../../components/ui';

interface AuctionsListResponse {
  items: Array<{
    _id: string;
    listingId: string;
    status: string;
    startPrice: number;
    currentPrice: number;
    reserveMet: boolean;
    hasReserve: boolean;
    buyNowPrice: number | null;
    buyNowAvailable: boolean;
    endsAt: string;
    extensions: number;
    bidCount: number;
    listing?: {
      _id: string;
      title: string;
      slug: string;
      make: string;
      model: string;
      year: number;
      mileageKm: number;
      transmission: string;
      state: string;
      lga: string;
      vinVerified?: boolean;
      customsVerified?: boolean;
      images?: Array<{ url: string }>;
    };
  }>;
  serverTimeMs: number;
}

export function AuctionsHubPage() {
  const [statusTab, setStatusTab] = useState<string>('live');

  const { data, isLoading } = useQuery({
    queryKey: ['auctions-list', statusTab],
    queryFn: () => apiRequest<AuctionsListResponse>(`/auctions?status=${statusTab}&limit=30`),
    refetchInterval: 10000,
  });

  const items = data?.items ?? [];

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-6 sm:py-8 space-y-6 sm:space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand-600 mb-1">
            <Gavel className="w-4 h-4" />
            Verified Seller Timed Auctions
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-ink">
            Live Nigerian Car Auctions
          </h1>
          <p className="text-sm text-ink-secondary mt-1">
            Automatic proxy bidding, +2m soft-close anti-sniping, VIN & customs verification, and
            refundable serious-bidder deposits.
          </p>
        </div>

        <Link to="/wallet" className="w-full sm:w-auto">
          <Button variant="primary" fullWidth className="sm:w-auto" leftIcon={<Wallet className="w-4 h-4" />}>
            Refundable Bidding Deposit Wallet
          </Button>
        </Link>
      </div>

      <div className="overflow-x-auto max-w-full pb-1">
        <Tabs
          tabs={[
            { id: 'live', label: 'Live Auctions' },
            { id: 'sold_pending_settlement', label: 'In Settlement' },
            { id: 'ended_reserve_not_met', label: 'Reserve Not Met (Make Offer)' },
            { id: 'all', label: 'All Auctions' },
          ]}
          activeTab={statusTab}
          onChange={setStatusTab}
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <Skeleton key={n} className="h-96 rounded-card" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Gavel className="w-8 h-8 text-brand-600" />}
          title="No auctions in this state"
          description="Switch tabs above to view live or recently concluded vehicle auctions."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((auc) => {
            const listing = auc.listing;
            const coverUrl =
              listing?.images?.[0]?.url ||
              'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=900&q=80';

            return (
              <Card
                key={auc._id}
                padding="none"
                interactive
                className="overflow-hidden flex flex-col ring-1 ring-brand-500/35"
              >
                <Link to={`/auctions/${auc._id}`} className="block relative aspect-[4/3] bg-elevated">
                  <img
                    src={coverUrl}
                    alt={listing?.title ?? 'Auction Car'}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
                    {auc.status === 'live' ? (
                      <Badge variant="live" />
                    ) : (
                      <Badge variant="neutral">{auc.status.replace(/_/g, ' ').toUpperCase()}</Badge>
                    )}
                    {!auc.hasReserve ? (
                      <Badge variant="no_reserve" />
                    ) : auc.reserveMet ? (
                      <Badge variant="reserve_met" />
                    ) : (
                      <Badge variant="reserve_not_met" />
                    )}
                  </div>
                  {auc.status === 'live' && (
                    <div className="absolute bottom-3 left-3">
                      <Countdown endsAt={auc.endsAt} size="md" />
                    </div>
                  )}
                </Link>

                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-baseline justify-between gap-2">
                      <div>
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted block">
                          Current Bid ({auc.bidCount} bids)
                        </span>
                        <PriceTag kobo={auc.currentPrice} size="lg" />
                      </div>
                      {auc.buyNowAvailable && auc.buyNowPrice && (
                        <span className="inline-flex items-center gap-1 text-xs font-mono font-semibold text-amber-600">
                          <Zap className="w-3.5 h-3.5" /> Buy Now
                        </span>
                      )}
                    </div>

                    <Link to={`/auctions/${auc._id}`}>
                      <h3 className="text-base font-semibold text-ink mt-1.5 hover:text-brand-600 line-clamp-1">
                        {listing?.title ?? 'Verified Auction Vehicle'}
                      </h3>
                    </Link>

                    {listing && (
                      <p className="text-xs text-ink-secondary mt-1">
                        <span className="font-mono tabular-nums">
                          {listing.mileageKm?.toLocaleString()} km
                        </span>{' '}
                        • {listing.transmission} • {listing.lga}, {listing.state}
                      </p>
                    )}
                  </div>

                  <div className="pt-3 border-t border-line flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1 text-[11px] text-ink-secondary">
                      <ShieldCheck className="w-3.5 h-3.5 text-brand-600" />
                      <span>Refundable Deposit</span>
                    </span>
                    <Link to={`/auctions/${auc._id}`}>
                      <Button variant="primary" size="sm" leftIcon={<Gavel className="w-3.5 h-3.5" />}>
                        {auc.status === 'live' ? 'Enter Bidding Room' : 'View Auction'}
                      </Button>
                    </Link>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

