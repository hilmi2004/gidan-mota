import { describe, expect, it } from 'vitest';
import { BRAND_CONFIG, formatKobo, nairaToKobo } from '@autodey/shared';

describe('@autodey/web design system & shared integration', () => {
  it('uses the centralized AutoDey brand config and integer kobo formatting', () => {
    expect(BRAND_CONFIG.name).toBe('AutoDey');
    expect(formatKobo(nairaToKobo(21_400_000))).toContain('21,400,000');
  });
});

