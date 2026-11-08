import crypto from 'node:crypto';
import { Router, type Request, type Response, type NextFunction } from 'express';
import {
  PasswordLoginSchema,
  RequestOtpSchema,
  VerifyOtpSchema,
  maskPhone,
} from '@autodey/shared';
import { env } from '../../config/env.js';
import { smsAdapter } from '../../adapters/index.js';
import { AppError, validateBody } from '../../middleware/errors.js';
import { signAccessToken, requireAuth } from '../../middleware/auth.js';
import { rateLimit } from '../../middleware/rateLimit.js';
import {
  DeviceFingerprintModel,
  OtpCodeModel,
  SessionModel,
  UserModel,
  WalletAccountModel,
  type IUser,
} from '../../models/index.js';

export const authRouter = Router();

const REFRESH_COOKIE_NAME = 'autodey_refresh';

function hashValue(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, key] = storedHash.split(':');
  if (!salt || !key) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const keyBuf = Buffer.from(key, 'hex');
  if (derived.length !== keyBuf.length) return false;
  return crypto.timingSafeEqual(derived, keyBuf);
}

function setRefreshCookie(res: Response, rawToken: string): void {
  res.cookie(REFRESH_COOKIE_NAME, rawToken, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/v1/auth',
    maxAge: env.JWT_REFRESH_EXPIRES_DAYS * 24 * 60 * 60 * 1000,
  });
}

function serializeAuthUser(user: IUser) {
  return {
    id: user._id.toString(),
    phone: user.phone,
    phoneMasked: maskPhone(user.phone),
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    state: user.state,
    lga: user.lga,
    whatsappNumber: user.whatsappNumber,
    roles: user.roles,
    verification: user.verification,
    strikes: user.strikes,
    responseStats: user.responseStats,
    ratingStats: user.ratingStats,
    notificationPrefs: user.notificationPrefs,
    createdAt: user.createdAt.toISOString(),
  };
}

authRouter.post(
  '/otp/request',
  rateLimit({ prefix: 'otp-ip', maxRequests: 12, windowSeconds: 300 }),
  validateBody(RequestOtpSchema),
  rateLimit({
    prefix: 'otp-phone',
    maxRequests: 5,
    windowSeconds: 300,
    keyExtractor: (req) => req.body.phone,
  }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { phone } = req.body as { phone: string };
      const code = String(crypto.randomInt(100_000, 999_999));
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

      await OtpCodeModel.deleteMany({ phone });
      await OtpCodeModel.create({
        phone,
        codeHash: hashValue(code),
        attempts: 0,
        ip: req.ip,
        expiresAt,
      });

      const smsResult = await smsAdapter.sendOtp(phone, code);

      res.status(200).json({
        message: 'Verification code sent via SMS.',
        phoneMasked: maskPhone(phone),
        expiresInSeconds: 300,
        provider: smsResult.provider,
        ...(env.SMS_PROVIDER === 'mock' ? { devOtpCode: code } : {}),
      });
    } catch (err) {
      next(err);
    }
  },
);

authRouter.post(
  '/otp/verify',
  rateLimit({ prefix: 'otp-verify', maxRequests: 15, windowSeconds: 300 }),
  validateBody(VerifyOtpSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { phone, code, displayName, email, password, deviceFingerprint } = req.body as {
        phone: string;
        code: string;
        displayName?: string;
        email?: string;
        password?: string;
        deviceFingerprint?: string;
      };

      const otpRecord = await OtpCodeModel.findOne({ phone }).sort({ createdAt: -1 });
      if (!otpRecord || otpRecord.expiresAt.getTime() < Date.now()) {
        throw AppError.badRequest('OTP_EXPIRED', 'OTP has expired or was not requested. Request a new code.');
      }

      if (otpRecord.attempts >= 5) {
        await OtpCodeModel.deleteOne({ _id: otpRecord._id });
        throw AppError.tooManyRequests('OTP_MAX_ATTEMPTS', 'Too many wrong attempts. Request a new OTP.');
      }

      const incomingHash = hashValue(code);
      const isMockShortcut = env.SMS_PROVIDER === 'mock' && code === '123456';
      if (otpRecord.codeHash !== incomingHash && !isMockShortcut) {
        otpRecord.attempts += 1;
        await otpRecord.save();
        throw AppError.badRequest('INVALID_OTP', 'Invalid verification code. Please check and try again.');
      }

      await OtpCodeModel.deleteOne({ _id: otpRecord._id });

      let user = await UserModel.findOne({ phone, deletedAt: null });
      let isNewUser = false;

      if (!user) {
        isNewUser = true;
        user = await UserModel.create({
          phone,
          displayName: displayName?.trim() || `Member ${phone.slice(-4)}`,
          ...(email ? { email: email.toLowerCase() } : {}),
          ...(password ? { passwordHash: hashPassword(password) } : {}),
          roles: ['buyer', 'seller'],
          verification: {
            phoneVerified: true,
            idVerified: false,
            dealerVerified: false,
          },
          ndpaConsentAt: new Date(),
        });
      } else {
        user.verification.phoneVerified = true;
        if (displayName && user.displayName.startsWith('Member ')) {
          user.displayName = displayName.trim();
        }
        if (email && !user.email) {
          user.email = email.toLowerCase();
        }
        if (password) {
          user.passwordHash = hashPassword(password);
        }
        await user.save();
      }

      if (user.bannedUntil && user.bannedUntil.getTime() > Date.now()) {
        throw AppError.forbidden('ACCOUNT_SUSPENDED', user.banReason || 'Your account is suspended.');
      }

      // Ensure wallet account exists
      await WalletAccountModel.findOneAndUpdate(
        { userId: user._id },
        { $setOnInsert: { userId: user._id, availableKobo: 0, heldKobo: 0, forfeitedKobo: 0, currency: 'NGN' } },
        { upsert: true, new: true },
      );

      // Record device fingerprint for anti-shill protection
      const ipHash = hashValue(req.ip || '127.0.0.1');
      const fpHash = hashValue(deviceFingerprint || req.headers['user-agent'] || 'browser');
      await DeviceFingerprintModel.findOneAndUpdate(
        { userId: user._id, fingerprintHash: fpHash },
        {
          userId: user._id,
          fingerprintHash: fpHash,
          ipHash,
          userAgent: req.headers['user-agent'],
          lastSeenAt: new Date(),
        },
        { upsert: true },
      );

      const rawRefresh = crypto.randomBytes(40).toString('hex');
      const familyId = crypto.randomUUID();
      await SessionModel.create({
        userId: user._id,
        tokenHash: hashValue(rawRefresh),
        familyId,
        deviceFingerprint: fpHash,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        expiresAt: new Date(Date.now() + env.JWT_REFRESH_EXPIRES_DAYS * 24 * 60 * 60 * 1000),
      });

      setRefreshCookie(res, rawRefresh);
      const accessToken = signAccessToken({
        sub: user._id.toString(),
        phone: user.phone,
        roles: user.roles,
      });

      res.status(isNewUser ? 201 : 200).json({
        accessToken,
        refreshToken: rawRefresh,
        isNewUser,
        user: serializeAuthUser(user),
      });
    } catch (err) {
      next(err);
    }
  },
);

