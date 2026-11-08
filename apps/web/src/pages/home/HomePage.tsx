import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Car,
  CheckCircle2,
  FileCheck2,
  PlusCircle,
  Search,
  ShieldCheck,
  Truck,
} from 'lucide-react';
import { BRAND_CONFIG, NIGERIA_STATES_LGAS, VEHICLE_CATALOG } from '@autodey/shared';
import { Badge, Button, Card, Chip, Select, Skeleton } from '../../components/ui';
import {
  AuctionCard,
  ListingCard,
  type ListingSummaryItem,
} from '../../components/listings/ListingCards';
import { apiRequest } from '../../lib/api';
import { useAppStore } from '../../stores/useAppStore';

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const setServerClockOffset = useAppStore((s) => s.setServerClockOffset);

  const [selectedMake, setSelectedMake] = useState('All');
  const [selectedState, setSelectedState] = useState('All');
  const [maxBudgetNaira, setMaxBudgetNaira] = useState('All');

  const [auctions, setAuctions] = useState<ListingSummaryItem[]>([]);
  const [featuredListings, setFeaturedListings] = useState<ListingSummaryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      apiRequest<{ items: ListingSummaryItem[]; serverTimeMs: number }>(
        '/search?auctionOnly=true&sort=ending_soonest&limit=6',
      ),
      apiRequest<{ items: ListingSummaryItem[] }>('/search?limit=8'),
    ])
      .then(([aucRes, listRes]) => {
        setAuctions(aucRes.items);
        setFeaturedListings(listRes.items.filter((i) => !i.isAuction).slice(0, 8));
        if (aucRes.serverTimeMs) {
          setServerClockOffset(aucRes.serverTimeMs);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleHeroSearch = () => {
    const params = new URLSearchParams();
    if (selectedMake !== 'All') params.set('make', selectedMake);
    if (selectedState !== 'All') params.set('state', selectedState);
    if (maxBudgetNaira !== 'All') params.set('maxPrice', maxBudgetNaira);
    navigate(`/search?${params.toString()}`);
  };

  return (
    <div className="space-y-14">
      {/* HERO SECTION WITH PRODUCT SEARCH MODULE */}
      <section className="bg-surface border-b border-line py-10 md:py-14">
        <div className="max-w-7xl mx-auto px-4 space-y-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="max-w-3xl space-y-4">
              <div className="inline-flex items-center gap-2">
                <Badge variant="vin_checked">17-Digit VIN Checked</Badge>
                <Badge variant="customs_reviewed">Customs Duty Verified</Badge>
              </div>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-ink tracking-tight leading-[1.12]">
                Buy verified cars in Nigeria. Or bid live with zero ghosting.
              </h1>
              <p className="text-base text-ink-secondary max-w-2xl leading-relaxed">
                Direct seller chat and WhatsApp for everyday classifieds, plus timed proxy-bid
                auctions backed by refundable bidding deposits.
              </p>
            </div>

            <Link to="/sell" className="shrink-0">
              <Button
                variant="outline"
                size="lg"
                leftIcon={<PlusCircle className="w-4 h-4 text-brand-600" />}
              >
                Post Your Car (4 Steps)
              </Button>
            </Link>
          </div>

          {/* Search Module Card */}
          <Card padding="md" className="shadow-cardHover border-brand-500/30">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 items-end">
              <Select
                label="Make"
                value={selectedMake}
                onChange={(e) => setSelectedMake(e.target.value)}
                options={[
                  { value: 'All', label: 'All Makes (Toyota, Lexus, Benz...)' },
                  ...VEHICLE_CATALOG.map((v) => ({ value: v.make, label: v.make })),
                ]}
              />

              <Select
                label="Budget Ceiling (NGN)"
                value={maxBudgetNaira}
                onChange={(e) => setMaxBudgetNaira(e.target.value)}
                options={[
                  { value: 'All', label: 'Any Budget' },
                  { value: '5000000', label: 'Under ₦5,000,000' },
                  { value: '10000000', label: 'Under ₦10,000,000' },
                  { value: '20000000', label: 'Under ₦20,000,000' },
                  { value: '35000000', label: 'Under ₦35,000,000' },
                ]}
              />

              <Select
                label="State / Location"
                value={selectedState}
                onChange={(e) => setSelectedState(e.target.value)}
                options={[
                  { value: 'All', label: 'All Nigeria (Lagos, Abuja, PH...)' },
                  ...Object.keys(NIGERIA_STATES_LGAS).map((s) => ({ value: s, label: s })),
                ]}
              />

              <Button
                variant="primary"
                size="md"
                fullWidth
                leftIcon={<Search className="w-4 h-4" />}
                onClick={handleHeroSearch}
              >
                Search 40+ Verified Cars
              </Button>
            </div>

            <div className="mt-4 pt-3.5 border-t border-line flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-ink-muted mr-1">Popular Searches:</span>
              {[
                { label: 'Foreign Used (Tokunbo)', url: '/search?condition=foreign_used' },
                { label: 'Nigerian Used', url: '/search?condition=nigerian_used' },
                { label: 'Mercedes-Benz ("Benz")', url: '/search?q=benz' },
                { label: 'Toyota Camry', url: '/search?make=Toyota&model=Camry' },
                { label: 'VIN Checked Only', url: '/search?vinChecked=true' },
                { label: 'Lagos Lots', url: '/search?state=Lagos' },
              ].map((item) => (
                <Chip
                  key={item.label}
                  label={item.label}
                  onClick={() => navigate(item.url)}
                />
              ))}
            </div>
          </Card>
        </div>
      </section>

      {/* LIVE AUCTIONS ENDING SOON */}
      <section className="max-w-7xl mx-auto px-4 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-2">
              <Badge variant="live" />
              <span className="text-xs font-medium text-ink-secondary">
                Soft-Close Anti-Sniping (+3m in final 3 mins)
              </span>
            </div>
            <h2 className="text-2xl font-bold text-ink mt-1.5">Live & Recent Timed Auctions</h2>
          </div>
          <Link
            to="/search?auctionOnly=true"
            className="text-sm font-semibold text-brand-600 hover:text-brand-700 inline-flex items-center gap-1"
          >
            <span>View All 6 Auctions</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {Array.from({ length: 3 }).map((_, idx) => (
              <Skeleton key={idx} className="aspect-[4/3] w-full rounded-card" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {auctions.slice(0, 3).map((auc) => (
              <AuctionCard key={auc.id} item={auc} />
            ))}
          </div>
        )}
      </section>

      {/* BROWSE BY BODY TYPE */}
      <section className="max-w-7xl mx-auto px-4 space-y-4">
        <h2 className="text-xl font-bold text-ink">Browse by Category & Body Style</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          {[
            { name: 'Sedans & Saloons', query: 'bodyType=sedan', icon: Car },
            { name: 'SUVs & Crossovers', query: 'bodyType=suv', icon: Car },
            { name: 'Pickups & Hilux', query: 'bodyType=pickup', icon: Truck },
            { name: 'Buses & Hiace Vans', query: 'bodyType=bus', icon: Truck },
            { name: 'Foreign Used (Tokunbo)', query: 'condition=foreign_used', icon: ShieldCheck },
            { name: 'Dispatch Motorcycles', query: 'category=motorcycles', icon: Car },
          ].map((cat) => {
            const Icon = cat.icon;
            return (
              <Card
                key={cat.name}
                interactive
                padding="sm"
                onClick={() => navigate(`/search?${cat.query}`)}
                className="flex flex-col gap-2"
              >
                <div className="w-9 h-9 rounded-control bg-elevated text-brand-600 flex items-center justify-center">
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-ink">{cat.name}</p>
                  <p className="text-[11px] text-ink-muted">Explore inventory →</p>
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      {/* FEATURED CLASSIFIED LISTINGS */}
      <section className="max-w-7xl mx-auto px-4 space-y-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-ink">Verified Classifieds (Direct Contact)</h2>
            <p className="text-xs text-ink-secondary mt-0.5">
              Chat directly in-app, reveal seller phone number, or message on WhatsApp. Zero
              middleman fees on classifieds.
            </p>
          </div>
          <Link
            to="/search"
            className="text-sm font-semibold text-brand-600 hover:text-brand-700 inline-flex items-center gap-1 shrink-0"
          >
            <span>Browse All 40 Cars</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {Array.from({ length: 8 }).map((_, idx) => (
              <Skeleton key={idx} className="aspect-[4/3] w-full rounded-card" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {featuredListings.map((car) => (
              <ListingCard key={car.id} item={car} />
            ))}
          </div>
        )}
      </section>

      {/* TRUST & HOW AUCTIONS WORK SECTION */}
      <section className="max-w-7xl mx-auto px-4">
        <Card padding="lg" className="bg-surface border-line space-y-6">
          <div className="max-w-2xl">
            <Badge variant="id_verified">Built for Nigerian Market Realities</Badge>
            <h2 className="text-2xl font-bold text-ink mt-2">
              How {BRAND_CONFIG.name} stops fake papers, cloned VINs, and time-wasters
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <div className="w-10 h-10 rounded-control bg-brand-600/10 text-brand-600 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="text-base font-semibold text-ink">
                1. 17-Char VIN & Duplicate Blocker
              </h3>
              <p className="text-xs text-ink-secondary leading-relaxed">
                Every VIN is check-digit validated and decoded against NHTSA vPIC to catch year/trim
                tampering. Duplicate active VINs are blocked automatically.
              </p>
            </div>

            <div className="space-y-2">
              <div className="w-10 h-10 rounded-control bg-brand-600/10 text-brand-600 flex items-center justify-center">
                <FileCheck2 className="w-5 h-5" />
              </div>
              <h3 className="text-base font-semibold text-ink">
                2. Customs Duty Document Review
              </h3>
              <p className="text-xs text-ink-secondary leading-relaxed">
                Sellers upload customs duty papers for moderator review so buyers know before they
                travel whether a Tokunbo vehicle has verified papers on file.
              </p>
            </div>

            <div className="space-y-2">
              <div className="w-10 h-10 rounded-control bg-brand-600/10 text-brand-600 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <h3 className="text-base font-semibold text-ink">
                3. Refundable Bidding Deposit
              </h3>
              <p className="text-xs text-ink-secondary leading-relaxed">
                Auction bidders lock a refundable deposit in their wallet ledger (50x bidding
                power). Serious bidders win fair deals; sellers never get ghosted.
              </p>
            </div>
          </div>
        </Card>
      </section>
    </div>
  );
};
