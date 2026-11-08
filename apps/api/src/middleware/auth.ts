import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';
import type { UserRole } from '@autodey/shared';
import { env } from '../config/env.js';
import { AppError } from './errors.js';

export interface AuthTokenPayload {
  sub: string;
  phone: string;
  roles: UserRole[];
}

export type AuthenticatedRequest = Request;

declare global {
  namespace Express {
    interface Request {
      user?: AuthTokenPayload;
    }
  }
}

export function signAccessToken(payload: AuthTokenPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: '15m',
  });
}

export function verifyAccessToken(token: string): AuthTokenPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as AuthTokenPayload;
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    next(AppError.unauthorized('MISSING_TOKEN', 'Please sign in to continue.'));
    return;
  }
  const token = header.slice(7).trim();
  try {
    req.user = verifyAccessToken(token);
    next();
  } catch {
    next(AppError.unauthorized('INVALID_TOKEN', 'Your session has expired. Please sign in again.'));
  }
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    try {
      req.user = verifyAccessToken(header.slice(7).trim());
    } catch {
      // Ignore expired token on public route
    }
  }
  next();
}

export function requireRoles(...allowed: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(AppError.unauthorized());
      return;
    }
    const hasRole = req.user.roles.some((r) => allowed.includes(r));
    if (!hasRole) {
      next(
        AppError.forbidden(
          'INSUFFICIENT_ROLE',
          `Requires one of the following roles: ${allowed.join(', ')}`,
        ),
      );
      return;
    }
    next();
  };
}

