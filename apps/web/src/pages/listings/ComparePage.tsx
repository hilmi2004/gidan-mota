import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeftRight,
  CheckCircle2,
  FileCheck2,
  Gauge,
  MapPin,
  Plus,
  ShieldCheck,
  Sparkles,
  Trash2,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { formatKobo } from '@autodey/shared';
import { apiRequest } from '../../lib/api';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  PriceTag,
  Select,
  Skeleton,
} from '../../components/ui';

interface ComparedVehicle {
  id: string;
  slug: string;
  title: string;
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
  accidentHistory: string;
  customsStatus: string;
  vin?: string;
  state: string;
  lga: string;
  priceKobo: number;
  negotiable: boolean;
  swapAccepted: boolean;
  features: string[];
  coverPhotoUrl: string;
  badges: {
    vinChecked: boolean;
    customsReviewed: boolean;
    inspected: boolean;
  };
  fairPrice: {
    available: boolean;
    comparableCount: number;
    medianPriceKobo: number | null;
    verdict: 'below_market' | 'fair_price' | 'above_market' | 'insufficient_data';
    deltaPercent: number | null;
  };
  seller: {
    id: string;
    displayName: string;
    verification: {
      phoneVerified: boolean;
      idVerified: boolean;
      dealerVerified: boolean;
    };
    ratingAvg: number;
    ratingCount: number;
    responseRatePercent: number;
  } | null;
}

