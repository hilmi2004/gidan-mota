# AutoDey Production Deployment & Operations Guide

## 1. Infrastructure Requirements

1. **MongoDB Replica Set (`rs0`)**:
   - Required because the authoritative proxy bidding engine (`apps/api/src/modules/auctions/bidding.service.ts`) and double-entry refundable deposit ledger (`apps/api/src/modules/wallet/wallet.service.ts`) execute inside multi-document ACID transactions (`session.withTransaction`).
   - Recommended: **MongoDB Atlas M10+** (in `af-south-1` or `eu-west-1` for lowest latency to Nigerian ISPs: MTN, Airtel, Glo).
2. **Redis 7+**:
   - Used for per-auction distributed locks (`lock:auction:{id}`), OTP & phone-reveal rate limiting, and scheduled auction close timers.
3. **Node.js 20 LTS**:
   - Runs `apps/api` (`dist/server.js`) and builds `apps/web` static assets (`dist/`).

---

## 2. Docker Compose (Local Multi-Container Stack)

To run MongoDB (with replica set `rs0`), Redis, API, and Web in containers:

```bash
docker compose up --build -d
```

---

## 3. WhatsApp & Social Crawler SEO Prerendering

Because Nigerian car buyers and dealers heavily share vehicle links on WhatsApp, `GET /api/v1/listings/seo/:slug` serves server-rendered OpenGraph HTML (`og:title`, `og:description` with formatted Naira price, `og:image`, and `og:url`).

Configure your reverse proxy (Nginx / Cloudflare Worker) to route crawler user-agents (`WhatsApp`, `facebookexternalhit`, `Twitterbot`, `TelegramBot`, `Slackbot`) requesting `/cars/:state/:slug` or `/listings/:slug` to `/api/v1/listings/seo/:slug`:

```nginx
map $http_user_agent $is_social_crawler {
    default 0;
    ~*(WhatsApp|facebookexternalhit|Twitterbot|TelegramBot|Slackbot|LinkedInBot) 1;
}

location ~ ^/(cars/[^/]+|listings)/([^/]+)$ {
    if ($is_social_crawler) {
        rewrite ^/(?:cars/[^/]+|listings)/([^/]+)$ /api/v1/listings/seo/$1 break;
        proxy_pass http://api_upstream;
    }
    try_files $uri /index.html;
}
```

---

## 4. Legal & Regulatory Compliance (Nigeria)

- **Refundable Bidding Deposit (Not Escrow)**:
  - The platform never sits in the middle of the full vehicle purchase price for classifieds or `DIRECT` settlement auctions. It holds only a **Refundable Bidding Deposit** (`default ₦100,000` minimum, `50x` bidding power) in the buyer's wallet to prevent ghost bidders.
  - A `settlementMode: 'HOLD'` enum is reserved on `Auction` behind an admin flag, documented in code as requiring a CBN-licensed escrow partner before public activation.
- **NDPA 2023 (Nigeria Data Protection Act)**:
  - Raw NIN/BVN numbers are never stored in MongoDB (`KycRecord` stores only `provider`, `providerReference`, `documentType`, and `status`).
  - Users can export their full personal data (`GET /api/v1/users/me/export`) or anonymize/delete their account (`DELETE /api/v1/users/me`) at any time from `/profile`.

