import { BRAND_CONFIG } from '@autodey/shared';
import { emailAdapter, smsAdapter } from '../../adapters/index.js';
import { NotificationModel, UserModel } from '../../models/index.js';

export type NotificationTemplateKey =
  | 'new_message'
  | 'offer_received'
  | 'offer_responded'
  | 'inspection_proposed'
  | 'outbid'
  | 'auction_won'
  | 'settlement_reminder'
  | 'listing_reported';

const CRITICAL_SMS_TYPES = new Set<NotificationTemplateKey>([
  'outbid',
  'auction_won',
  'settlement_reminder',
]);

export async function dispatchNotification(params: {
  userId: string;
  type: NotificationTemplateKey;
  title: string;
  body: string;
  actionUrl?: string;
}): Promise<void> {
  const user = await UserModel.findById(params.userId).lean();
  if (!user || user.deletedAt) return;

  // 1. In-app notification center
  if (user.notificationPrefs?.inApp !== false) {
    await NotificationModel.create({
      userId: user._id,
      type: params.type,
      title: params.title,
      body: params.body,
      actionUrl: params.actionUrl,
    });
  }

  // 2. Email notification
  if (user.email && user.notificationPrefs?.email !== false) {
    await emailAdapter.sendEmail({
      to: user.email,
      subject: `[${BRAND_CONFIG.name}] ${params.title}`,
      html: `<div style="font-family:Poppins,sans-serif;color:#0F1419;">
        <h2>${params.title}</h2>
        <p>${params.body}</p>
      </div>`,
    });
  }

  // 3. Critical SMS only (outbid, auction won, settlement reminder)
  if (CRITICAL_SMS_TYPES.has(params.type) && user.notificationPrefs?.sms !== false) {
    await smsAdapter.sendTransactional(user.phone, `${BRAND_CONFIG.name}: ${params.title} - ${params.body}`);
  }
}