export function ComparePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialIds = (searchParams.get('ids') || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 3);

  const [selectedIds, setSelectedIds] = useState<string[]>(initialIds);

  // Fetch catalog sample so user can easily add up to 3 cars if fewer than 3 are selected
  const { data: catalogData } = useQuery({
    queryKey: ['compare-catalog-options'],
    queryFn: () =>
      apiRequest<{
        items: Array<{ id: string; title: string; priceKobo: number; state: string }>;
      }>('/search?limit=24'),
  });

  // Auto-seed with 3 popular cars if user visits /compare with empty selection
  useEffect(() => {
    if (selectedIds.length === 0 && catalogData?.items && catalogData.items.length >= 3) {
      const topThree = catalogData.items.slice(0, 3).map((i) => i.id);
      setSelectedIds(topThree);
      setSearchParams({ ids: topThree.join(',') }, { replace: true });
    }
  }, [catalogData, selectedIds.length, setSearchParams]);

  const { data: compareData, isLoading } = useQuery({
    queryKey: ['compare-vehicles', selectedIds.join(',')],
    queryFn: () =>
      apiRequest<{ vehicles: ComparedVehicle[] }>(
        `/compare?ids=${encodeURIComponent(selectedIds.join(','))}`,
      ),
    enabled: selectedIds.length > 0,
  });

  const vehicles = compareData?.vehicles ?? [];
  const availableOptions = (catalogData?.items ?? []).filter(
    (item) => !selectedIds.includes(item.id),
  );

  const handleAddVehicle = (id: string) => {
    if (!id || selectedIds.includes(id) || selectedIds.length >= 3) return;
    const next = [...selectedIds, id].slice(0, 3);
    setSelectedIds(next);
    setSearchParams({ ids: next.join(',') });
  };

  const handleRemoveVehicle = (id: string) => {
    const next = selectedIds.filter((x) => x !== id);
    setSelectedIds(next);
    setSearchParams(next.length > 0 ? { ids: next.join(',') } : {});
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand-600 mb-1">
            <ArrowLeftRight className="w-4 h-4" />
            Side-by-Side Vehicle Intelligence
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-ink">
            Compare Up to 3 Vehicles
          </h1>
          <p className="text-sm text-ink-secondary mt-1">
            Compare Naira prices, fair-market median valuations, VIN & customs verification badges,
            and mechanical specs side by side.
          </p>
        </div>

        {selectedIds.length < 3 && availableOptions.length > 0 && (
          <div className="w-full md:w-80">
            <Select
              label={`Add Vehicle to Compare (${selectedIds.length}/3)`}
              value=""
              onChange={(e) => handleAddVehicle(e.target.value)}
              options={[
                { value: '', label: '+ Select a car to add...' },
                ...availableOptions.map((o) => ({
                  value: o.id,
                  label: `${o.title} (${formatKobo(o.priceKobo)})`,
                })),
              ]}
            />
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((n) => (
            <Skeleton key={n} className="h-[540px] rounded-card" />
          ))}
        </div>
      ) : vehicles.length === 0 ? (
        <EmptyState
          icon={<ArrowLeftRight className="w-8 h-8 text-brand-600" />}
          title="No vehicles selected for comparison"
          description="Select up to 3 vehicles from the dropdown above or from the search page."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {vehicles.map((v) => (
            <Card key={v.id} padding="none" className="overflow-hidden flex flex-col">
              <div className="relative aspect-[16/10] bg-elevated">
                <img
                  src={v.coverPhotoUrl}
                  alt={v.title}
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => handleRemoveVehicle(v.id)}
                  aria-label="Remove from comparison"
                  className="absolute top-2.5 right-2.5 p-2 rounded-full bg-black/60 text-white hover:bg-red-600 transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 flex-1 flex flex-col justify-between space-y-5">
                <div>
                  <PriceTag kobo={v.priceKobo} size="lg" negotiable={v.negotiable} />
                  <Link
                    to={`/cars/${v.state.toLowerCase()}/${v.slug}`}
                    className="block mt-1 font-bold text-base text-ink hover:text-brand-600 line-clamp-2"
                  >
                    {v.title}
                  </Link>
                  <p className="text-xs text-ink-secondary mt-1 inline-flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-brand-600" />
                    {v.lga}, {v.state}
                  </p>
                </div>

                {/* Fair Price Market Insight */}
                <div className="p-3 rounded-control bg-elevated border border-line text-xs space-y-1">
                  <div className="font-semibold text-ink flex items-center justify-between">
                    <span>Fair Price Insight</span>
                    {v.fairPrice.available ? (
                      <span
                        className={`inline-flex items-center gap-1 font-bold ${
                          v.fairPrice.verdict === 'below_market'
                            ? 'text-brand-600'
                            : v.fairPrice.verdict === 'above_market'
                              ? 'text-amber-600'
                              : 'text-sky-600'
                        }`}
                      >
                        {v.fairPrice.verdict === 'below_market' && (
                          <TrendingDown className="w-3.5 h-3.5" />
                        )}
                        {v.fairPrice.verdict === 'above_market' && (
                          <TrendingUp className="w-3.5 h-3.5" />
                        )}
                        {v.fairPrice.verdict.replace(/_/g, ' ').toUpperCase()}
                      </span>
                    ) : (
                      <span className="text-ink-muted">Unique Spec</span>
                    )}
                  </div>
                  {v.fairPrice.available && v.fairPrice.medianPriceKobo && (
                    <div className="text-ink-secondary font-mono tabular-nums">
                      Comparable Median ({v.fairPrice.comparableCount} cars):{' '}
                      <strong>{formatKobo(v.fairPrice.medianPriceKobo)}</strong>
                    </div>
                  )}
                </div>

                {/* Trust Badges */}
                <div className="space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                    Vehicle Trust & Papers
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {v.badges.vinChecked ? (
                      <Badge variant="vin_checked" />
                    ) : (
                      <Badge variant="neutral">No VIN Badge</Badge>
                    )}
                    {v.badges.customsReviewed ? (
                      <Badge variant="customs_reviewed" />
                    ) : (
                      <Badge variant="neutral">Customs Unverified</Badge>
                    )}
                    {v.badges.inspected && <Badge variant="inspected" />}
                  </div>
                </div>

                {/* Spec Comparison Rows */}
                <div className="divide-y divide-line text-xs">
                  <div className="py-2 flex justify-between">
                    <span className="text-ink-muted">Year</span>
                    <span className="font-mono font-semibold text-ink">{v.year}</span>
                  </div>
                  <div className="py-2 flex justify-between">
                    <span className="text-ink-muted">Condition</span>
                    <span className="font-semibold text-ink capitalize">
                      {v.condition.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div className="py-2 flex justify-between">
                    <span className="text-ink-muted">Mileage</span>
                    <span className="font-mono font-semibold tabular-nums text-ink">
                      {v.mileageKm.toLocaleString()} km
                    </span>
                  </div>
                  <div className="py-2 flex justify-between">
                    <span className="text-ink-muted">Transmission / Fuel</span>
                    <span className="font-semibold text-ink capitalize">
                      {v.transmission} • {v.fuelType}
                    </span>
                  </div>
                  <div className="py-2 flex justify-between">
                    <span className="text-ink-muted">Customs Duty Declared</span>
                    <span className="font-semibold text-ink uppercase">{v.customsStatus}</span>
                  </div>
                  <div className="py-2 flex justify-between">
                    <span className="text-ink-muted">Accident History</span>
                    <span className="font-semibold text-ink capitalize">
                      {v.accidentHistory.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div className="py-2 flex justify-between">
                    <span className="text-ink-muted">Swap Accepted</span>
                    <span className="font-semibold text-ink">{v.swapAccepted ? 'Yes' : 'No'}</span>
                  </div>
                  <div className="py-2 flex justify-between">
                    <span className="text-ink-muted">Seller</span>
                    <span className="font-semibold text-ink">
                      {v.seller?.displayName ?? 'Verified Seller'}
                    </span>
                  </div>
                </div>

                <Link to={`/cars/${v.state.toLowerCase()}/${v.slug}`}>
                  <Button variant="primary" fullWidth>
                    View Vehicle Details
                  </Button>
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

