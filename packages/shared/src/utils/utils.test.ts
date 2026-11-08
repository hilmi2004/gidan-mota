import { describe, expect, it } from 'vitest';
import {
  formatKobo,
  getBidIncrementKobo,
  maskBidderName,
  maskPhone,
  nairaToKobo,
  normalizeNigerianPhone,
  validateVinFormat,
} from './index.js';

describe('@autodey/shared utilities', () => {
  it('formats integer kobo to NGN accurately without floating point drift', () => {
    expect(formatKobo(nairaToKobo(14_500_000))).toContain('14,500,000');
    expect(formatKobo(nairaToKobo(14_500_000), { compact: true })).toBe('₦14.5M');
  });

  it('returns correct bid increments across price bands in kobo', () => {
    expect(getBidIncrementKobo(nairaToKobo(500_000))).toBe(nairaToKobo(10_000));
    expect(getBidIncrementKobo(nairaToKobo(1_500_000))).toBe(nairaToKobo(25_000));
    expect(getBidIncrementKobo(nairaToKobo(5_000_000))).toBe(nairaToKobo(50_000));
    expect(getBidIncrementKobo(nairaToKobo(15_000_000))).toBe(nairaToKobo(100_000));
  });

  it('normalizes and masks Nigerian phone numbers', () => {
    expect(normalizeNigerianPhone('0803 123 4589')).toBe('+2348031234589');
    expect(maskPhone('08031234589')).toBe('+234803 *** **89');
  });

  it('masks bidder usernames as Ch***a', () => {
    expect(maskBidderName('Chinedu Okafor')).toBe('Ch***r');
    expect(maskBidderName('Chukwuma')).toBe('Ch***a');
  });

  it('validates 17-char ISO 3779 VIN and check digit', () => {
    const valid = validateVinFormat('1HGCM82633A004352');
    expect(valid.valid).toBe(true);
    expect(valid.checkDigitValid).toBe(true);

    const invalidChar = validateVinFormat('1HGCM82633A00435I');
    expect(invalidChar.valid).toBe(false);
  });
});

