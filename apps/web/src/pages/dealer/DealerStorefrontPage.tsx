import React, { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  CheckCircle2,
  Clock,
  Eye,
  MapPin,
  MessageSquare,
  Phone,
  ShieldCheck,
  Sparkles,
  Store,
} from 'lucide-react';
import { formatKobo } from '@autodey/shared';
import { apiRequest } from '../../lib/api';
import { useAppStore } from '../../stores/useAppStore';
import { ListingCard, type ListingSummaryItem } from '../../components/listings/ListingCards';
import { Badge, Button, Card, EmptyState, Input, Modal, Skeleton } from '../../components/ui';

interface DealerProfileItem {
  _id: string;
  userId: string;
  slug: string;
  businessName: string;
  cacNumber: string;
  status?: 'pending' | 'approved' | 'rejected';
  cacStatus?: 'pending' | 'approved' | 'rejected';
  address: string;
  state: string;
  lga: string;
  logoUrl?: string;
  bannerUrl?: string;
  openingHours: string;
  planTier: 'free' | 'starter' | 'pro' | 'premier';
  listingLimit?: number;
  planExpiresAt?: string;
  leadStats?: {
    views?: number;
    phoneReveals?: number;
    chatStarts?: number;
    totalViews?: number;
    totalPhoneReveals?: number;
    totalChatStarts?: number;
  };
}

interface DealerStorefrontResponse {
  dealer: DealerProfileItem;
  seller?: {
    _id: string;
    displayName: string;
    verification?: {
      phoneVerified: boolean;
      idVerified: boolean;
      dealerVerified: boolean;
    };
  } | null;
  inventory: Array<ListingSummaryItem & { _id?: string }>;
  leadStats?: {
    totalViews: number;
    totalPhoneReveals: number;
    totalChatStarts: number;
    totalFavorites: number;
  };
}

interface PricingConfigResponse {
  dealerPlans: Record<
    string,
    {
      label: string;
      monthlyKobo?: number;
      monthlyPriceKobo?: number;
      maxActiveListings?: number;
      listingLimit?: number;
      description?: string;
    }
  >;
}

