import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

export interface SubmitCustomsVerificationInput {
  listingId: string;
  sellerId: string;
  fileUrl: string;
  customsReferenceNumber?: string;
}

export interface SubmitCustomsVerificationResult {
  adapterReference: string;
  initialStatus: 'pending' | 'approved' | 'rejected';
  provider: 'manual_admin' | 'mock';
  notes: string;
}

/**
 * CustomsVerificationAdapter:
 * Per Section 3.1 of the AutoDey project brief, we do NOT assume any official public Nigeria Customs
 * API exists. `ManualAdminCustomsAdapter` is the working production default (`CUSTOMS_VERIFICATION_PROVIDER=manual_admin`),
 * placing uploaded customs duty papers into the human moderator queue. When a licensed third-party
 * or official customs verification integration becomes available, it can be dropped in behind this interface.
 */
export interface CustomsVerificationAdapter {
  submitCustomsDocument(
    input: SubmitCustomsVerificationInput,
  ): Promise<SubmitCustomsVerificationResult>;
}

export class ManualAdminCustomsAdapter implements CustomsVerificationAdapter {
  async submitCustomsDocument(
    input: SubmitCustomsVerificationInput,
  ): Promise<SubmitCustomsVerificationResult> {
    const adapterReference = `MAN_CUST_${crypto.randomBytes(5).toString('hex').toUpperCase()}`;
    logger.info(
      {
        listingId: input.listingId,
        customsReferenceNumber: input.customsReferenceNumber,
        adapterReference,
      },
      '[ManualAdminCustomsAdapter] Queued customs duty document for moderator review',
    );
    return {
      adapterReference,
      initialStatus: 'pending',
      provider: 'manual_admin',
      notes: 'Queued for human moderator inspection of Nigeria Customs Service duty papers.',
    };
  }
}

export class MockCustomsAdapter implements CustomsVerificationAdapter {
  async submitCustomsDocument(
    input: SubmitCustomsVerificationInput,
  ): Promise<SubmitCustomsVerificationResult> {
    const adapterReference = `MOCK_CUST_${crypto.randomBytes(5).toString('hex').toUpperCase()}`;
    const autoApprove = Boolean(
      input.customsReferenceNumber &&
        input.customsReferenceNumber.trim().toUpperCase().startsWith('NCS-AUTO'),
    );
    return {
      adapterReference,
      initialStatus: autoApprove ? 'approved' : 'pending',
      provider: 'mock',
      notes: autoApprove
        ? 'Mock auto-approved via NCS-AUTO test prefix'
        : 'Queued for moderator review',
    };
  }
}

export const customsVerificationAdapter: CustomsVerificationAdapter =
  env.CUSTOMS_VERIFICATION_PROVIDER === 'mock'
    ? new MockCustomsAdapter()
    : new ManualAdminCustomsAdapter();

