import React, { useState } from 'react';
import { CarFront, Gavel, MapPin, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import { BRAND_CONFIG, nairaToKobo } from '@autodey/shared';
import {
  Avatar,
  Badge,
  BrandLogo,
  Button,
  Card,
  Chip,
  Countdown,
  EmptyState,
  Input,
  Modal,
  PriceTag,
  Select,
  Skeleton,
  Tabs,
  useToast,
} from '../../components/ui';

export const DesignSystemPage: React.FC = () => {
  const { pushToast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('buttons');
  const [selectedChips, setSelectedChips] = useState<string[]>(['tokunbo', 'vin']);

  const now = Date.now();
  const calmEnd = new Date(now + 4 * 3600 * 1000 + 18 * 60 * 1000).toISOString();
  const urgentEnd = new Date(now + 38 * 60 * 1000).toISOString();
  const criticalEnd = new Date(now + 2 * 60 * 1000 + 42 * 1000).toISOString();

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-12">
      {/* Header */}
      <div className="border-b border-line pb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-3">
          <BrandLogo size="lg" showText showTagline />
          <div>
            <Badge variant="id_verified">{BRAND_CONFIG.name} Design System v1.0</Badge>
            <h1 className="text-3xl md:text-4xl font-bold text-ink mt-3">
              Poppins + Tabular Numerals UI Kit
            </h1>
            <p className="text-sm text-ink-secondary mt-1 max-w-2xl">
              Every screen in {BRAND_CONFIG.name} is composed strictly from these tokens and primitives.
              Zero emojis, 4px grid rhythm, warm alabaster &amp; carbon ink surfaces, and a single
              Nigerian Emerald accent.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              pushToast({
                type: 'success',
                title: 'Bid Placed — ₦14,850,000',
                message: 'You are currently the highest bidder on the 2019 Lexus RX 350.',
              })
            }
          >
            Test Success Toast
          </Button>
          <Button
            variant="amber"
            size="sm"
            onClick={() =>
              pushToast({
                type: 'warning',
                title: 'Soft-Close Triggered (+3m)',
                message: 'A bid in the final 3 minutes extended the auction timer.',
              })
            }
          >
            Test Soft-Close Toast
          </Button>
        </div>
      </div>

      {/* 1. Color Palette */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-ink">1. Color Tokens & Surfaces</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3">
          {[
            { name: 'Canvas', cls: 'bg-canvas border border-line', hex: '#F8F8F6 / #0B0D10' },
            { name: 'Surface', cls: 'bg-surface border border-line', hex: '#FFFFFF / #12161C' },
            { name: 'Elevated', cls: 'bg-elevated border border-line', hex: '#F1F3F0 / #1A2029' },
            { name: 'Emerald 600', cls: 'bg-brand-600 text-white', hex: '#059669 (Primary)' },
            { name: 'Emerald 500', cls: 'bg-brand-500 text-white', hex: '#10B981 (Dark CTA)' },
            { name: 'Signal Amber', cls: 'bg-signal-amber text-white', hex: '#D97706 (Urgency)' },
            { name: 'Signal Danger', cls: 'bg-signal-danger text-white', hex: '#DC2626 (Critical)' },
          ].map((swatch) => (
            <div key={swatch.name} className="rounded-card border border-line bg-surface p-3 space-y-2">
              <div className={`h-12 rounded-control ${swatch.cls}`} />
              <p className="text-xs font-semibold text-ink">{swatch.name}</p>
              <p className="text-[11px] font-mono text-ink-muted">{swatch.hex}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 2. Typography Scale */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-ink">2. Poppins Type Scale & Tabular Figures</h2>
        <Card className="space-y-4 divide-y divide-line">
          <div className="pt-2">
            <span className="text-xs font-mono text-ink-muted">Display / 40px Bold</span>
            <p className="text-3xl md:text-[40px] font-bold leading-tight text-ink">
              2020 Toyota Land Cruiser Prado VX
            </p>
          </div>
          <div className="pt-4">
            <span className="text-xs font-mono text-ink-muted">Heading LG / 24px SemiBold</span>
            <p className="text-2xl font-semibold text-ink">
              Verified Tokunbo Imports in Lekki & Abuja
            </p>
          </div>
          <div className="pt-4">
            <span className="text-xs font-mono text-ink-muted">
              Tabular Numerals (`PriceTag` & `Countdown`)
            </span>
            <div className="flex flex-wrap items-center gap-6 mt-2">
              <PriceTag kobo={nairaToKobo(28_500_000)} size="xl" negotiable />
              <PriceTag kobo={nairaToKobo(9_750_000)} size="lg" compact />
              <Countdown endsAt={calmEnd} size="lg" />
              <Countdown endsAt={urgentEnd} size="lg" />
              <Countdown endsAt={criticalEnd} size="lg" />
            </div>
          </div>
        </Card>
      </section>

      {/* 3. Buttons, Chips, Tabs & Badges */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-ink">3. Interactive Controls & Trust Badges</h2>
        <Card className="space-y-6">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
              Buttons (All 44px+ touch targets)
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="primary" leftIcon={<Gavel className="w-4 h-4" />}>
                Place Proxy Bid
              </Button>
              <Button variant="secondary">Chat Seller</Button>
              <Button variant="outline">Reveal Phone</Button>
              <Button variant="amber">Extend Soft-Close</Button>
              <Button variant="danger">Forfeit Deposit</Button>
              <Button variant="ghost">Cancel</Button>
              <Button variant="primary" loading>
                Locking Bid...
              </Button>
              <Button variant="primary" disabled>
                Auction Closed
              </Button>
            </div>
          </div>

          <div className="space-y-2 pt-4 border-t border-line">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
              Trust, Document & Auction Badges
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="phone_verified" />
              <Badge variant="id_verified" />
              <Badge variant="dealer_verified" />
              <Badge variant="vin_checked" />
              <Badge variant="customs_reviewed" />
              <Badge variant="inspected" />
              <Badge variant="no_reserve" />
              <Badge variant="reserve_met" />
              <Badge variant="reserve_not_met" />
              <Badge variant="live" />
              <Badge variant="urgent" />
            </div>
          </div>

          <div className="space-y-2 pt-4 border-t border-line">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
              Filter Chips & Tabs
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {[
                { id: 'tokunbo', label: 'Foreign Used (Tokunbo)', count: 28 },
                { id: 'vin', label: 'VIN Checked', count: 19 },
                { id: 'customs', label: 'Customs Papers Verified', count: 14 },
                { id: 'lagos', label: 'Lagos State', count: 22 },
              ].map((chip) => {
                const active = selectedChips.includes(chip.id);
                return (
                  <Chip
                    key={chip.id}
                    label={chip.label}
                    count={chip.count}
                    active={active}
                    onClick={() =>
                      setSelectedChips((prev) =>
                        active ? prev.filter((c) => c !== chip.id) : [...prev, chip.id],
                      )
                    }
                    onRemove={
                      active
                        ? () => setSelectedChips((prev) => prev.filter((c) => c !== chip.id))
                        : undefined
                    }
                  />
                );
              })}
            </div>

            <div className="pt-3">
              <Tabs
                tabs={[
                  { id: 'buttons', label: 'All Listings', badge: 40 },
                  { id: 'auctions', label: 'Live Auctions', badge: 6 },
                  { id: 'dealers', label: 'Verified Dealers', badge: 2 },
                ]}
                activeTab={activeTab}
                onChange={setActiveTab}
              />
            </div>
          </div>
        </Card>
      </section>

      {/* 4. Inputs & Selects */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-ink">4. Form Controls & Validation States</h2>
        <Card className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <Input
            label="Maximum Proxy Bid (NGN)"
            placeholder="15,500,000"
            leftAddon="₦"
            tabular
            helperText="System bids the minimum increment needed up to your max."
          />
          <Select
            label="Vehicle Location (State)"
            options={[
              { value: 'Lagos', label: 'Lagos (Lekki / Ikeja / Berger)' },
              { value: 'Abuja', label: 'Abuja FCT (Maitama / Wuse / Gwarinpa)' },
              { value: 'Rivers', label: 'Rivers (Port Harcourt)' },
            ]}
            helperText="Select where the car can be physically inspected."
          />
          <Input
            label="17-Character VIN"
            defaultValue="1HGCM82633A00435I"
            error="VIN cannot contain the letters I, O, or Q."
          />
        </Card>
      </section>

      {/* 5. Classifieds Card vs Live Auction Card Comparison */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-ink">
          5. Card Hierarchy: Classifieds vs. Live Timed Auction
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Classifieds Card */}
          <Card padding="none" interactive className="overflow-hidden flex flex-col">
            <div className="relative aspect-[4/3] bg-elevated overflow-hidden">
              <img
                src="https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?w=800&auto=format&fit=crop&q=80"
                alt="2018 Toyota Camry XSE"
                className="w-full h-full object-cover"
              />
              <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
                <Badge variant="vin_checked" />
                <Badge variant="customs_reviewed" />
              </div>
            </div>
            <div className="p-4 space-y-2.5 flex-1 flex flex-col justify-between">
              <div>
                <PriceTag kobo={nairaToKobo(18_500_000)} size="lg" negotiable />
                <h3 className="text-base font-semibold text-ink mt-1">
                  2018 Toyota Camry XSE V6 — Foreign Used (Tokunbo)
                </h3>
                <p className="text-xs text-ink-secondary mt-1 flex items-center gap-2">
                  <span className="tabular-nums">64,200 km</span>
                  <span>•</span>
                  <span>Automatic</span>
                  <span>•</span>
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> Lekki, Lagos
                  </span>
                </p>
              </div>
              <div className="pt-3 border-t border-line flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Avatar name="Berger Auto Motors" size="sm" verified />
                  <span className="text-xs font-medium text-ink">Berger Auto Motors</span>
                </div>
                <Badge variant="dealer_verified" />
              </div>
            </div>
          </Card>

          {/* Live Auction Card */}
          <Card
            padding="none"
            interactive
            className="overflow-hidden flex flex-col ring-1 ring-brand-500/40"
          >
            <div className="relative aspect-[4/3] bg-elevated overflow-hidden">
              <img
                src="https://images.unsplash.com/photo-1555215695-3004980ad54e?w=800&auto=format&fit=crop&q=80"
                alt="2019 Mercedes-Benz C300"
                className="w-full h-full object-cover"
              />
              <div className="absolute top-3 left-3 flex items-center gap-2">
                <Badge variant="live" />
                <Badge variant="reserve_met" />
              </div>
              <div className="absolute bottom-3 left-3">
                <Countdown endsAt={criticalEnd} size="md" />
              </div>
            </div>
            <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
              <div>
                <div className="flex items-baseline justify-between gap-2">
                  <div>
                    <span className="text-[11px] uppercase tracking-wider font-semibold text-ink-muted block">
                      Current Bid (19 Bids)
                    </span>
                    <PriceTag kobo={nairaToKobo(21_400_000)} size="lg" />
                  </div>
                  <span className="text-xs font-mono tabular-nums text-ink-secondary">
                    High: Ch***a
                  </span>
                </div>
                <h3 className="text-base font-semibold text-ink mt-1.5">
                  2019 Mercedes-Benz C300 AMG Line — Tokunbo
                </h3>
                <p className="text-xs text-ink-secondary mt-1">
                  49,100 km • Automatic • Maitama, Abuja
                </p>
              </div>
              <div className="pt-3 border-t border-line flex items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 text-xs text-ink-secondary">
                  <ShieldCheck className="w-4 h-4 text-brand-600" />
                  <span>Refundable Deposit Required</span>
                </div>
                <Button variant="primary" size="sm" onClick={() => setModalOpen(true)}>
                  Bid Now
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* 6. Skeleton & Empty State */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="space-y-4">
          <h3 className="text-sm font-semibold text-ink">Skeleton Loading State (Zero CLS)</h3>
          <Skeleton className="aspect-[4/3] w-full rounded-card" />
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-4 w-3/4" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-24 rounded-full" />
            <Skeleton className="h-8 w-28 rounded-full" />
          </div>
        </Card>

        <EmptyState
          icon={<CarFront className="w-6 h-6" />}
          title="No matching cars in this price range"
          description="Try widening your budget or clearing the mileage filter to see more Tokunbo and Nigerian-used options."
          actionLabel="Reset Filters"
          onAction={() =>
            pushToast({
              type: 'info',
              title: 'Filters Reset',
              message: 'Showing all verified listings across Nigeria.',
            })
          }
        />
      </section>

      {/* Modal / Mobile Sheet Demo */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Confirm Binding Proxy Bid"
        description="This is a binding bid. If you win, you are expected to complete the purchase within 72 hours."
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setModalOpen(false);
                pushToast({
                  type: 'success',
                  title: 'Proxy Bid Confirmed',
                  message: 'Your maximum bid of ₦22,000,000 has been encrypted and locked.',
                });
              }}
            >
              Confirm Bid — ₦22,000,000
            </Button>
          </div>
        }
      >
        <div className="space-y-4 text-sm text-ink-secondary">
          <div className="p-3.5 rounded-control bg-elevated border border-line flex items-center justify-between">
            <span>Current Price</span>
            <PriceTag kobo={nairaToKobo(21_400_000)} size="md" />
          </div>
          <div className="p-3.5 rounded-control bg-elevated border border-line flex items-center justify-between">
            <span>Next Minimum Increment</span>
            <span className="font-mono tabular-nums font-semibold text-ink">+₦100,000</span>
          </div>
          <p className="text-xs leading-relaxed">
            Your refundable bidding deposit covers this bid. Your maximum proxy bid is never shared
            with the seller or other bidders.
          </p>
        </div>
      </Modal>
    </div>
  );
};

