import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';
import { BRAND_CONFIG } from '@autodey/shared';
import { env } from './config/env.js';
import { isRedisHealthy } from './config/redis.js';
import { AppError, errorHandler, requestIdMiddleware } from './middleware/errors.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { usersRouter } from './modules/users/users.routes.js';
import { trustRouter } from './modules/users/trust.routes.js';
import { listingsRouter } from './modules/listings/listings.routes.js';
import { chatRouter } from './modules/chat/chat.routes.js';
import { notificationsRouter } from './modules/notifications/notifications.routes.js';
import { walletRouter } from './modules/wallet/wallet.routes.js';
import { auctionsRouter } from './modules/auctions/auctions.routes.js';
import { verificationRouter } from './modules/verification/verification.routes.js';
import { commerceRouter } from './modules/commerce/commerce.routes.js';
import { adminRouter } from './modules/admin/admin.routes.js';
import { docsRouter } from './openapi/docs.routes.js';

function sanitizeObject(obj: unknown): unknown {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeObject);
  const cleaned: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
    if (key.startsWith('$') || key.includes('.')) continue;
    cleaned[key] = sanitizeObject(val);
  }
  return cleaned;
}

function mongoSanitizeMiddleware(req: Request, _res: Response, next: NextFunction): void {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }
  next();
}

export function createApp(): Express {
  const app = express();

  app.use(requestIdMiddleware);
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.use(
    cors({
      origin: [env.WEB_URL, 'http://localhost:5173', 'http://127.0.0.1:5173'],
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '2mb' }));
  app.use(cookieParser());
  app.use(mongoSanitizeMiddleware);

  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({
      status: 'ok',
      brand: BRAND_CONFIG.name,
      serverTimeMs: Date.now(),
      uptimeSeconds: Math.round(process.uptime()),
    });
  });

  app.get('/ready', (_req: Request, res: Response) => {
    const mongoReady = mongoose.connection.readyState === 1;
    const redisReady = isRedisHealthy();
    res.status(mongoReady ? 200 : 503).json({
      ready: mongoReady && redisReady,
      mongo: mongoReady ? 'connected' : 'disconnected',
      redis: redisReady ? 'ready' : 'unavailable',
      serverTimeMs: Date.now(),
    });
  });

  app.use('/api/docs', docsRouter);
  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/users', usersRouter);
  app.use('/api/v1', trustRouter);
  app.use('/api/v1', chatRouter);
  app.use('/api/v1', notificationsRouter);
  app.use('/api/v1', walletRouter);
  app.use('/api/v1', auctionsRouter);
  app.use('/api/v1', verificationRouter);
  app.use('/api/v1', commerceRouter);
  app.use('/api/v1', adminRouter);
  app.use('/api/v1', listingsRouter);

  app.use((_req: Request, _res: Response, next: NextFunction) => {
    next(AppError.notFound('ROUTE_NOT_FOUND', 'The requested API endpoint does not exist.'));
  });

  app.use(errorHandler);

  return app;
}

