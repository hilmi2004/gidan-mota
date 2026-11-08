import { validateVinFormat } from '@autodey/shared';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

export interface DecodedVinInfo {
  vin: string;
  validFormat: boolean;
  checkDigitValid: boolean;
  make: string;
  model: string;
  year: number;
  bodyClass?: string;
  engineInfo?: string;
  provider: 'mock' | 'nhtsa';
}

export interface VinComparisonResult {
  decoded: DecodedVinInfo;
  mismatchFlag: boolean;
  mismatchReasons: string[];
}

export interface VinAdapter {
  decodeVin(vin: string): Promise<DecodedVinInfo>;
  compareWithListing(
    vin: string,
    sellerInput: { make?: string; model?: string; year?: number },
  ): Promise<VinComparisonResult>;
}

const VIN_YEAR_CODES: Record<string, number> = {
  A: 2010,
  B: 2011,
  C: 2012,
  D: 2013,
  E: 2014,
  F: 2015,
  G: 2016,
  H: 2017,
  J: 2018,
  K: 2019,
  L: 2020,
  M: 2021,
  N: 2022,
  P: 2023,
  R: 2024,
  S: 2025,
  T: 2026,
  '6': 2006,
  '7': 2007,
  '8': 2008,
  '9': 2009,
};

function inferMakeModelFromWmi(vin: string): { make: string; model: string; bodyClass: string } {
  const wmi3 = vin.slice(0, 3).toUpperCase();
  const wmi2 = vin.slice(0, 2).toUpperCase();

  if (['4T1', '2T1', 'JTD', 'JTE', 'JTM', '5TD', '5TF'].includes(wmi3) || wmi2 === 'JT') {
    const vds = vin.slice(3, 8).toUpperCase();
    if (vds.startsWith('BF') || vds.startsWith('B1')) {
      return { make: 'Toyota', model: 'Camry', bodyClass: 'Sedan/Saloon' };
    }
    if (vds.startsWith('BU') || vds.startsWith('BR')) {
      return { make: 'Toyota', model: 'Corolla', bodyClass: 'Sedan/Saloon' };
    }
    return { make: 'Toyota', model: 'Highlander', bodyClass: 'Sport Utility Vehicle (SUV)' };
  }

  if (['2T2', 'JTH', 'JTJ'].includes(wmi3)) {
    return { make: 'Lexus', model: 'RX 350', bodyClass: 'Sport Utility Vehicle (SUV)' };
  }

  if (['1HG', '2HG', 'JHM', '5J6', '5FN'].includes(wmi3)) {
    return { make: 'Honda', model: 'Accord', bodyClass: 'Sedan/Saloon' };
  }

  if (['WDD', 'WDB', 'WDC', '4JG'].includes(wmi3)) {
    return { make: 'Mercedes-Benz', model: 'C300', bodyClass: 'Sedan/Saloon' };
  }

  if (['KMH', '5NP', 'KM8'].includes(wmi3)) {
    return { make: 'Hyundai', model: 'Sonata', bodyClass: 'Sedan/Saloon' };
  }

  if (['KNA', 'KND', '5XX'].includes(wmi3)) {
    return { make: 'Kia', model: 'Sportage', bodyClass: 'Sport Utility Vehicle (SUV)' };
  }

  if (['1FA', '1FM', '1FT'].includes(wmi3)) {
    return { make: 'Ford', model: 'Explorer', bodyClass: 'Sport Utility Vehicle (SUV)' };
  }

  if (['1N4', 'JN1', 'JN8', '5N1'].includes(wmi3)) {
    return { make: 'Nissan', model: 'Altima', bodyClass: 'Sedan/Saloon' };
  }

  return { make: 'Toyota', model: 'Camry', bodyClass: 'Sedan/Saloon' };
}

