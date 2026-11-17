import { Router, type Request, type Response } from 'express';
import { BRAND_CONFIG } from '@autodey/shared';

export const docsRouter = Router();

const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: `${BRAND_CONFIG.name} API Documentation`,
    version: '1.0.0',
    description: `
**${BRAND_CONFIG.name}** — Nigeria's Premier Verified Vehicle Marketplace & Timed Auctions Platform.

### Key Highlights
- **Currencies & Money**: All monetary amounts are handled strictly as integer **kobo** (e.g. ₦1,000,000 = \`100000000\` kobo) to eliminate floating-point rounding errors.
- **Authentication**: JWT access tokens (15-minute lifespan) passed in \`Authorization: Bearer <token>\` header + HTTP-only rotating refresh tokens.
- **Reliability & Resilience**: Built-in fallbacks for distributed Redis locking, mock KYC/SMS providers, and full container readiness on Railway.
- **Interactive Testing**: Click **Authorize** above to enter your Bearer access token and execute live API requests directly from this console.
    `,
    contact: {
      name: `${BRAND_CONFIG.name} Support`,
      email: 'support@gidanmota.ng',
    },
  },
  servers: [
    { url: '/api/v1', description: 'API v1 Base URL' },
    { url: '/', description: 'Root Server (Health & Readiness)' },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter your JWT access token obtained from /api/v1/auth/signup or /api/v1/auth/login.',
      },
    },
    schemas: {
      ApiResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string', example: 'Operation completed successfully.' },
          data: { type: 'object' },
        },
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          code: { type: 'string', example: 'VALIDATION_ERROR' },
          message: { type: 'string', example: 'Invalid request input provided.' },
          details: { type: 'object' },
        },
      },
      SignupRequest: {
        type: 'object',
        required: ['name', 'password'],
        properties: {
          name: { type: 'string', example: 'Amina Bello' },
          email: { type: 'string', format: 'email', example: 'amina.bello@example.com' },
          phone: { type: 'string', example: '+2348012345678' },
          password: { type: 'string', format: 'password', minLength: 8, example: 'Password123!' },
          role: { type: 'string', enum: ['BUYER', 'PRIVATE_SELLER', 'DEALER'], default: 'BUYER' },
        },
      },
      LoginRequest: {
        type: 'object',
        required: ['password'],
        properties: {
          email: { type: 'string', example: 'amina.bello@example.com' },
          phone: { type: 'string', example: '+2348012345678' },
          password: { type: 'string', format: 'password', example: 'Password123!' },
        },
      },
      ListingCreateRequest: {
        type: 'object',
        required: ['make', 'model', 'year', 'priceKobo', 'state', 'lga'],
        properties: {
          make: { type: 'string', example: 'Toyota' },
          model: { type: 'string', example: 'Camry' },
          year: { type: 'integer', example: 2021 },
          trim: { type: 'string', example: 'XLE V6' },
          priceKobo: { type: 'integer', example: 1850000000, description: 'Price in kobo (₦18,500,000)' },
          mileageKm: { type: 'integer', example: 45000 },
          condition: { type: 'string', enum: ['TOKUNBO', 'NIGERIAN_USED', 'BRAND_NEW'], example: 'TOKUNBO' },
          transmission: { type: 'string', enum: ['AUTOMATIC', 'MANUAL'], example: 'AUTOMATIC' },
          fuelType: { type: 'string', enum: ['PETROL', 'DIESEL', 'HYBRID', 'ELECTRIC'], example: 'PETROL' },
          state: { type: 'string', example: 'Lagos' },
          lga: { type: 'string', example: 'Ikeja' },
          description: { type: 'string', example: 'Flawless condition, first body, accident free.' },
          mediaUrls: {
            type: 'array',
            items: { type: 'string' },
            example: ['https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb'],
          },
        },
      },
      BidRequest: {
        type: 'object',
        required: ['amountKobo'],
        properties: {
          amountKobo: { type: 'integer', example: 1250000000, description: 'Bid amount in kobo' },
        },
      },
      AutoBidRequest: {
        type: 'object',
        required: ['maxAmountKobo'],
        properties: {
          maxAmountKobo: { type: 'integer', example: 1500000000, description: 'Maximum ceiling amount in kobo' },
        },
      },
      WalletFundRequest: {
        type: 'object',
        required: ['amountKobo'],
        properties: {
          amountKobo: { type: 'integer', example: 50000000, description: 'Amount to fund in kobo (₦500,000)' },
          callbackUrl: { type: 'string', example: 'https://gidanmota.ng/wallet' },
        },
      },
    },
  },
  paths: {
    '/health': {
      get: {
        tags: ['System & Health'],
        summary: 'Server status & ping',
        description: 'Returns basic health and uptime metrics for uptime monitors and Railway.',
        responses: {
          '200': { description: 'Server is healthy' },
        },
      },
    },
    '/ready': {
      get: {
        tags: ['System & Health'],
        summary: 'Deep infrastructure readiness probe',
        description: 'Validates active connection to MongoDB Atlas and distributed lock engine.',
        responses: {
          '200': { description: 'All database and lock subsystems ready' },
          '503': { description: 'Subsystem disconnected or reconnecting' },
        },
      },
    },
    '/auth/signup': {
      post: {
        tags: ['Authentication'],
        summary: 'Register new user',
        description: 'Sign up with email and password or phone. Generates session JWT tokens immediately without mandatory SMS wait.',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/SignupRequest' } } },
        },
        responses: {
          '201': { description: 'User account registered and access token issued' },
          '400': { description: 'Validation failed or account exists' },
        },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Authentication'],
        summary: 'Log in with credentials',
        description: 'Authenticate using email or phone with password. Returns 15-minute Bearer token and sets secure HTTP-only refresh cookie.',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginRequest' } } },
        },
        responses: {
          '200': { description: 'Logged in successfully' },
          '401': { description: 'Invalid email or password' },
        },
      },
    },
    '/auth/refresh': {
      post: {
        tags: ['Authentication'],
        summary: 'Rotate refresh token',
        description: 'Exchanges current refresh token for fresh access token and rotated refresh token.',
        responses: {
          '200': { description: 'Token refreshed' },
          '401': { description: 'Invalid or expired session' },
        },
      },
    },
    '/auth/logout': {
      post: {
        tags: ['Authentication'],
        summary: 'Log out user',
        description: 'Invalidates session and clears HTTP-only refresh cookie.',
        responses: {
          '200': { description: 'Logged out successfully' },
        },
      },
    },
    '/auth/me': {
      get: {
        tags: ['Authentication'],
        summary: 'Get current user identity',
        security: [{ BearerAuth: [] }],
        responses: {
          '200': { description: 'Current authenticated user profile' },
          '401': { description: 'Unauthorized' },
        },
      },
    },
    '/users/me': {
      get: {
        tags: ['Users & Profile'],
        summary: 'Get full user profile & KYC status',
        security: [{ BearerAuth: [] }],
        responses: {
          '200': { description: 'User profile with KYC and dealer verification badges' },
        },
      },
      patch: {
        tags: ['Users & Profile'],
        summary: 'Update personal details',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  phone: { type: 'string' },
                  state: { type: 'string' },
                  lga: { type: 'string' },
                  avatarUrl: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Profile updated' },
        },
      },
      delete: {
        tags: ['Users & Profile'],
        summary: 'NDPA 2023 Account Deletion',
        security: [{ BearerAuth: [] }],
        responses: {
          '200': { description: 'Account anonymized and deleted' },
        },
      },
    },
    '/users/me/kyc': {
      post: {
        tags: ['Users & Profile'],
        summary: 'Submit identity verification (KYC)',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['idType', 'idNumber'],
                properties: {
                  idType: { type: 'string', enum: ['NIN', 'BVN', 'DRIVERS_LICENSE', 'VOTERS_CARD'] },
                  idNumber: { type: 'string', example: '12345678901' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'KYC verified or pending review' },
        },
      },
    },
    '/users/me/dealer-application': {
      post: {
        tags: ['Users & Profile'],
        summary: 'Apply for Verified Dealer status',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['businessName', 'cacNumber', 'businessAddress'],
                properties: {
                  businessName: { type: 'string', example: 'Alhaji Motors Ltd' },
                  cacNumber: { type: 'string', example: 'RC-1849204' },
                  businessAddress: { type: 'string', example: '42 Ahmadu Bello Way, Kaduna' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Dealer application submitted for verification' },
        },
      },
    },
    '/users/{id}/profile': {
      get: {
        tags: ['Users & Profile'],
        summary: 'Get public seller or dealer profile',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'User ID' },
        ],
        responses: {
          '200': { description: 'Public seller profile with trust rating & active listings' },
        },
      },
    },
    '/listings': {
      get: {
        tags: ['Listings'],
        summary: 'Search & filter vehicle listings',
        parameters: [
          { name: 'q', in: 'query', schema: { type: 'string' }, description: 'Keyword search' },
          { name: 'make', in: 'query', schema: { type: 'string' }, description: 'Vehicle make (e.g. Toyota, Honda)' },
          { name: 'model', in: 'query', schema: { type: 'string' }, description: 'Vehicle model' },
          { name: 'state', in: 'query', schema: { type: 'string' }, description: 'Nigerian state' },
          { name: 'minPrice', in: 'query', schema: { type: 'integer' }, description: 'Min price in kobo' },
          { name: 'maxPrice', in: 'query', schema: { type: 'integer' }, description: 'Max price in kobo' },
          { name: 'condition', in: 'query', schema: { type: 'string', enum: ['TOKUNBO', 'NIGERIAN_USED', 'BRAND_NEW'] } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
        ],
        responses: {
          '200': { description: 'Paginated vehicle listings' },
        },
      },
      post: {
        tags: ['Listings'],
        summary: 'Create vehicle listing',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ListingCreateRequest' } } },
        },
        responses: {
          '201': { description: 'Listing created successfully' },
        },
      },
    },
    '/listings/{id}': {
      get: {
        tags: ['Listings'],
        summary: 'Get listing details',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Detailed listing with inspection badge & seller info' },
          '404': { description: 'Listing not found' },
        },
      },
      patch: {
        tags: ['Listings'],
        summary: 'Update vehicle listing',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Listing updated' },
        },
      },
      delete: {
        tags: ['Listings'],
        summary: 'Delete or deactivate listing',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Listing removed' },
        },
      },
    },
    '/listings/{id}/boost': {
      post: {
        tags: ['Listings'],
        summary: 'Promote listing visibility',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Listing promoted to featured tier' },
        },
      },
    },
    '/listings/{id}/save': {
      post: {
        tags: ['Listings'],
        summary: 'Save/bookmark listing',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Listing saved to favorites' },
        },
      },
    },
    '/listings/saved': {
      get: {
        tags: ['Listings'],
        summary: 'Get user saved listings',
        security: [{ BearerAuth: [] }],
        responses: {
          '200': { description: 'List of saved vehicles' },
        },
      },
    },
    '/auctions': {
      get: {
        tags: ['Auctions'],
        summary: 'List active and upcoming timed auctions',
        responses: {
          '200': { description: 'Active auctions with current bids and countdown timer' },
        },
      },
    },
    '/auctions/{id}': {
      get: {
        tags: ['Auctions'],
        summary: 'Get auction room status',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Auction details, minimum next bid, reserve price status' },
        },
      },
    },
    '/auctions/{id}/bids': {
      post: {
        tags: ['Auctions'],
        summary: 'Place manual auction bid',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/BidRequest' } } },
        },
        responses: {
          '201': { description: 'Bid placed successfully (sniping protection triggers +2 min extension)' },
          '400': { description: 'Bid below minimum increment or auction ended' },
        },
      },
    },
    '/auctions/{id}/auto-bid': {
      post: {
        tags: ['Auctions'],
        summary: 'Configure proxy / auto-bidding ceiling',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/AutoBidRequest' } } },
        },
        responses: {
          '200': { description: 'Auto-bid ceiling configured' },
        },
      },
    },
    '/verification/vin/{vin}': {
      get: {
        tags: ['Verification & Inspections'],
        summary: 'VIN Decoder & Specs',
        parameters: [{ name: 'vin', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Decoded manufacturer, model, engine specs, and country of origin' },
        },
      },
    },
    '/verification/request': {
      post: {
        tags: ['Verification & Inspections'],
        summary: 'Book 120-point mechanical inspection',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['listingId', 'locationState', 'inspectionTier'],
                properties: {
                  listingId: { type: 'string' },
                  locationState: { type: 'string' },
                  inspectionTier: { type: 'string', enum: ['STANDARD', 'PREMIUM', 'CUSTOMS_VERIFIED'] },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'Inspection dispatched' },
        },
      },
    },
    '/wallet': {
      get: {
        tags: ['Wallet & Payments'],
        summary: 'Get wallet balance in kobo',
        security: [{ BearerAuth: [] }],
        responses: {
          '200': { description: 'Available balance, escrow lockups, and recent ledger entries' },
        },
      },
    },
    '/wallet/fund': {
      post: {
        tags: ['Wallet & Payments'],
        summary: 'Initialize Paystack deposit',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/WalletFundRequest' } } },
        },
        responses: {
          '200': { description: 'Paystack checkout authorization URL and reference' },
        },
      },
    },
    '/escrow/transactions': {
      post: {
        tags: ['Escrow & Commerce'],
        summary: 'Initiate escrow transaction for car purchase',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['listingId', 'sellerId', 'agreedPriceKobo'],
                properties: {
                  listingId: { type: 'string' },
                  sellerId: { type: 'string' },
                  agreedPriceKobo: { type: 'integer' },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'Escrow contract created, funds held safely' },
        },
      },
    },
    '/escrow/transactions/{id}/confirm-delivery': {
      post: {
        tags: ['Escrow & Commerce'],
        summary: 'Buyer confirms physical vehicle handover',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Funds released to seller payout account' },
        },
      },
    },
    '/escrow/transactions/{id}/raise-dispute': {
      post: {
        tags: ['Escrow & Commerce'],
        summary: 'Raise dispute on vehicle condition or paperwork',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['reason'],
                properties: {
                  reason: { type: 'string', example: 'Vehicle transmission defective contrary to report.' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Dispute opened, escrow funds locked under mediator review' },
        },
      },
    },
    '/conversations': {
      get: {
        tags: ['Chat & Messaging'],
        summary: 'List user conversations',
        security: [{ BearerAuth: [] }],
        responses: {
          '200': { description: 'Active conversations with latest messages' },
        },
      },
      post: {
        tags: ['Chat & Messaging'],
        summary: 'Start conversation about listing',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['listingId', 'recipientId'],
                properties: {
                  listingId: { type: 'string' },
                  recipientId: { type: 'string' },
                  initialMessage: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'Conversation started' },
        },
      },
    },
    '/conversations/{id}/messages': {
      get: {
        tags: ['Chat & Messaging'],
        summary: 'Get message thread',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Paginated message history' },
        },
      },
      post: {
        tags: ['Chat & Messaging'],
        summary: 'Send chat message',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['content'],
                properties: {
                  content: { type: 'string', example: 'Is the price slightly negotiable?' },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'Message sent & pushed via Socket.io' },
        },
      },
    },
    '/admin/metrics': {
      get: {
        tags: ['Admin Portal'],
        summary: 'Get platform metrics & KPI dashboard',
        security: [{ BearerAuth: [] }],
        responses: {
          '200': { description: 'Gross merchandise volume, active auctions, escrow totals' },
        },
      },
    },
  },
};

