import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

export interface EmailSendRequest {
  to: string;
  subject: string;
  html: string;
}

export interface EmailSendResult {
  messageId: string;
  provider: 'mock' | 'resend';
  delivered: boolean;
}

export interface EmailAdapter {
  sendEmail(req: EmailSendRequest): Promise<EmailSendResult>;
}

export class MockEmailAdapter implements EmailAdapter {
  async sendEmail(req: EmailSendRequest): Promise<EmailSendResult> {
    logger.info({ to: req.to, subject: req.subject, provider: 'mock' }, '[MOCK EMAIL] Sent email');
    return {
      messageId: `mock-email-${Date.now()}`,
      provider: 'mock',
      delivered: true,
    };
  }
}

export class ResendEmailAdapter implements EmailAdapter {
  async sendEmail(req: EmailSendRequest): Promise<EmailSendResult> {
    if (!env.RESEND_API_KEY) {
      return new MockEmailAdapter().sendEmail(req);
    }
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM,
        to: [req.to],
        subject: req.subject,
        html: req.html,
      }),
    });
    const data = (await res.json()) as { id?: string };
    return {
      messageId: data.id ?? `resend-${Date.now()}`,
      provider: 'resend',
      delivered: res.ok,
    };
  }
}

export const emailAdapter: EmailAdapter =
  env.EMAIL_PROVIDER === 'resend' ? new ResendEmailAdapter() : new MockEmailAdapter();

