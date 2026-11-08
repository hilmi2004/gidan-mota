import type { Request, Response, NextFunction } from 'express';
import { incrementRateCounter } from '../config/redis.js';
import { AppError } from './errors.js';

export function rateLimit(options: {
  prefix: string;
  maxRequests: number;
  windowSeconds: number;
  keyExtractor?: (req: Request) => string;
}) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const identifier =
        options.keyExtractor?.(req) ??
        req.user?.sub ??
        (req.headers['x-forwarded-for'] as string) ??
        req.ip ??
        'anon';
      const key = `rl:${options.prefix}:${identifier}`;
      const count = await incrementRateCounter(key, options.windowSeconds);
      if (count > options.maxRequests) {
        next(
          AppError.tooManyRequests(
            'RATE_LIMIT_EXCEEDED',
            `Rate limit reached. Try again in ${options.windowSeconds} seconds.`,
          ),
        );
        return;
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