docsRouter.get('/openapi.json', (_req: Request, res: Response) => {
  res.json(openApiSpec);
});

docsRouter.get('/', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/html');
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${BRAND_CONFIG.name} — Interactive API Documentation</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui.css" />
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='20' fill='%23006644'/><text y='.9em' font-size='70' x='15' fill='white'>🚗</text></svg>">
  <style>
    body {
      margin: 0;
      padding: 0;
      background: #0f172a;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #f1f5f9;
    }
    .custom-header {
      background: linear-gradient(135deg, #064e3b 0%, #022c22 100%);
      border-bottom: 2px solid #059669;
      padding: 1.5rem 2rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
    }
    .brand-title {
      display: flex;
      align-items: center;
      gap: 1rem;
    }
    .brand-logo-badge {
      width: 44px;
      height: 44px;
      border-radius: 12px;
      background: #10b981;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      box-shadow: 0 0 15px rgba(16, 185, 129, 0.5);
    }
    .brand-name {
      font-size: 1.5rem;
      font-weight: 800;
      letter-spacing: -0.025em;
      color: #ffffff;
      margin: 0;
    }
    .brand-subtitle {
      font-size: 0.85rem;
      color: #a7f3d0;
      margin: 0.2rem 0 0 0;
    }
    .header-links {
      display: flex;
      gap: 1rem;
    }
    .header-links a {
      color: #e2e8f0;
      text-decoration: none;
      font-size: 0.9rem;
      font-weight: 600;
      padding: 0.4rem 0.9rem;
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.1);
      transition: all 0.2s ease;
    }
    .header-links a:hover {
      background: #10b981;
      color: #ffffff;
    }
    #swagger-ui {
      max-width: 1300px;
      margin: 0 auto;
      padding: 1.5rem;
      background: #ffffff;
      border-radius: 16px;
      margin-top: 1.5rem;
      margin-bottom: 3rem;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
    }
    .swagger-ui .topbar { display: none !important; }
  </style>
</head>
<body>
  <header class="custom-header">
    <div class="brand-title">
      <div class="brand-logo-badge">🚗</div>
      <div>
        <h1 class="brand-name">${BRAND_CONFIG.name} API</h1>
        <p class="brand-subtitle">Automotive Marketplace & Live Auction Services</p>
      </div>
    </div>
    <div class="header-links">
      <a href="/api/docs/openapi.json" target="_blank">Raw OpenAPI JSON</a>
      <a href="/health" target="_blank">Health Check</a>
      <a href="/ready" target="_blank">Readiness Probe</a>
    </div>
  </header>

  <div id="swagger-ui"></div>

  <script src="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui-bundle.js"></script>
  <script src="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui-standalone-preset.js"></script>
  <script>
    window.onload = () => {
      window.ui = SwaggerUIBundle({
        url: '/api/docs/openapi.json',
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        layout: "BaseLayout",
        docExpansion: 'list',
        defaultModelsExpandDepth: 1,
        persistAuthorization: true,
      });
    };
  </script>
</body>
</html>`);
});
