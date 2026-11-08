import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  Eye,
  Heart,
  MessageSquare,
  Phone,
  PlusCircle,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { formatKobo } from '@autodey/shared';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Modal,
  PriceTag,
  Skeleton,
  useToast,
} from '../../components/ui';
import { apiRequest } from '../../lib/api';
import { useAppStore } from '../../stores/useAppStore';

interface SellerDashboardData {
  summary: {
    views: number;
    phoneReveals: number;
    chatStarts: number;
    favoritesCount: number;
    activeCount: number;
    soldCount: number;
  };
  listings: Array<{
    id: string;
    slug: string;
    title: string;
    year: number;
    make: string;
    model: string;
    state: string;
    lga: string;
    priceKobo: number;
    negotiable: boolean;
    status: string;
    moderationFlags: string[];
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
    expiresAt: string;
  }>;
}

interface PromotionPricing {
  label: string;
  priceKobo: number;
  durationDays: number;
  description: string;
}

export const SellerDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { pushToast } = useToast();
  const user = useAppStore((s) => s.user);
  const [data, setData] = useState<SellerDashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const [boostListingId, setBoostListingId] = useState<string | null>(null);
  const [promotionsConfig, setPromotionsConfig] = useState<Record<string, PromotionPricing>>({});
  const [selectedPromoType, setSelectedPromoType] = useState<
    'top_ad' | 'featured' | 'urgent' | 'bump_up'
  >('top_ad');
  const [boosting, setBoosting] = useState(false);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const [res, pricing] = await Promise.all([
        apiRequest<SellerDashboardData>('/seller/dashboard'),
        apiRequest<{ promotions: Record<string, PromotionPricing> }>('/pricing/config'),
      ]);
      setData(res);
      setPromotionsConfig(pricing.promotions ?? {});
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    void loadDashboard();
  }, [user]);

  const handleListingAction = async (listingId: string, action: 'mark_sold' | 'renew') => {
    try {
      await apiRequest(`/listings/${listingId}`, {
        method: 'PATCH',
        body: JSON.stringify({ action }),
      });
      await loadDashboard();
      pushToast({
        type: 'success',
        title: action === 'mark_sold' ? 'Marked as Sold' : 'Listing Renewed (+60 Days)',
      });
    } catch (err) {
      pushToast({
        type: 'error',
        title: 'Action Failed',
        message: err instanceof Error ? err.message : 'Try again.',
      });
    }
  };

  const handlePromoteCheckout = async () => {
    if (!boostListingId) return;
    setBoosting(true);
    try {
      await apiRequest('/promotions/checkout', {
        method: 'POST',
        body: JSON.stringify({
          listingId: boostListingId,
          type: selectedPromoType,
        }),
      });
      setBoostListingId(null);
      await loadDashboard();
      pushToast({
        type: 'success',
        title: 'Promotion Activated',
        message: `Your listing is now boosted with ${selectedPromoType.replace('_', ' ').toUpperCase()}.`,
      });
    } catch (err) {
      pushToast({
        type: 'error',
        title: 'Promotion Checkout Failed',
        message: err instanceof Error ? err.message : 'Try again.',
      });
    } finally {
      setBoosting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        <Skeleton className="h-28 w-full rounded-card" />
        <Skeleton className="h-64 w-full rounded-card" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <Badge variant="phone_verified">Seller Analytics & Inventory</Badge>
          <h1 className="text-2xl md:text-3xl font-bold text-ink mt-1.5">Seller Dashboard</h1>
          <p className="text-sm text-ink-secondary">
            Track views, phone reveals, buyer chat inquiries, and watchlist saves across your cars.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link to="/dealers">
            <Button variant="secondary" leftIcon={<Sparkles className="w-4 h-4 text-brand-600" />}>
              Dealer Plans & Showroom
            </Button>
          </Link>
          <Link to="/sell">
            <Button variant="primary" leftIcon={<PlusCircle className="w-4 h-4" />}>
              Post New Vehicle
            </Button>
          </Link>
        </div>
      </div>

      {/* Aggregate Analytics Cards */}
      {data && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Listing Views', val: data.summary.views, icon: Eye },
            { label: 'Phone Number Reveals', val: data.summary.phoneReveals, icon: Phone },
            { label: 'Buyer Chat Starts', val: data.summary.chatStarts, icon: MessageSquare },
            { label: 'Watchlist Saves', val: data.summary.favoritesCount, icon: Heart },
          ].map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.label} className="space-y-2">
                <div className="flex items-center justify-between text-ink-secondary">
                  <span className="text-xs font-medium">{stat.label}</span>
                  <Icon className="w-4 h-4 text-brand-600" />
                </div>
                <p className="text-2xl md:text-3xl font-bold font-mono tabular-nums text-ink">
                  {stat.val.toLocaleString()}
                </p>
              </Card>
            );
          })}
        </div>
      )}

      {/* Inventory List */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-ink">
          Your Vehicle Listings ({data?.listings.length ?? 0})
        </h2>

        {!data || data.listings.length === 0 ? (
          <EmptyState
            icon={<PlusCircle className="w-6 h-6" />}
            title="You haven’t posted any vehicles yet"
            description="Use our 4-step mobile wizard to list your car in under 2 minutes."
            actionLabel="Post Your First Car"
            onAction={() => navigate('/sell')}
          />
        ) : (
          <div className="space-y-3">
            {data.listings.map((item) => (
              <Card
                key={item.id}
                padding="md"
                className="flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <img
                    src={item.coverPhotoUrl}
                    alt={item.title}
                    className="w-24 h-18 rounded-control object-cover shrink-0 border border-line"
                  />
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        to={`/cars/${item.state.toLowerCase()}/${item.slug}`}
                        className="text-base font-semibold text-ink hover:text-brand-600 truncate"
                      >
                        {item.title}
                      </Link>
                      <Badge
                        variant={
                          item.status === 'active'
                            ? 'phone_verified'
                            : item.status === 'pending_review'
                              ? 'reserve_not_met'
                              : 'neutral'
                        }
                      >
                        {item.status.replace(/_/g, ' ').toUpperCase()}
                      </Badge>
                    </div>
                    <PriceTag kobo={item.priceKobo} size="sm" negotiable={item.negotiable} />
                    <div className="flex flex-wrap items-center gap-4 text-xs text-ink-secondary tabular-nums pt-1">
                      <span>{item.stats.views} views</span>
                      <span>•</span>
                      <span>{item.stats.phoneReveals} phone reveals</span>
                      <span>•</span>
                      <span>{item.stats.chatStarts} chats</span>
                      <span>•</span>
                      <span>{item.stats.favoritesCount} saves</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {item.status === 'active' && (
                    <>
                      <Button
                        variant="amber"
                        size="sm"
                        leftIcon={<Sparkles className="w-3.5 h-3.5" />}
                        onClick={() => setBoostListingId(item.id)}
                      >
                        Boost Ad
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        leftIcon={<CheckCircle2 className="w-3.5 h-3.5 text-brand-600" />}
                        onClick={() => handleListingAction(item.id, 'mark_sold')}
                      >
                        Mark Sold
                      </Button>
                    </>
                  )}
                  <Button
                    variant="secondary"
                    size="sm"
                    leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
                    onClick={() => handleListingAction(item.id, 'renew')}
                  >
                    Renew (60d)
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Promotion Checkout Modal */}
      <Modal
        open={Boolean(boostListingId)}
        onClose={() => setBoostListingId(null)}
        title="Promote Vehicle Listing"
        description="Prices and durations are loaded dynamically from platform configuration."
      >
        <div className="space-y-3">
          {(['top_ad', 'featured', 'urgent', 'bump_up'] as const).map((promoKey) => {
            const info = promotionsConfig[promoKey];
            if (!info) return null;
            const active = selectedPromoType === promoKey;
            return (
              <button
                key={promoKey}
                type="button"
                onClick={() => setSelectedPromoType(promoKey)}
                className={`w-full rounded-xl border p-3.5 text-left transition ${
                  active
                    ? 'border-brand-600 bg-emerald-500/10'
                    : 'border-line bg-surface hover:border-brand-500/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-ink">{info.label}</span>
                  <span className="font-mono text-sm font-bold tabular-nums text-brand-600">
                    {formatKobo(info.priceKobo)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-ink-secondary">{info.description}</p>
              </button>
            );
          })}

          <div className="flex justify-end gap-2 pt-3">
            <Button variant="ghost" onClick={() => setBoostListingId(null)}>
              Cancel
            </Button>
            <Button variant="primary" loading={boosting} onClick={handlePromoteCheckout}>
              Pay with Paystack
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
