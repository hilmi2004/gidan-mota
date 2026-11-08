import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

export interface SmsSendResult {
  messageId: string;
  provider: 'mock' | 'termii';
  delivered: boolean;
}

export interface SmsAdapter {
  sendOtp(phone: string, code: string): Promise<SmsSendResult>;
  sendTransactional(phone: string, message: string): Promise<SmsSendResult>;
}

const lastSentOtpByPhone = new Map<string, { code: string; sentAt: Date }>();

export function getLastMockOtp(phone: string): string | undefined {
  return lastSentOtpByPhone.get(phone)?.code;
}

export class MockSmsAdapter implements SmsAdapter {
  async sendOtp(phone: string, code: string): Promise<SmsSendResult> {
    lastSentOtpByPhone.set(phone, { code, sentAt: new Date() });
    logger.info({ phone, code, provider: 'mock' }, `[MOCK SMS OTP] Sent 6-digit OTP to ${phone}: ${code}`);
    return {
      messageId: `mock-sms-${Date.now()}`,
      provider: 'mock',
      delivered: true,
    };
  }

  async sendTransactional(phone: string, message: string): Promise<SmsSendResult> {
    logger.info({ phone, message, provider: 'mock' }, `[MOCK SMS] To ${phone}: ${message}`);
    return {
      messageId: `mock-tx-sms-${Date.now()}`,
      provider: 'mock',
      delivered: true,
    };
  }
}

export class TermiiSmsAdapter implements SmsAdapter {
  async sendOtp(phone: string, code: string): Promise<SmsSendResult> {
    const message = `Your ${env.BRAND_NAME} verification code is ${code}. Valid for 5 minutes. Never share this code with anyone.`;
    return this.sendTransactional(phone, message);
  }

  async sendTransactional(phone: string, message: string): Promise<SmsSendResult> {
    if (!env.TERMII_API_KEY) {
      logger.warn('TERMII_API_KEY missing; falling back to MockSmsAdapter');
      return new MockSmsAdapter().sendTransactional(phone, message);
    }

    const res = await fetch('https://api.ng.termii.com/api/sms/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: phone.replace(/^\+/, ''),
        from: env.TERMII_SENDER_ID,
        sms: message,
        type: 'plain',
        channel: 'dnd',
        api_key: env.TERMII_API_KEY,
      }),
    });

    const data = (await res.json()) as { message_id?: string };
    return {
      messageId: data.message_id ?? `termii-${Date.now()}`,
      provider: 'termii',
      delivered: res.ok,
    };
  }
}

export const smsAdapter: SmsAdapter =
  env.SMS_PROVIDER === 'termii' ? new TermiiSmsAdapter() : new MockSmsAdapter();

