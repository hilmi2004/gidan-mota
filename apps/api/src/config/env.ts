import dotenv from 'dotenv';
import { z } from 'zod';
import { BRAND_NAME } from '@autodey/shared';

dotenv.config({ path: '../../.env' });
dotenv.config();

const EnvSchema = z.object({
  BRAND_NAME: z.string().default(BRAND_NAME),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(4000),
  WEB_URL: z.string().default('http://localhost:5173'),
  API_URL: z.string().default('http://localhost:4000'),
  MONGODB_URI: z.string().default('mongodb://127.0.0.1:27017/autodey'),
  REDIS_URL: z.string().default('redis://127.0.0.1:6379'),
  USE_LOCAL_EMBEDDED_INFRA: z
    .string()
    .optional()
    .default('true')
    .transform((v) => v === 'true' || v === '1'),
  JWT_ACCESS_SECRET: z.string().min(16).default('autodey-dev-access-secret-key-2026-ng'),
  JWT_REFRESH_SECRET: z.string().min(16).default('autodey-dev-refresh-secret-key-2026-ng'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_DAYS: z.coerce.number().int().default(30),
  SMS_PROVIDER: z.enum(['mock', 'termii']).default('mock'),
  TERMII_API_KEY: z.string().optional().default(''),
  TERMII_SENDER_ID: z.string().default(BRAND_NAME),
  KYC_PROVIDER: z.enum(['mock', 'dojah', 'smile_id']).default('mock'),
  DOJAH_APP_ID: z.string().optional().default(''),
  DOJAH_SECRET_KEY: z.string().optional().default(''),
  CUSTOMS_VERIFICATION_PROVIDER: z.enum(['manual_admin', 'mock']).default('manual_admin'),
  MEDIA_PROVIDER: z.enum(['mock', 'cloudinary']).default('mock'),
  CLOUDINARY_CLOUD_NAME: z.string().optional().default(''),
  CLOUDINARY_API_KEY: z.string().optional().default(''),
  CLOUDINARY_API_SECRET: z.string().optional().default(''),
  PAYMENT_PROVIDER: z.enum(['mock', 'paystack']).default('mock'),
  PAYSTACK_SECRET_KEY: z.string().optional().default(''),
  PAYSTACK_PUBLIC_KEY: z.string().optional().default(''),
  PAYSTACK_WEBHOOK_SECRET: z.string().optional().default(''),
  EMAIL_PROVIDER: z.enum(['mock', 'resend']).default('mock'),
  RESEND_API_KEY: z.string().optional().default(''),
  EMAIL_FROM: z.string().default('no-reply@autodey.ng'),
  VIN_PROVIDER: z.enum(['mock', 'nhtsa']).default('mock'),
  NHTSA_VPIC_BASE_URL: z.string().default('https://vpic.nhtsa.dot.gov/api/vehicles'),
  SETTLEMENT_MODE: z.enum(['DIRECT', 'HOLD']).default('DIRECT'),
});

export const env = EnvSchema.parse(process.env);

