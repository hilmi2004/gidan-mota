import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

export interface InitializePaymentInput {
  email: string;
  amountKobo: number;
  reference: string;
  callbackUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface InitializePaymentResult {
  authorizationUrl: string;
  accessCode: string;
  reference: string;
  provider: 'mock' | 'paystack';
}

export interface RefundPaymentResult {
  refundReference: string;
  status: 'processed' | 'pending';
}

export interface PaymentAdapter {
  initializeTransaction(input: InitializePaymentInput): Promise<InitializePaymentResult>;
  verifyWebhookSignature(rawBody: string, signatureHeader?: string): boolean;
  refundTransaction(reference: string, amountKobo?: number): Promise<RefundPaymentResult>;
}

export class MockPaystackAdapter implements PaymentAdapter {
  async initializeTransaction(input: InitializePaymentInput): Promise<InitializePaymentResult> {
    const accessCode = `MOCK_ACC_${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
    const authorizationUrl = `${env.WEB_URL}/wallet?mock_reference=${encodeURIComponent(input.reference)}&amountKobo=${input.amountKobo}`;
    logger.info(
      { reference: input.reference, amountKobo: input.amountKobo, email: input.email },
      '[MockPaystackAdapter] Initialized transaction',
    );
    return {
      authorizationUrl,
      accessCode,
      reference: input.reference,
      provider: 'mock',
    };
  }

  verifyWebhookSignature(rawBody: string, signatureHeader?: string): boolean {
    if (!signatureHeader) return false;
    if (signatureHeader === 'mock-valid-signature') return true;
    const secret = env.PAYSTACK_WEBHOOK_SECRET || env.PAYSTACK_SECRET_KEY || 'mock-paystack-secret';
    const expected = crypto.createHmac('sha512', secret).update(rawBody).digest('hex');
    return expected === signatureHeader;
  }

  async refundTransaction(reference: string, amountKobo?: number): Promise<RefundPaymentResult> {
    const refundReference = `MOCK_RFD_${reference}_${Date.now()}`;
    logger.info(
      { reference, amountKobo, refundReference },
      '[MockPaystackAdapter] Processed refund for refundable bidding deposit',
    );
    return {
      refundReference,
      status: 'processed',
    };
  }
}

export class LivePaystackAdapter implements PaymentAdapter {
  async initializeTransaction(input: InitializePaymentInput): Promise<InitializePaymentResult> {
    if (!env.PAYSTACK_SECRET_KEY) {
      throw new Error('PAYSTACK_SECRET_KEY is required when PAYMENT_PROVIDER=paystack');
    }
    const response = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: input.email,
        amount: input.amountKobo, // Paystack natively expects integer kobo for NGN!
        reference: input.reference,
        callback_url: input.callbackUrl,
        metadata: input.metadata,
      }),
    });
    if (!response.ok) {
      throw new Error(`Paystack initialize failed with HTTP ${response.status}`);
    }
    const body = (await response.json()) as {
      status: boolean;
      data: { authorization_url: string; access_code: string; reference: string };
    };
    return {
      authorizationUrl: body.data.authorization_url,
      accessCode: body.data.access_code,
      reference: body.data.reference,
      provider: 'paystack',
    };
  }

  verifyWebhookSignature(rawBody: string, signatureHeader?: string): boolean {
    if (!signatureHeader) return false;
    const secret = env.PAYSTACK_WEBHOOK_SECRET || env.PAYSTACK_SECRET_KEY;
    if (!secret) return false;
    const expected = crypto.createHmac('sha512', secret).update(rawBody).digest('hex');
    return expected === signatureHeader;
  }

  async refundTransaction(reference: string, amountKobo?: number): Promise<RefundPaymentResult> {
    if (!env.PAYSTACK_SECRET_KEY) {
      throw new Error('PAYSTACK_SECRET_KEY is required when PAYMENT_PROVIDER=paystack');
    }
    const response = await fetch('https://api.paystack.co/refund', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        transaction: reference,
        ...(amountKobo ? { amount: amountKobo } : {}),
      }),
    });
    if (!response.ok) {
      throw new Error(`Paystack refund failed with HTTP ${response.status}`);
    }
    const body = (await response.json()) as {
      data?: { id?: number | string; status?: string };
    };
    return {
      refundReference: String(body.data?.id ?? `RFD_${reference}`),
      status: body.data?.status === 'processed' ? 'processed' : 'pending',
    };
  }
}

export const paymentAdapter: PaymentAdapter =
  env.PAYMENT_PROVIDER === 'paystack' ? new LivePaystackAdapter() : new MockPaystackAdapter();

