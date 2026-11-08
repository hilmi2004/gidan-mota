/**
 * Single source of truth for the platform brand name and identity.
 * Rename `BRAND_NAME` here to update the entire web client, API, watermarks, and notifications.
 */
export const BRAND_NAME = 'Gidan Mota' as const;

export const BRAND_CONFIG = {
  name: BRAND_NAME,
  tagline: 'House of Verified Nigerian Cars & Live Timed Auctions',
  domain: 'gidanmota.ng',
  supportEmail: 'support@gidanmota.ng',
  supportPhone: '+234 800 GIDANMOTA',
  currencyCode: 'NGN',
  currencySymbol: '₦',
  countryCode: 'NG',
  defaultLocale: 'en-NG',
} as const;