authRouter.post(
  '/login/password',
  rateLimit({ prefix: 'pwd-login', maxRequests: 10, windowSeconds: 300 }),
  validateBody(PasswordLoginSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { phone, password } = req.body as { phone: string; password: string };
      const user = await UserModel.findOne({ phone, deletedAt: null }).select('+passwordHash');
      if (!user || !user.passwordHash || !verifyPassword(password, user.passwordHash)) {
        throw AppError.unauthorized('INVALID_CREDENTIALS', 'Wrong phone number or password.');
      }

      const rawRefresh = crypto.randomBytes(40).toString('hex');
      await SessionModel.create({
        userId: user._id,
        tokenHash: hashValue(rawRefresh),
        familyId: crypto.randomUUID(),
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        expiresAt: new Date(Date.now() + env.JWT_REFRESH_EXPIRES_DAYS * 24 * 60 * 60 * 1000),
      });

      setRefreshCookie(res, rawRefresh);
      const accessToken = signAccessToken({
        sub: user._id.toString(),
        phone: user.phone,
        roles: user.roles,
      });

      res.status(200).json({
        accessToken,
        refreshToken: rawRefresh,
        user: serializeAuthUser(user),
      });
    } catch (err) {
      next(err);
    }
  },
);

authRouter.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawToken =
      (req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined) ||
      (req.body?.refreshToken as string | undefined);

    if (!rawToken) {
      throw AppError.unauthorized('MISSING_REFRESH_TOKEN', 'No refresh token provided.');
    }

    const tokenHash = hashValue(rawToken);
    const session = await SessionModel.findOne({ tokenHash });
    if (!session) {
      throw AppError.unauthorized('INVALID_REFRESH_TOKEN', 'Invalid refresh session.');
    }

    // Reuse detection: if token was already revoked, revoke the whole family
    if (session.revokedAt || session.expiresAt.getTime() < Date.now()) {
      await SessionModel.updateMany({ familyId: session.familyId }, { $set: { revokedAt: new Date() } });
      res.clearCookie(REFRESH_COOKIE_NAME, { path: '/api/v1/auth' });
      throw AppError.unauthorized('REFRESH_TOKEN_REUSED', 'Session expired or compromised. Please sign in again.');
    }

    session.revokedAt = new Date();
    await session.save();

    const user = await UserModel.findById(session.userId);
    if (!user || user.deletedAt) {
      throw AppError.unauthorized('USER_NOT_FOUND', 'Account no longer active.');
    }

    const nextRawRefresh = crypto.randomBytes(40).toString('hex');
    await SessionModel.create({
      userId: user._id,
      tokenHash: hashValue(nextRawRefresh),
      familyId: session.familyId,
      deviceFingerprint: session.deviceFingerprint,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      expiresAt: new Date(Date.now() + env.JWT_REFRESH_EXPIRES_DAYS * 24 * 60 * 60 * 1000),
    });

    setRefreshCookie(res, nextRawRefresh);
    const accessToken = signAccessToken({
      sub: user._id.toString(),
      phone: user.phone,
      roles: user.roles,
    });

    res.status(200).json({
      accessToken,
      refreshToken: nextRawRefresh,
      user: serializeAuthUser(user),
    });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/logout', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawToken =
      (req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined) ||
      (req.body?.refreshToken as string | undefined);
    if (rawToken) {
      await SessionModel.updateOne({ tokenHash: hashValue(rawToken) }, { $set: { revokedAt: new Date() } });
    }
    res.clearCookie(REFRESH_COOKIE_NAME, { path: '/api/v1/auth' });
    res.status(200).json({ message: 'Signed out.' });
  } catch (err) {
    next(err);
  }
});

