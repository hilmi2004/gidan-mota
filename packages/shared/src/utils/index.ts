import { DEFAULT_BID_INCREMENT_TABLE, type BidIncrementBand } from '../constants/platform.js';

/**
 * Formats integer kobo into Nigerian Naira string with thousands separators.
 * Example: 1450000000 -> "₦14,500,000"
 */
export function formatKobo(
  kobo: number,
  options?: { compact?: boolean; showKobo?: boolean },
): string {
  if (!Number.isFinite(kobo)) return '₦0';
  const naira = Math.round(kobo) / 100;

  if (options?.compact) {
    if (Math.abs(naira) >= 1_000_000_000) {
      return `₦${(naira / 1_000_000_000).toFixed(1).replace(/\.0$/, '')}B`;
    }
    if (Math.abs(naira) >= 1_000_000) {
      return `₦${(naira / 1_000_000).toFixed(2).replace(/\.?0+$/, '')}M`;
    }
    if (Math.abs(naira) >= 1_000) {
      return `₦${(naira / 1_000).toFixed(0)}k`;
    }
  }

  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: options?.showKobo ? 2 : 0,
    maximumFractionDigits: options?.showKobo ? 2 : 0,
  }).format(naira);
}

/**
 * Converts integer Naira into integer kobo safely.
 */
export function nairaToKobo(naira: number): number {
  return Math.round(naira * 100);
}

/**
 * Converts integer kobo into Naira.
 */
export function koboToNaira(kobo: number): number {
  return Math.round(kobo / 100);
}

/**
 * Returns the bid increment in kobo for a given current price in kobo.
 *Under N1m: N10k, N1m to N3m: N25k, N3m to N10m: N50k, above: N100k.
 */
export function getBidIncrementKobo(
  currentPriceKobo: number,
  bands: BidIncrementBand[] = DEFAULT_BID_INCREMENT_TABLE,
): number {
  for (const band of bands) {
    if (band.upToKobo === null || currentPriceKobo < band.upToKobo) {
      return band.incrementKobo;
    }
  }
  return 10_000_000; // N100k fallback
}

/**
 * Normalizes Nigerian phone numbers into E.164 (+234XXXXXXXXXX).
 */
export function normalizeNigerianPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('234') && digits.length === 13) {
    return `+${digits}`;
  }
  if (digits.startsWith('0') && digits.length === 11) {
    return `+234${digits.slice(1)}`;
  }
  if (digits.length === 10 && /^[789][01]\d{8}$/.test(digits)) {
    return `+234${digits}`;
  }
  return raw.trim();
}

/**
 * Masks a phone number for public display (e.g. "+234 803 *** **89").
 */
export function maskPhone(phone: string): string {
  const normalized = normalizeNigerianPhone(phone);
  if (normalized.length < 10) return '080* *** ****';
  const prefix = normalized.slice(0, 7);
  const suffix = normalized.slice(-2);
  return `${prefix} *** **${suffix}`;
}

/**
 * Masks a bidder's display name for public bid history: "Chinedu Okafor" -> "Ch***a"
 */
export function maskBidderName(name: string): string {
  const cleaned = name.trim().replace(/\s+/g, '');
  if (cleaned.length <= 2) return `${cleaned[0] ?? 'B'}***`;
  const start = cleaned.slice(0, 2);
  const end = cleaned.slice(-1);
  return `${start}***${end}`;
}

/**
 * Validates a 17-character ISO 3779 VIN format and check digit (position 9).
 */
export function validateVinFormat(vin: string): {
  valid: boolean;
  normalized: string;
  checkDigitValid: boolean;
  reason?: string;
} {
  const normalized = vin.trim().toUpperCase();
  if (normalized.length !== 17) {
    return {
      valid: false,
      normalized,
      checkDigitValid: false,
      reason: 'VIN must be exactly 17 characters.',
    };
  }
  if (/[IOQ]/.test(normalized)) {
    return {
      valid: false,
      normalized,
      checkDigitValid: false,
      reason: 'VIN cannot contain the letters I, O, or Q.',
    };
  }
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(normalized)) {
    return {
      valid: false,
      normalized,
      checkDigitValid: false,
      reason: 'VIN contains invalid characters.',
    };
  }

  const transliteration: Record<string, number> = {
    A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8,
    J: 1, K: 2, L: 3, M: 4, N: 5, P: 7, R: 9,
    S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9,
    '0': 0, '1': 1, '2': 2, '3': 3, '4': 4,
    '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
  };
  const weights = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];

  let sum = 0;
  for (let i = 0; i < 17; i++) {
    const ch = normalized[i]!;
    const val = transliteration[ch] ?? 0;
    const weight = weights[i] ?? 0;
    sum += val * weight;
  }
  const remainder = sum % 11;
  const expectedCheck = remainder === 10 ? 'X' : String(remainder);
  const actualCheck = normalized[8];

  return {
    valid: true,
    normalized,
    checkDigitValid: actualCheck === expectedCheck,
  };
}

