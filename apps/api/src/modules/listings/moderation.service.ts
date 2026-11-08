import { DEFAULT_PLATFORM_CONFIG, validateVinFormat } from '@autodey/shared';
import { ListingMediaModel, ListingModel } from '../../models/index.js';

export interface AutoModerationResult {
  approvedAutomatically: boolean;
  status: 'active' | 'pending_review';
  flags: string[];
  vinChecked: boolean;
}

export interface FairPriceInsight {
  available: boolean;
  comparableCount: number;
  medianPriceKobo: number | null;
  minPriceKobo: number | null;
  maxPriceKobo: number | null;
  verdict: 'below_market' | 'fair_price' | 'above_market' | 'insufficient_data';
  deltaPercent: number | null;
}

export async function computeFairPriceInsight(params: {
  make: string;
  model: string;
  year: number;
  priceKobo: number;
  excludeListingId?: string;
}): Promise<FairPriceInsight> {
  const filter: Record<string, unknown> = {
    status: 'active',
    make: new RegExp(`^${params.make.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
    model: new RegExp(`^${params.model.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
    year: { $gte: params.year - 2, $lte: params.year + 2 },
  };
  if (params.excludeListingId) {
    filter._id = { $ne: params.excludeListingId };
  }

  const comparables = await ListingModel.find(filter)
    .select('priceKobo')
    .sort({ priceKobo: 1 })
    .limit(100)
    .lean();

  // Section 3.3: Only show when at least 5 comparable listings exist
  if (comparables.length < 5) {
    return {
      available: false,
      comparableCount: comparables.length,
      medianPriceKobo: null,
      minPriceKobo: null,
      maxPriceKobo: null,
      verdict: 'insufficient_data',
      deltaPercent: null,
    };
  }

  const prices = comparables.map((c) => c.priceKobo).sort((a, b) => a - b);
  const mid = Math.floor(prices.length / 2);
  const medianPriceKobo =
    prices.length % 2 === 0
      ? Math.round(((prices[mid - 1] ?? 0) + (prices[mid] ?? 0)) / 2)
      : (prices[mid] ?? 0);

  const minPriceKobo = prices[0] ?? medianPriceKobo;
  const maxPriceKobo = prices[prices.length - 1] ?? medianPriceKobo;
  const deltaPercent =
    medianPriceKobo > 0
      ? Math.round(((params.priceKobo - medianPriceKobo) / medianPriceKobo) * 100)
      : 0;

  let verdict: FairPriceInsight['verdict'] = 'fair_price';
  if (deltaPercent <= -10) {
    verdict = 'below_market';
  } else if (deltaPercent >= 12) {
    verdict = 'above_market';
  }

  return {
    available: true,
    comparableCount: comparables.length,
    medianPriceKobo,
    minPriceKobo,
    maxPriceKobo,
    verdict,
    deltaPercent,
  };
}

export async function evaluateListingAutoModeration(input: {
  sellerId: string;
  make: string;
  model: string;
  year: number;
  priceKobo: number;
  description: string;
  vin?: string;
  perceptualHashes?: string[];
  excludeListingId?: string;
}): Promise<AutoModerationResult> {
  const flags: string[] = [];
  const lowerDesc = input.description.toLowerCase();

  // 1. Banned words check
  for (const word of DEFAULT_PLATFORM_CONFIG.bannedWords) {
    if (lowerDesc.includes(word.toLowerCase())) {
      flags.push(`BANNED_PHRASE:${word}`);
    }
  }

  // 2. Phone number or external link in description
  if (/(?:\+?234|0)[789][01]\d[\d\s-]{7,10}/.test(input.description)) {
    flags.push('PHONE_IN_DESCRIPTION');
  }
  if (/https?:\/\/|www\./i.test(input.description)) {
    flags.push('EXTERNAL_LINK_IN_DESCRIPTION');
  }

  // 3. VIN format & duplicate active VIN check
  let vinChecked = false;
  if (input.vin && input.vin.trim().length > 0) {
    const vinCheck = validateVinFormat(input.vin);
    if (!vinCheck.valid) {
      flags.push(`INVALID_VIN_FORMAT:${vinCheck.reason}`);
    } else {
      vinChecked = true;
      if (!vinCheck.checkDigitValid) {
        flags.push('VIN_CHECK_DIGIT_WARNING');
      }
      const dupQuery: Record<string, unknown> = {
        vin: vinCheck.normalized,
        status: { $in: ['pending_review', 'active'] },
      };
      if (input.excludeListingId) {
        dupQuery._id = { $ne: input.excludeListingId };
      }
      const existingVin = await ListingModel.findOne(dupQuery).lean();
      if (existingVin) {
        flags.push('DUPLICATE_ACTIVE_VIN');
      }
    }
  }

  // 4. Duplicate perceptual image hash check across other sellers
  const validHashes = (input.perceptualHashes ?? []).filter((h) => h && h.length >= 8);
  if (validHashes.length > 0) {
    const dupMedia = await ListingMediaModel.findOne({
      perceptualHash: { $in: validHashes },
      sellerId: { $ne: input.sellerId },
    }).lean();
    if (dupMedia) {
      flags.push('DUPLICATE_IMAGE_HASH');
    }
  }

  // 5. Comparable price anomaly check
  const insight = await computeFairPriceInsight({
    make: input.make,
    model: input.model,
    year: input.year,
    priceKobo: input.priceKobo,
    excludeListingId: input.excludeListingId,
  });
  if (insight.available && insight.medianPriceKobo) {
    const ratio = input.priceKobo / insight.medianPriceKobo;
    if (ratio < 0.35 || ratio > 2.6) {
      flags.push('PRICE_ANOMALY_VS_MEDIAN');
    }
  }

  const approvedAutomatically = flags.length === 0;
  return {
    approvedAutomatically,
    status: approvedAutomatically ? 'active' : 'pending_review',
    flags,
    vinChecked,
  };
}

