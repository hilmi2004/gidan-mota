import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeftRight, BellPlus, CarFront, RotateCcw, Search, SlidersHorizontal } from 'lucide-react';
import { NIGERIA_STATES_LGAS, VEHICLE_CATALOG, nairaToKobo } from '@autodey/shared';
import {
  Button,
  Card,
  Chip,
  EmptyState,
  Input,
  Modal,
  Select,
  Skeleton,
  useToast,
} from '../../components/ui';
import {
  AuctionCard,
  ListingCard,
  type ListingSummaryItem,
} from '../../components/listings/ListingCards';
import { apiRequest } from '../../lib/api';
import { useAppStore } from '../../stores/useAppStore';

export const SearchPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { pushToast } = useToast();
  const user = useAppStore((s) => s.user);
  const setServerClockOffset = useAppStore((s) => s.setServerClockOffset);

  const [q, setQ] = useState(searchParams.get('q') || '');
  const [make, setMake] = useState(searchParams.get('make') || 'All');
  const [model, setModel] = useState(searchParams.get('model') || 'All');
  const [stateName, setStateName] = useState(searchParams.get('state') || 'All');
  const [condition, setCondition] = useState(searchParams.get('condition') || 'all');
  const [bodyType, setBodyType] = useState(searchParams.get('bodyType') || 'all');
  const [transmission, setTransmission] = useState(searchParams.get('transmission') || 'all');
  const [maxPriceNaira, setMaxPriceNaira] = useState(searchParams.get('maxPrice') || '');
  const [vinChecked, setVinChecked] = useState(searchParams.get('vinChecked') === 'true');
  const [customsReviewed, setCustomsReviewed] = useState(
    searchParams.get('customsReviewed') === 'true',
  );
  const [verifiedSeller, setVerifiedSeller] = useState(
    searchParams.get('verifiedSeller') === 'true',
  );
  const [auctionOnly, setAuctionOnly] = useState(searchParams.get('auctionOnly') === 'true');
  const [sort, setSort] = useState(searchParams.get('sort') || 'newest');

  const [items, setItems] = useState<ListingSummaryItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  const selectedCatalog = VEHICLE_CATALOG.find((v) => v.make === make);
  const availableModels = selectedCatalog ? selectedCatalog.models : [];

  const syncUrlAndFetch = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    if (make !== 'All') params.set('make', make);
    if (model !== 'All') params.set('model', model);
    if (stateName !== 'All') params.set('state', stateName);
    if (condition !== 'all') params.set('condition', condition);
    if (bodyType !== 'all') params.set('bodyType', bodyType);
    if (transmission !== 'all') params.set('transmission', transmission);
    if (maxPriceNaira && Number(maxPriceNaira) > 0) {
      params.set('maxPrice', maxPriceNaira);
    }
    if (vinChecked) params.set('vinChecked', 'true');
    if (customsReviewed) params.set('customsReviewed', 'true');
    if (verifiedSeller) params.set('verifiedSeller', 'true');
    if (auctionOnly) params.set('auctionOnly', 'true');
    if (sort !== 'newest') params.set('sort', sort);

    setSearchParams(params, { replace: true });

    const apiParams = new URLSearchParams(params);
    if (maxPriceNaira && Number(maxPriceNaira) > 0) {
      apiParams.delete('maxPrice');
      apiParams.set('priceMaxKobo', String(nairaToKobo(Number(maxPriceNaira))));
    }
    apiParams.set('limit', '40');

    try {
      const res = await apiRequest<{
        items: ListingSummaryItem[];
        totalCount: number;
        serverTimeMs: number;
      }>(`/search?${apiParams.toString()}`);
      setItems(res.items);
      setTotalCount(res.totalCount);
      if (res.serverTimeMs) {
        setServerClockOffset(res.serverTimeMs);
      }
    } catch {
      setItems([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void syncUrlAndFetch();
  }, [
    make,
    model,
    stateName,
    condition,
    bodyType,
    transmission,
    maxPriceNaira,
    vinChecked,
    customsReviewed,
    verifiedSeller,
    auctionOnly,
    sort,
  ]);

  const handleResetFilters = () => {
    setQ('');
    setMake('All');
    setModel('All');
    setStateName('All');
    setCondition('all');
    setBodyType('all');
    setTransmission('all');
    setMaxPriceNaira('');
    setVinChecked(false);
    setCustomsReviewed(false);
    setVerifiedSeller(false);
    setAuctionOnly(false);
    setSort('newest');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Top Sticky Search & Filter Bar */}
      <Card padding="md" className="space-y-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void syncUrlAndFetch();
          }}
          className="flex flex-col md:flex-row items-stretch md:items-end gap-3"
        >
          <div className="flex-1">
            <Input
              label="Search Make, Model, Nickname or Location"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder='Try "Benz C300", "Camry Muscle", "Tokunbo Hilux", or "Lekki"...'
              leftAddon={<Search className="w-4 h-4" />}
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:flex items-end gap-2.5">
            <div className="w-full md:w-44">
              <Select
                label="Make"
                value={make}
                onChange={(e) => {
                  setMake(e.target.value);
                  setModel('All');
                }}
                options={[
                  { value: 'All', label: 'All Makes' },
                  ...VEHICLE_CATALOG.map((v) => ({ value: v.make, label: v.make })),
                ]}
              />
            </div>

            <div className="w-full md:w-44">
              <Select
                label="State"
                value={stateName}
                onChange={(e) => setStateName(e.target.value)}
                options={[
                  { value: 'All', label: 'All Nigeria' },
                  ...Object.keys(NIGERIA_STATES_LGAS).map((s) => ({ value: s, label: s })),
                ]}
              />
            </div>

            <div className="w-full md:w-44">
              <Select
                label="Sort By"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                options={[
                  { value: 'newest', label: 'Newest First' },
                  { value: 'price_asc', label: 'Price: Low to High' },
                  { value: 'price_desc', label: 'Price: High to Low' },
                  { value: 'mileage_asc', label: 'Lowest Mileage' },
                  { value: 'year_desc', label: 'Newest Year' },
                  { value: 'ending_soonest', label: 'Auctions Ending Soon' },
                ]}
              />
            </div>

            <Button type="submit" variant="primary">
              Search
            </Button>

            <Button
              type="button"
              variant="outline"
              leftIcon={<SlidersHorizontal className="w-4 h-4" />}
              onClick={() => setMobileFilterOpen(true)}
            >
              More Filters
            </Button>
          </div>
        </form>

        {/* Quick Trust & Condition Chips */}
        <div className="pt-3 border-t border-line flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Chip
              label="Live Auctions Only"
              active={auctionOnly}
              onClick={() => setAuctionOnly(!auctionOnly)}
            />
            <Chip
              label="Foreign Used (Tokunbo)"
              active={condition === 'foreign_used'}
              onClick={() => setCondition(condition === 'foreign_used' ? 'all' : 'foreign_used')}
            />
            <Chip
              label="Nigerian Used"
              active={condition === 'nigerian_used'}
              onClick={() => setCondition(condition === 'nigerian_used' ? 'all' : 'nigerian_used')}
            />
            <Chip
              label="VIN Checked"
              active={vinChecked}
              onClick={() => setVinChecked(!vinChecked)}
            />
            <Chip
              label="Customs Papers Reviewed"
              active={customsReviewed}
              onClick={() => setCustomsReviewed(!customsReviewed)}
            />
            <Chip
              label="Verified Seller / Dealer"
              active={verifiedSeller}
              onClick={() => setVerifiedSeller(!verifiedSeller)}
            />
          </div>

          <button
            type="button"
            onClick={handleResetFilters}
            className="text-xs font-medium text-ink-secondary hover:text-ink inline-flex items-center gap-1"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset all</span>
          </button>
        </div>
      </Card>

      {/* Results Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium text-ink-secondary">
          Showing <strong className="text-ink tabular-nums">{totalCount}</strong> verified vehicles
        </p>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            leftIcon={<BellPlus className="w-4 h-4" />}
            onClick={async () => {
              if (!user) {
                navigate('/auth');
                return;
              }
              try {
                const alertName = [
                  make !== 'All' ? make : 'All Makes',
                  model !== 'All' ? model : '',
                  stateName !== 'All' ? `in ${stateName}` : 'Nigeria',
                ]
                  .filter(Boolean)
                  .join(' ');
                await apiRequest('/saved-searches', {
                  method: 'POST',
                  body: JSON.stringify({
                    name: alertName,
                    filters: {
                      ...(q.trim() ? { q: q.trim() } : {}),
                      ...(make !== 'All' ? { make } : {}),
                      ...(model !== 'All' ? { model } : {}),
                      ...(stateName !== 'All' ? { state: stateName } : {}),
                      ...(condition !== 'all' ? { condition } : {}),
                      ...(maxPriceNaira && Number(maxPriceNaira) > 0
                        ? { maxPriceKobo: nairaToKobo(Number(maxPriceNaira)) }
                        : {}),
                      ...(auctionOnly ? { auctionOnly: true } : {}),
                    },
                  }),
                });
                pushToast({
                  type: 'success',
                  title: 'Saved Search Alert Created',
                  message: `We will alert you when new "${alertName}" vehicles go live.`,
                });
              } catch (err) {
                pushToast({
                  type: 'error',
                  title: 'Could Not Save Search',
                  message: err instanceof Error ? err.message : 'Try again.',
                });
              }
            }}
          >
            Save Search Alert
          </Button>

          <Link
            to={
              items.length >= 3
                ? `/compare?ids=${items
                    .slice(0, 3)
                    .map((i) => i.id)
                    .join(',')}`
                : '/compare'
            }
          >
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<ArrowLeftRight className="w-4 h-4" />}
            >
              Compare Top 3 Cars
            </Button>
          </Link>
        </div>
      </div>

      {/* Results Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {Array.from({ length: 8 }).map((_, idx) => (
            <Card key={idx} padding="none" className="overflow-hidden space-y-3 pb-4">
              <Skeleton className="aspect-[4/3] w-full rounded-none" />
              <div className="px-4 space-y-2">
                <Skeleton className="h-6 w-1/2" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            </Card>
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<CarFront className="w-6 h-6" />}
          title="No matching vehicles found"
          description="Try broadening your price ceiling, switching state to All Nigeria, or clearing a filter chip."
          actionLabel="Reset All Filters"
          onAction={handleResetFilters}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {items.map((item) =>
            item.isAuction && item.auction ? (
              <AuctionCard key={item.id} item={item} />
            ) : (
              <ListingCard key={item.id} item={item} />
            ),
          )}
        </div>
      )}

      {/* Mobile / Advanced Filter Bottom Sheet */}
      <Modal
        open={mobileFilterOpen}
        onClose={() => setMobileFilterOpen(false)}
        title="Advanced Vehicle Filters"
        description="Filter by model, body style, budget ceiling, and transmission."
        footer={
          <div className="flex items-center justify-between gap-3">
            <Button variant="ghost" onClick={handleResetFilters}>
              Clear All
            </Button>
            <Button variant="primary" onClick={() => setMobileFilterOpen(false)}>
              Show {totalCount} Vehicles
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {availableModels.length > 0 && (
            <Select
              label="Model"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              options={[
                { value: 'All', label: `All ${make} Models` },
                ...availableModels.map((m) => ({ value: m, label: m })),
              ]}
            />
          )}

          <Select
            label="Body Type"
            value={bodyType}
            onChange={(e) => setBodyType(e.target.value)}
            options={[
              { value: 'all', label: 'All Body Types' },
              { value: 'sedan', label: 'Sedan / Saloon' },
              { value: 'suv', label: 'SUV / 4x4' },
              { value: 'pickup', label: 'Pickup / Hilux' },
              { value: 'bus', label: 'Bus / Hiace' },
              { value: 'minivan', label: 'Minivan / Sienna' },
              { value: 'hatchback', label: 'Hatchback' },
              { value: 'motorcycle', label: 'Motorcycle / Dispatch' },
            ]}
          />

          <Select
            label="Transmission"
            value={transmission}
            onChange={(e) => setTransmission(e.target.value)}
            options={[
              { value: 'all', label: 'Any Transmission' },
              { value: 'automatic', label: 'Automatic' },
              { value: 'manual', label: 'Manual' },
              { value: 'cvt', label: 'CVT' },
            ]}
          />

          <Select
            label="Maximum Price Ceiling (NGN)"
            value={maxPriceNaira}
            onChange={(e) => setMaxPriceNaira(e.target.value)}
            options={[
              { value: '', label: 'No Price Limit' },
              { value: '3000000', label: 'Up to ₦3,000,000' },
              { value: '8000000', label: 'Up to ₦8,000,000' },
              { value: '15000000', label: 'Up to ₦15,000,000' },
              { value: '25000000', label: 'Up to ₦25,000,000' },
              { value: '40000000', label: 'Up to ₦40,000,000' },
            ]}
          />
        </div>
      </Modal>
    </div>
  );
};

