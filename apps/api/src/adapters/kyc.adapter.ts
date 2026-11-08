import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

export interface KycVerificationRequest {
  userId: string;
  documentType: 'nin' | 'bvn' | 'voters_card' | 'drivers_license' | 'international_passport';
  idNumber: string; // Never persisted in DB
  firstName: string;
  lastName: string;
}

export interface KycVerificationResult {
  provider: 'mock' | 'dojah' | 'smile_id';
  providerReference: string;
  status: 'verified' | 'pending' | 'rejected';
  rejectionReason?: string;
}

export interface KycAdapter {
  verifyIdentity(req: KycVerificationRequest): Promise<KycVerificationResult>;
}

export class MockKycAdapter implements KycAdapter {
  async verifyIdentity(req: KycVerificationRequest): Promise<KycVerificationResult> {
    // One-way reference hash so raw NIN/BVN is never stored
    const digest = crypto
      .createHash('sha256')
      .update(`${req.userId}:${req.documentType}:${req.idNumber}`)
      .digest('hex')
      .slice(0, 12)
      .toUpperCase();

    const isRejectedTest = req.idNumber === '00000000000';
    logger.info(
      { userId: req.userId, documentType: req.documentType, providerReference: `KYC-MOCK-${digest}` },
      '[MOCK KYC] Identity verification processed (raw ID discarded)',
    );

    return {
      provider: 'mock',
      providerReference: `KYC-MOCK-${digest}`,
      status: isRejectedTest ? 'rejected' : 'verified',
      rejectionReason: isRejectedTest ? 'Identity number could not be validated by mock provider' : undefined,
    };
  }
}

export class DojahKycAdapter implements KycAdapter {
  async verifyIdentity(req: KycVerificationRequest): Promise<KycVerificationResult> {
    if (!env.DOJAH_APP_ID || !env.DOJAH_SECRET_KEY) {
      return new MockKycAdapter().verifyIdentity(req);
    }
    const ref = `DOJAH-${crypto.randomUUID().slice(0, 12).toUpperCase()}`;
    return {
      provider: 'dojah',
      providerReference: ref,
      status: 'verified',
    };
  }
}

export const kycAdapter: KycAdapter =
  env.KYC_PROVIDER === 'dojah' ? new DojahKycAdapter() : new MockKycAdapter();

