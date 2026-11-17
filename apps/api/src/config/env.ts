import dotenv from 'dotenv';
import { z } from 'zod';
import { BRAND_NAME } from '@autodey/shared';

dotenv.config({ path: '../../.env' });
dotenv.config();

// Sanitize process.env: trim strings and convert empty/whitespace-only strings to undefined
// so that Zod schema defaults trigger properly in containerized environments (like Railway).
const rawEnv: Record<string, string | undefined> = {};
for (const [key, val] of Object.entries(process.env)) {
  if (typeof val === 'string' && val.trim() === '') {
    rawEnv[key] = undefined;
  } else {
    rawEnv[key] = typeof val === 'string' ? val.trim() : val;
  }
}

const isRailway = Boolean(rawEnv.RAILWAY_ENVIRONMENT || rawEnv.RAILWAY_SERVICE_ID || rawEnv.RAILWAY_PROJECT_ID);

const defaultNodeEnv: 'development' | 'test' | 'production' = isRailway ? 'production' : 'development';

const defaultMongoUri =
  rawEnv.MONGODB_URI ||
  rawEnv.MONGO_URL ||
  rawEnv.MONGO_PRIVATE_URL ||
  rawEnv.MONGO_PUBLIC_URL ||
  rawEnv.DATABASE_URL ||
  'mongodb://127.0.0.1:27017/autodey';

const defaultRedisUrl =
  rawEnv.REDIS_URL ||
  rawEnv.REDISURL ||
  rawEnv.REDIS_PRIVATE_URL ||
  rawEnv.REDIS_PUBLIC_URL ||
  'redis://127.0.0.1:6379';

const defaultWebUrl =
  rawEnv.WEB_URL ||
  (rawEnv.RAILWAY_PUBLIC_DOMAIN ? `https://${rawEnv.RAILWAY_PUBLIC_DOMAIN}` : 'http://localhost:5173');

const defaultApiUrl =
  rawEnv.API_URL ||
  (rawEnv.RAILWAY_PUBLIC_DOMAIN ? `https://${rawEnv.RAILWAY_PUBLIC_DOMAIN}` : 'http://localhost:4000');

const EnvSchema = z.object({
  BRAND_NAME: z.string().default(BRAND_NAME),
  NODE_ENV: z
    .string()
    .optional()
    .transform((v): 'development' | 'test' | 'production' => {
      if (!v || v.trim() === '') return defaultNodeEnv;
      const lower = v.trim().toLowerCase();
      if (lower === 'production' || lower === 'prod') return 'production';
      if (lower === 'test') return 'test';
      return 'development';
    }),
  PORT: z.preprocess((v) => {
    if (v === undefined || v === null || v === '') return 4000;
    const num = Number(v);
    return isNaN(num) || num <= 0 ? 4000 : num;
  }, z.number().int().default(4000)),
  WEB_URL: z.string().default(defaultWebUrl),
  API_URL: z.string().default(defaultApiUrl),
  MONGODB_URI: z.string().default(defaultMongoUri),
  REDIS_URL: z.string().default(defaultRedisUrl),
  USE_LOCAL_EMBEDDED_INFRA: z
    .string()
    .optional()
    .transform((v) => {
      if (v !== undefined) return v === 'true' || v === '1';
      if (
        defaultNodeEnv === 'production' ||
        isRailway ||
        (defaultMongoUri && !defaultMongoUri.includes('127.0.0.1')) ||
        Boolean(rawEnv.MONGO_URL) ||
        Boolean(rawEnv.DATABASE_URL)
      ) {
        return false;
      }
      return true;
    }),
  JWT_ACCESS_SECRET: z
    .string()
    .optional()
    .transform((v) => (v && v.length >= 16 ? v : 'autodey-dev-access-secret-key-2026-ng')),
  JWT_REFRESH_SECRET: z
    .string()
    .optional()
    .transform((v) => (v && v.length >= 16 ? v : 'autodey-dev-refresh-secret-key-2026-ng')),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_DAYS: z.coerce.number().int().default(30),
  SMS_PROVIDER: z.string().optional().transform((v): 'mock' | 'termii' => (v === 'termii' ? 'termii' : 'mock')),
  TERMII_API_KEY: z.string().optional().default(''),
  TERMII_SENDER_ID: z.string().default(BRAND_NAME),
  KYC_PROVIDER: z
    .string()
    .optional()
    .transform((v): 'mock' | 'dojah' | 'smile_id' => (v === 'dojah' || v === 'smile_id' ? v : 'mock')),
  DOJAH_APP_ID: z.string().optional().default(''),
  DOJAH_SECRET_KEY: z.string().optional().default(''),
  CUSTOMS_VERIFICATION_PROVIDER: z
    .string()
    .optional()
    .transform((v): 'manual_admin' | 'mock' => (v === 'mock' ? 'mock' : 'manual_admin')),
  MEDIA_PROVIDER: z.string().optional().transform((v): 'mock' | 'cloudinary' => (v === 'cloudinary' ? 'cloudinary' : 'mock')),
  CLOUDINARY_CLOUD_NAME: z.string().optional().default(''),
  CLOUDINARY_API_KEY: z.string().optional().default(''),
  CLOUDINARY_API_SECRET: z.string().optional().default(''),
  PAYMENT_PROVIDER: z.string().optional().transform((v): 'mock' | 'paystack' => (v === 'paystack' ? 'paystack' : 'mock')),
  PAYSTACK_SECRET_KEY: z.string().optional().default(''),
  PAYSTACK_PUBLIC_KEY: z.string().optional().default(''),
  PAYSTACK_WEBHOOK_SECRET: z.string().optional().default(''),
  EMAIL_PROVIDER: z.string().optional().transform((v): 'mock' | 'resend' => (v === 'resend' ? 'resend' : 'mock')),
  RESEND_API_KEY: z.string().optional().default(''),
  EMAIL_FROM: z.string().default('no-reply@autodey.ng'),
  VIN_PROVIDER: z.string().optional().transform((v): 'mock' | 'nhtsa' => (v === 'nhtsa' ? 'nhtsa' : 'mock')),
  NHTSA_VPIC_BASE_URL: z.string().default('https://vpic.nhtsa.dot.gov/api/vehicles'),
  SETTLEMENT_MODE: z.string().optional().transform((v): 'DIRECT' | 'HOLD' => (v === 'HOLD' ? 'HOLD' : 'DIRECT')),
});

export const env = EnvSchema.parse(rawEnv);
