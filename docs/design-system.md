# AutoDey Design System (`/docs/design-system.md`)

> Living interactive showcase available in the web app at **`/_design`**.

---

## 1. Brand Direction & Visual Philosophy

AutoDey combines the high-trust precision of **Bring a Trailer / Cars & Bids** and **Stripe** with mobile-first ergonomics tailored for Nigerian car buyers and dealers (Berger, Lekki, Maitama, Port Harcourt).

- **No AI Clichés**: Zero purple/indigo gradients, zero glassmorphism blobs, zero emojis used as UI icons.
- **Single Confident Accent**: Deep Nigerian Emerald (`#059669` in light mode, `#10B981` in dark mode) paired with warm alabaster surfaces (`#F8F8F6`) and carbon ink neutrals (`#0B0D10`).
- **Urgency Signal**: Signal Amber (`#D97706` / `#F59E0B`) reserved exclusively for auction urgency (last 60m countdown, soft-close extension, outbid banner).

---

## 2. Typography (`Poppins` + Tabular Numerals)

- **Font Family**:
  - `--font-sans`: `'Poppins', -apple-system, BlinkMacSystemFont, sans-serif`
  - `--font-mono`: `'JetBrains Mono', 'Poppins', monospace` (with `font-variant-numeric: tabular-nums`)
- **Type Scale (Strict)**:
  - `display-xl`: `56px` / `1.08` line-height / `-0.03em` tracking (`font-bold`)
  - `display-lg`: `40px` / `1.12` line-height / `-0.025em` tracking (`font-bold`)
  - `heading-xl`: `32px` / `1.2` line-height / `-0.02em` tracking (`font-semibold`)
  - `heading-lg`: `24px` / `1.25` line-height / `-0.015em` tracking (`font-semibold`)
  - `heading-md`: `20px` / `1.3` line-height / `-0.01em` tracking (`font-semibold`)
  - `heading-sm`: `18px` / `1.35` line-height (`font-semibold`)
  - `body-base`: `16px` / `1.6` line-height (`font-normal`)
  - `body-sm`: `14px` / `1.5` line-height (`font-normal`)
  - `caption`: `12px` / `1.4` line-height (`font-medium`)

---

## 3. Color Tokens (10-Step Neutral Scale + Semantic Tokens)

| Token | Light Mode | Dark Mode | Usage |
| :--- | :--- | :--- | :--- |
| `--bg-canvas` | `#F8F8F6` | `#0B0D10` | Page background |
| `--bg-surface` | `#FFFFFF` | `#12161C` | Cards, panels, modals |
| `--bg-elevated` | `#F1F3F0` | `#1A2029` | Secondary controls, subtle chips, table headers |
| `--text-primary` | `#0F1419` | `#F3F5F7` | Headings, primary copy, prices |
| `--text-secondary` | `#4B5563` | `#9CA3AF` | Vehicle meta row, secondary labels |
| `--text-muted` | `#6B7280` | `#6B7280` | Timestamps, placeholders, disabled states |
| `--border-subtle` | `#E5E7EB` | `#232A35` | 1px card & divider borders |
| `--accent-primary` | `#059669` | `#10B981` | Primary CTA, live auction indicator, verified badge |
| `--accent-hover` | `#047857` | `#059669` | Primary CTA hover state |
| `--status-warning` | `#D97706` | `#F59E0B` | Final hour countdown, reserve not met, outbid |
| `--status-danger` | `#DC2626` | `#EF4444` | Final 5m pulse, destructive actions, errors |
| `--status-info` | `#0284C7` | `#38BDF8` | Inspection/customs badge, informational alerts |

---

## 4. Spacing, Radii, & Elevation

- **Spacing Grid**: Strict `4px` increments (`4, 8, 12, 16, 20, 24, 32, 40, 48, 64`).
- **Border Radii**:
  - Controls (`Button`, `Input`, `Select`): `8px` (`rounded-lg`)
  - Cards & Sheets (`Card`, `Modal`, `ListingCard`): `12px` (`rounded-xl`)
  - Chips & Pills (`Chip`, `Badge`): `9999px` (`rounded-full`)
- **Touch Targets**: Minimum `44px × 44px` on all interactive mobile controls.

---

## 5. Core Component Catalog (`src/components/ui/`)

1. **`Button`**: Variants (`primary`, `secondary`, `outline`, `ghost`, `danger`, `amber`), sizes (`sm`, `md`, `lg`), inline loading spinner without layout shift.
2. **`Input`**: Label, helper text, error message, prefix/suffix icons, tabular numeral mode for Naira inputs.
3. **`Select`**: Accessible native/custom select with chevron and validation state.
4. **`Chip`**: Filter/quick-reply pill with active, removable (`×`), and count states.
5. **`Badge`**: Semantic trust and auction badges (`Phone Verified`, `ID Verified`, `Verified Dealer`, `VIN Checked`, `Customs Reviewed`, `Inspected`, `No Reserve`, `Reserve Met`, `Reserve Not Met`).
6. **`Card`**: Elevated 1px border surface with optional interactive lift (`hover:-translate-y-0.5`).
7. **`Modal` / `Sheet`**: Responsive dialog on desktop (`max-w-lg`) that automatically renders as a thumb-friendly bottom sheet on mobile (`< 768px`).
8. **`Toast`**: Non-blocking notification queue (`success`, `warning`, `error`, `info`).
9. **`Tabs`**: Keyboard-accessible segmented and underline tabs.
10. **`Skeleton`**: Shimmer placeholder blocks matching card, gallery, and table dimensions to prevent CLS.
11. **`Avatar`**: User/dealer avatar with online status dot and verification indicator.
12. **`Countdown`**: Server-synced tabular countdown with `calm` (`>1h`), `urgent` (`<1h`, amber), and `critical` (`<5m`, crimson pulse) states.
13. **`PriceTag`**: Formats integer kobo into Naira (`₦14,500,000`) with optional compact notation (`₦14.5M`), negotiable tag, and roll animation on update.
14. **`EmptyState`**: Clean vector icon, clear Nigerian-friendly microcopy, and primary recovery CTA.