export function DealerStorefrontPage(): React.ReactElement {
  const { slug } = useParams<{ slug?: string }>();
  const navigate = useNavigate();
  const user = useAppStore((s) => s.user);
  const queryClient = useQueryClient();

  const [showSubscribeModal, setShowSubscribeModal] = useState(false);
  const [selectedTier, setSelectedTier] = useState<'starter' | 'pro' | 'premier'>('pro');
  const [businessName, setBusinessName] = useState('');
  const [cacNumber, setCacNumber] = useState('RC-1948201');
  const [address, setAddress] = useState('Plot 14 Lekki-Epe Expressway');
  const [stateName, setStateName] = useState('Lagos');
  const [lga, setLga] = useState('Eti-Osa');
  const [openingHours, setOpeningHours] = useState('Mon-Sat 8:00 AM - 6:00 PM');
  const [subFeedback, setSubFeedback] = useState<string | null>(null);

  const directoryQuery = useQuery({
    queryKey: ['dealers-directory'],
    queryFn: () => apiRequest<{ dealers: DealerProfileItem[] }>('/dealers'),
    enabled: !slug,
  });

  const storefrontQuery = useQuery({
    queryKey: ['dealer-storefront', slug],
    queryFn: () => apiRequest<DealerStorefrontResponse>(`/dealers/${slug}`),
    enabled: Boolean(slug),
  });

  const pricingQuery = useQuery({
    queryKey: ['pricing-config'],
    queryFn: () => apiRequest<PricingConfigResponse>('/pricing/config'),
  });

  const subscribeMutation = useMutation({
    mutationFn: () =>
      apiRequest<{ dealerProfile: DealerProfileItem }>('/dealers/subscribe', {
        method: 'POST',
        body: JSON.stringify({
          planTier: selectedTier,
          businessName: businessName || `${user?.displayName || 'Auto'} Motors Ltd`,
          cacNumber,
          address,
          state: stateName,
          lga,
          openingHours,
        }),
      }),
    onSuccess: (res) => {
      setSubFeedback(
        `Dealer subscription (${res.dealerProfile.planTier.toUpperCase()}) activated! Storefront slug: /dealer/${res.dealerProfile.slug}`,
      );
      void queryClient.invalidateQueries({ queryKey: ['dealers-directory'] });
      void queryClient.invalidateQueries({ queryKey: ['dealer-storefront'] });
    },
  });

  if (!slug) {
    const dealers = directoryQuery.data?.dealers ?? [];
    const plans = pricingQuery.data?.dealerPlans ?? {};

    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col justify-between gap-4 rounded-2xl border border-line bg-surface p-6 sm:flex-row sm:items-center">
          <div>
            <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-brand-700 dark:text-brand-500">
              <Store className="h-3.5 w-3.5" />
              Verified Nigerian Car Dealerships
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
              Verified Dealer Showrooms
            </h1>
            <p className="mt-1 text-sm text-ink-secondary">
              Browse CAC-verified motor lots in Berger, Lekki, Maitama, Port Harcourt, and Kano.
            </p>
          </div>
          {user && (
            <Button
              variant="primary"
              leftIcon={<Sparkles className="h-4 w-4" />}
              onClick={() => setShowSubscribeModal(true)}
            >
              Open / Upgrade Dealer Showroom
            </Button>
          )}
        </div>

        {/* Dealer Plans Comparison */}
        {Object.keys(plans).length > 0 && (
          <div className="mb-10 grid grid-cols-1 gap-4 md:grid-cols-3">
            {Object.entries(plans).map(([tier, info]) => {
              const priceKobo = info.monthlyPriceKobo ?? info.monthlyKobo ?? 0;
              const limit = info.listingLimit ?? info.maxActiveListings ?? 25;
              return (
                <Card key={tier} className="flex flex-col justify-between p-5">
                  <div>
                    <div className="flex items-center justify-between">
                      <Badge variant={tier === 'premier' ? 'dealer_verified' : 'phone_verified'}>
                        {info.label || tier.toUpperCase()}
                      </Badge>
                      <span className="font-mono text-lg font-bold tabular-nums text-ink">
                        {formatKobo(priceKobo)}/mo
                      </span>
                    </div>
                    <p className="mt-3 text-sm text-ink-secondary">
                      {info.description ??
                        'Dedicated dealer showroom, CAC badge, and lead analytics.'}
                    </p>
                    <p className="mt-2 text-xs font-semibold text-brand-700 dark:text-brand-500">
                      Up to {limit} active vehicles
                    </p>
                  </div>
                  {user && (
                    <Button
                      variant="secondary"
                      size="sm"
                      className="mt-4 w-full"
                      onClick={() => {
                        setSelectedTier(tier as 'starter' | 'pro' | 'premier');
                        setShowSubscribeModal(true);
                      }}
                    >
                      Choose {info.label || tier.toUpperCase()}
                    </Button>
                  )}
                </Card>
              );
            })}
          </div>
        )}

        {directoryQuery.isLoading ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((n) => (
              <Skeleton key={n} className="h-48 w-full rounded-2xl" />
            ))}
          </div>
        ) : dealers.length === 0 ? (
          <EmptyState
            icon={<Building2 className="h-6 w-6" />}
            title="No dealer showrooms registered yet"
            description="Dealers can subscribe to a monthly showroom plan to unlock higher listing limits and dedicated inventory URLs."
          />
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {dealers.map((dealer) => {
              const isApproved =
                dealer.status === 'approved' || dealer.cacStatus === 'approved';
              const viewsCount =
                dealer.leadStats?.totalViews ?? dealer.leadStats?.views;

              return (
                <Link
                  key={dealer._id}
                  to={`/dealer/${dealer.slug}`}
                  className="group block rounded-2xl border border-line bg-surface p-5 transition hover:border-brand-500/60 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-lg font-bold text-ink group-hover:text-brand-600">
                          {dealer.businessName}
                        </h2>
                        {isApproved && <CheckCircle2 className="h-4 w-4 text-brand-600" />}
                      </div>
                      <p className="mt-1 flex items-center gap-1 text-xs text-ink-secondary">
                        <MapPin className="h-3.5 w-3.5" />
                        {dealer.address}, {dealer.lga}, {dealer.state}
                      </p>
                    </div>
                    <Badge variant="dealer_verified">
                      {(dealer.planTier || 'pro').toUpperCase()}
                    </Badge>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-xs text-ink-secondary">
                    <span>CAC: {dealer.cacNumber}</span>
                    <span className="font-mono tabular-nums">
                      {viewsCount !== undefined
                        ? `${viewsCount} showroom views`
                        : `Limit: ${dealer.listingLimit ?? 50} cars`}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        <Modal
          open={showSubscribeModal}
          onClose={() => setShowSubscribeModal(false)}
          title="Activate Dealer Plan & Storefront"
        >
          <div className="space-y-4">
            {subFeedback && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs font-medium text-brand-700 dark:text-brand-500">
                {subFeedback}
              </div>
            )}
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-secondary">
                Select Plan Tier
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['starter', 'pro', 'premier'] as const).map((tier) => (
                  <button
                    key={tier}
                    type="button"
                    onClick={() => setSelectedTier(tier)}
                    className={`rounded-xl border px-3 py-2 text-xs font-semibold uppercase transition ${
                      selectedTier === tier
                        ? 'border-brand-600 bg-emerald-500/10 text-brand-700 dark:text-brand-500'
                        : 'border-line text-ink-secondary'
                    }`}
                  >
                    {tier}
                  </button>
                ))}
              </div>
            </div>
            <Input
              label="Registered Dealership Name"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="e.g. Lekki Luxury Motors Ltd"
            />
            <Input
              label="CAC Registration Number"
              value={cacNumber}
              onChange={(e) => setCacNumber(e.target.value)}
              placeholder="RC-1234567"
            />
            <Input
              label="Showroom Street Address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="State"
                value={stateName}
                onChange={(e) => setStateName(e.target.value)}
              />
              <Input label="LGA" value={lga} onChange={(e) => setLga(e.target.value)} />
            </div>
            <Input
              label="Opening Hours"
              value={openingHours}
              onChange={(e) => setOpeningHours(e.target.value)}
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setShowSubscribeModal(false)}>
                Close
              </Button>
              <Button
                variant="primary"
                loading={subscribeMutation.isPending}
                onClick={() => subscribeMutation.mutate()}
              >
                Subscribe via Paystack
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    );
  }

  if (storefrontQuery.isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Skeleton className="h-56 w-full rounded-2xl" />
      </div>
    );
  }

  const data = storefrontQuery.data;
  if (!data) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <EmptyState
          icon={<Store className="h-6 w-6" />}
          title="Dealer storefront not found"
          description="Check the URL or browse all verified dealer showrooms."
          actionLabel="View All Dealers"
          onAction={() => navigate('/dealers')}
        />
      </div>
    );
  }

  const { dealer, inventory } = data;
  const isApproved = dealer.status === 'approved' || dealer.cacStatus === 'approved';
  const totalViews =
    data.leadStats?.totalViews ?? dealer.leadStats?.totalViews ?? dealer.leadStats?.views ?? 0;
  const totalCalls =
    data.leadStats?.totalPhoneReveals ??
    dealer.leadStats?.totalPhoneReveals ??
    dealer.leadStats?.phoneReveals ??
    0;
  const totalChats =
    data.leadStats?.totalChatStarts ??
    dealer.leadStats?.totalChatStarts ??
    dealer.leadStats?.chatStarts ??
    0;

  return (
    <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8 py-6 sm:py-8">
      {/* Dealer Banner & Header */}
      <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
        <div className="bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 px-4 sm:px-6 py-6 sm:py-8 text-white">
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-1.5 sm:gap-2">
                <Badge variant="dealer_verified">
                  {(dealer.planTier || 'pro').toUpperCase()} DEALER
                </Badge>
                {isApproved && (
                  <Badge variant="id_verified">
                    <ShieldCheck className="mr-1 h-3.5 w-3.5" />
                    CAC Verified ({dealer.cacNumber})
                  </Badge>
                )}
              </div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight">
                {dealer.businessName}
              </h1>
              <p className="mt-1 flex items-center gap-1.5 text-xs sm:text-sm text-slate-300">
                <MapPin className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-400 shrink-0" />
                <span>{dealer.address}, {dealer.lga}, {dealer.state}</span>
              </p>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-400">
                <Clock className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                <span>{dealer.openingHours}</span>
              </p>
            </div>

            {/* Lead Stats */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3 rounded-xl border border-white/10 bg-white/5 p-2.5 sm:p-3.5 text-center backdrop-blur w-full md:w-auto">
              <div>
                <div className="flex items-center justify-center gap-1 text-[11px] sm:text-xs text-slate-300">
                  <Eye className="h-3.5 w-3.5 text-emerald-400" />
                  Views
                </div>
                <p className="mt-1 font-mono text-base sm:text-lg font-bold tabular-nums">{totalViews}</p>
              </div>
              <div>
                <div className="flex items-center justify-center gap-1 text-[11px] sm:text-xs text-slate-300">
                  <Phone className="h-3.5 w-3.5 text-emerald-400" />
                  Calls
                </div>
                <p className="mt-1 font-mono text-base sm:text-lg font-bold tabular-nums">{totalCalls}</p>
              </div>
              <div>
                <div className="flex items-center justify-center gap-1 text-[11px] sm:text-xs text-slate-300">
                  <MessageSquare className="h-3.5 w-3.5 text-emerald-400" />
                  Chats
                </div>
                <p className="mt-1 font-mono text-base sm:text-lg font-bold tabular-nums">{totalChats}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Active Inventory */}
      <div className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-ink">
            Showroom Inventory ({inventory.length})
          </h2>
          <Link to="/dealers" className="text-xs font-semibold text-brand-600 hover:underline">
            All Dealer Showrooms
          </Link>
        </div>

        {inventory.length === 0 ? (
          <EmptyState
            icon={<Building2 className="h-6 w-6" />}
            title="No active vehicles in this showroom"
            description="Check back soon for newly inspected vehicles from this dealer."
          />
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {inventory.map((rawItem) => {
              const normalizedItem: ListingSummaryItem = {
                ...rawItem,
                id: rawItem.id || String(rawItem._id || ''),
              };
              return <ListingCard key={normalizedItem.id} item={normalizedItem} />;
            })}
          </div>
        )}
      </div>
    </div>
  );
}