export function compareDecodedVin(
  decoded: DecodedVinInfo,
  sellerInput: { make?: string; model?: string; year?: number },
): VinComparisonResult {
  const mismatchReasons: string[] = [];

  if (
    sellerInput.make &&
    decoded.make &&
    sellerInput.make.trim().toLowerCase() !== decoded.make.trim().toLowerCase()
  ) {
    mismatchReasons.push(
      `VIN make (${decoded.make}) does not match declared make (${sellerInput.make})`,
    );
  }

  if (
    typeof sellerInput.year === 'number' &&
    decoded.year &&
    Math.abs(sellerInput.year - decoded.year) > 1
  ) {
    mismatchReasons.push(
      `VIN model year (${decoded.year}) does not match declared year (${sellerInput.year})`,
    );
  }

  if (
    sellerInput.model &&
    decoded.model &&
    !decoded.model.toLowerCase().includes(sellerInput.model.trim().toLowerCase()) &&
    !sellerInput.model.trim().toLowerCase().includes(decoded.model.toLowerCase())
  ) {
    mismatchReasons.push(
      `VIN model (${decoded.model}) differs from declared model (${sellerInput.model})`,
    );
  }

  return {
    decoded,
    mismatchFlag: mismatchReasons.length > 0,
    mismatchReasons,
  };
}

export class MockVinAdapter implements VinAdapter {
  async decodeVin(rawVin: string): Promise<DecodedVinInfo> {
    const normalized = rawVin.trim().toUpperCase();
    const validation = validateVinFormat(normalized);
    const yearChar = normalized[9] ?? 'J';
    const inferredYear = VIN_YEAR_CODES[yearChar] ?? 2018;
    const { make, model, bodyClass } = inferMakeModelFromWmi(normalized);

    return {
      vin: normalized,
      validFormat: validation.valid,
      checkDigitValid: validation.checkDigitValid,
      make,
      model,
      year: inferredYear,
      bodyClass,
      engineInfo: '2.5L L4 DOHC 16V',
      provider: 'mock',
    };
  }

  async compareWithListing(
    vin: string,
    sellerInput: { make?: string; model?: string; year?: number },
  ): Promise<VinComparisonResult> {
    const decoded = await this.decodeVin(vin);
    return compareDecodedVin(decoded, sellerInput);
  }
}

export class NhtsaVinAdapter implements VinAdapter {
  private fallback = new MockVinAdapter();

  async decodeVin(rawVin: string): Promise<DecodedVinInfo> {
    const normalized = rawVin.trim().toUpperCase();
    const validation = validateVinFormat(normalized);
    try {
      const url = `${env.NHTSA_VPIC_BASE_URL}/DecodeVinValues/${encodeURIComponent(
        normalized,
      )}?format=json`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`NHTSA HTTP ${response.status}`);
      }
      const data = (await response.json()) as {
        Results?: Array<{
          Make?: string;
          Model?: string;
          ModelYear?: string;
          BodyClass?: string;
          DisplacementL?: string;
          EngineCylinders?: string;
        }>;
      };
      const row = data.Results?.[0];
      if (!row || !row.Make) {
        return this.fallback.decodeVin(normalized);
      }

      return {
        vin: normalized,
        validFormat: validation.valid,
        checkDigitValid: validation.checkDigitValid,
        make: row.Make,
        model: row.Model || 'Unknown',
        year: Number(row.ModelYear) || 2018,
        bodyClass: row.BodyClass,
        engineInfo: row.DisplacementL ? `${row.DisplacementL}L` : undefined,
        provider: 'nhtsa',
      };
    } catch (err) {
      logger.warn({ err, vin: normalized }, 'NHTSA vPIC unreachable; falling back to local decoder');
      return this.fallback.decodeVin(normalized);
    }
  }

  async compareWithListing(
    vin: string,
    sellerInput: { make?: string; model?: string; year?: number },
  ): Promise<VinComparisonResult> {
    const decoded = await this.decodeVin(vin);
    return compareDecodedVin(decoded, sellerInput);
  }
}

export const vinAdapter: VinAdapter =
  env.VIN_PROVIDER === 'nhtsa' ? new NhtsaVinAdapter() : new MockVinAdapter();

