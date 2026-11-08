# Architectural & Product Decisions Log (`/docs/decisions.md`)

This document records key technical, product, and compliance decisions made during the design and implementation of **AutoDey**.

---

## ADR-001: Brand Name Constant (`APP_BRAND_NAME`)
- **Decision**: Centralize the brand name (`"AutoDey"`), tagline, domain, and support contact in `packages/shared/src/config/brand.ts` as `BRAND_CONFIG`.
- **Rationale**: Allows rebranding the entire web client, API responses, watermarks, SMS sender IDs, and email templates by changing a single constant.

## ADR-002: Integer Kobo Storage for All Monetary Amounts
- **Decision**: Every monetary field across MongoDB schemas, API payloads, and bidding calculations is stored and computed in **integer kobo** (`1 NGN = 100 kobo`). Floating-point numbers are rejected by Zod schemas (`z.number().int()`).
- **Rationale**: Prevents IEEE-754 floating-point rounding bugs in proxy bid increments, wallet ledger balances, and percentage fee calculations.

## ADR-003: Refundable Bidding Deposit & Direct Settlement Default (`DIRECT` vs `HOLD`)
- **Decision**:
  - Never use the word "escrow" in the UI. Always label the bidder's wallet lock as **"Refundable bidding deposit"**.
  - Default `SETTLEMENT_MODE` is `'DIRECT'`: Buyer and seller complete the vehicle purchase directly after an auction closes, while the platform holds the buyer's refundable deposit as a good-faith commitment during the 72-hour settlement window.
  - `'HOLD'` mode is implemented behind an admin feature flag (`SETTLEMENT_MODE=HOLD`) and documented with an explicit compliance comment that a CBN-licensed escrow partner must be integrated before public activation.
- **Default Policy Values (Editable in Admin Config)**:
  - **Deposit Multiplier**: `50x` (e.g., `₦100,000` deposit unlocks `₦5,000,000` bidding power).
  - **Bid Increment Table**:
    - Under `₦1,000,000`: `₦10,000`
    - `₦1,000,000` – `₦2,999,999`: `₦25,000`
    - `₦3,000,000` – `₦9,999,999`: `₦50,000`
    - `₦10,000,000` and above: `₦100,000`
  - **Seller Success Fee**: `2.5%` of hammer price, capped at `₦250,000`.
  - **Default Penalty**: Up to `50%` of the required deposit forfeited upon confirmed buyer default after the 72h settlement window + `1` strike (`3` strikes = auction ban).

## ADR-004: Zero-Docker Local Replica Set & Lock/Queue Fallback on Windows
- **Decision**: Provide `docker-compose.yml` for standard Docker environments, **plus** an automatic local fallback in `apps/api` that detects when external MongoDB/Redis are unavailable and boots a local MongoDB replica set (using the host's `mongod.exe` binary via a managed local replica set runner / `mongodb-memory-server`) and an in-process atomic lock + delayed job scheduler.
- **Rationale**: Ensures `pnpm dev` and multi-document ACID transactions (required for the 50-concurrent-bid stress test) run reliably out-of-the-box on Windows hosts without Docker Desktop installed.

## ADR-005: Privacy & NDPA 2023 Compliance (KYC & Phone Masking)
- **Decision**:
  - `KycRecord` stores only `{ provider, providerReference, documentType, status, verifiedAt }`. Raw NIN or BVN numbers are **never** persisted in the database or logs.
  - Seller phone numbers are masked (`0803 *** **89`) in public API responses and only returned via the authenticated, rate-limited `POST /api/v1/listings/:id/reveal-phone` endpoint (or mutually revealed inside a post-auction settlement room).
  - Provide `/api/v1/users/me/export` (JSON data portability) and `/api/v1/users/me` `DELETE` (account anonymization/deletion) endpoints.

## ADR-006: Poppins Typography Paired with Tabular Figures
- **Decision**: Use **Poppins** (`400`, `500`, `600`, `700`) as the primary brand typeface across headings and UI controls, paired with strict `font-variant-numeric: tabular-nums` (`JetBrains Mono` / tabular numeral feature) on all Naira prices, bid increments, and countdown timers.
- **Rationale**: Honors the user's explicit request for Poppins while guaranteeing zero horizontal jitter during live auction countdowns and price rolls.

