import { Router, type Request, type Response } from 'express';
import { BRAND_CONFIG } from '@autodey/shared';

export const docsRouter = Router();

const openApiSpec = {
  openapi: '3.1.0',
  info: {
    title: `${BRAND_CONFIG.name} REST API`,
    version: '1.0.0',
    description: `${BRAND_CONFIG.name} — Nigerian Car Marketplace & Timed Auctions API (All money amounts in integer kobo).`,
  },
  servers: [{ url: '/api/v1', description: 'API v1' }],
  paths: {
    '/auth/otp/request': {
      post: {
        tags: ['Auth'],
        summary: 'Request 6-digit phone OTP via SMS (Termii / Mock adapter)',
      },
    },
    '/auth/otp/verify': {
      post: {
        tags: ['Auth'],
        summary: 'Verify OTP, issue 15-min JWT access token + rotate httpOnly refresh cookie',
      },
    },
    '/auth/refresh': {
      post: {
        tags: ['Auth'],
        summary: 'Rotate refresh token and issue new access token',
      },
    },
    '/users/me': {
      get: { tags: ['Users'], summary: 'Get authenticated user profile, KYC, dealer & wallet status' },
      patch: { tags: ['Users'], summary: 'Update profile and notification preferences' },
      delete: { tags: ['Users'], summary: 'NDPA 2023 account anonymization & deletion' },
    },
    '/users/me/kyc': {
      post: {
        tags: ['Users'],
        summary: 'Verify identity via KYC adapter (stores reference & status only, never raw NIN/BVN)',
      },
    },
    '/users/me/dealer-application': {
      post: {
        tags: ['Users'],
        summary: 'Submit CAC RC/BN number, address, and shop photos for Verified Dealer badge',
      },
    },
    '/users/{id}/profile': {
      get: {
        tags: ['Users'],
        summary: 'Get public seller/buyer profile, badges, response rate, and reviews',
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
  <title>${BRAND_CONFIG.name} API Documentation</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui.css" />
</head>
<body style="margin:0;background:#F8F8F6;">
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui-bundle.js"></script>
  <script>
    window.onload = () => {
      window.ui = SwaggerUIBundle({
        url: '/api/docs/openapi.json',
        dom_id: '#swagger-ui',
      });
    };
  </script>
</body>
</html>`);
});

