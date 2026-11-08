export interface BidIncrementBand {
  upToKobo: number | null; // null means infinity
  incrementKobo: number;
}

export interface DepositTier {
  name: string;
  depositKobo: number;
  maxBidKobo: number;
}

export const DEFAULT_BID_INCREMENT_TABLE: BidIncrementBand[] = [
  { upToKobo: 100_000_000, incrementKobo: 1_000_000 }, // Under N1m -> N10k
  { upToKobo: 300_000_000, incrementKobo: 2_500_000 }, // N1m to N3m -> N25k
  { upToKobo: 1_000_000_000, incrementKobo: 5_000_000 }, // N3m to N10m -> N50k
  { upToKobo: null, incrementKobo: 10_000_000 }, // Above N10m -> N100k
];

export const DEFAULT_PLATFORM_CONFIG = {
  bidIncrements: DEFAULT_BID_INCREMENT_TABLE,
  depositMultiplier: 50, // N100,000 deposit unlocks N5,000,000 bidding power
  minDepositKobo: 10_000_000, // N100,000 minimum refundable bidding deposit
  newAccountMaxBidKobo: 500_000_000, // N5,000,000 cap for accounts < 24h old
  softCloseWindowMs: 2 * 60 * 1000, // 2 minutes
  maxTotalExtensionMs: 30 * 60 * 1000, // 30 minutes cap past originalEndsAt
  settlementWindowHours: 72,
  sellerSuccessFeePercent: 2.5,
  sellerSuccessFeeCapKobo: 25_000_000, // N250,000 cap
  buyerDefaultForfeitPercent: 50,
  maxStrikesBeforeBan: 3,
  listingExpiryDays: 60,
  listingRenewalReminderDays: 5,
  autoHideReportsThreshold: 3,
  settlementMode: 'DIRECT' as 'DIRECT' | 'HOLD',
  promotions: {
    top_ad: { label: 'Top Ad (7 Days)', durationDays: 7, priceKobo: 1_500_000 }, // N15,000
    featured: { label: 'Featured Carousel (7 Days)', durationDays: 7, priceKobo: 2_500_000 }, // N25,000
    urgent: { label: 'Urgent Badge (14 Days)', durationDays: 14, priceKobo: 750_000 }, // N7,500
    bump_up: { label: 'Instant Bump to Top', durationDays: 1, priceKobo: 350_000 }, // N3,500
  },
  dealerPlans: {
    starter: { label: 'Starter Lot', monthlyPriceKobo: 2_500_000, listingLimit: 15 },
    pro: { label: 'Berger / Lekki Pro Dealer', monthlyPriceKobo: 6_500_000, listingLimit: 60 },
    premier: { label: 'Premier Auto Syndicate', monthlyPriceKobo: 15_000_000, listingLimit: 250 },
  },
  bannedWords: [
    'western union',
    'bitcoin only',
    'pay before inspection',
    'customs auctionazawa',
    'send transport fare',
    'delivery fee first',
  ],
};

export const NIGERIA_STATES_LGAS: Record<string, string[]> = {
  Lagos: ['Ikeja', 'Lekki', 'Victoria Island', 'Surulere', 'Ojodu Berger', 'Ajah', 'Ikoyi', 'Yaba', 'Festac', 'Alimosho'],
  Abuja: ['Maitama', 'Wuse', 'Garki', 'Gwarinpa', 'Jabi', 'Asokoro', 'Kubwa', 'Lugbe', 'Utako'],
  Rivers: ['Port Harcourt', 'Obio-Akpor', 'Eleme', 'Bonny', 'Oyigbo'],
  Kano: ['Kano Municipal', 'Nassarawa', 'Fagge', 'Tarauni', 'Gwale'],
  Oyo: ['Ibadan North', 'Ibadan South-West', 'Challenge', 'Bodija', 'Ogbomosho'],
  Enugu: ['Enugu North', 'Enugu South', 'Nsukka', 'Independence Layout', 'GRA'],
  Delta: ['Warri South', 'Asaba', 'Uvwie', 'Sapele'],
  Edo: ['Benin City', 'Oredo', 'Egor', 'Ikpoba Okha'],
  Kaduna: ['Kaduna North', 'Kaduna South', 'Zaria', 'Barnawa'],
  Anambra: ['Awka', 'Onitsha', 'Nnewi'],
  Ogun: ['Abeokuta', 'Sagamu', 'Ota', 'Mowe'],
};

export const VEHICLE_CATALOG = [
  {
    make: 'Toyota',
    synonyms: ['toyota', 'camry muscle', 'big daddy', 'pencil light', 'evil spirit', 'spider'],
    models: ['Camry', 'Corolla', 'Highlander', 'RAV4', 'Hilux', 'Sienna', 'Hiace', 'Land Cruiser', 'Prado', 'Venza', 'Avalon', 'Matrix'],
  },
  {
    make: 'Honda',
    synonyms: ['honda', 'end of discussion', 'discussion continues', 'baby boy', 'anaconda', 'evil forest'],
    models: ['Accord', 'Civic', 'CR-V', 'Pilot', 'Crosstour', 'Odyssey', 'City'],
  },
  {
    make: 'Lexus',
    synonyms: ['lexus', 'rx350', 'gx460', 'is250', 'es350'],
    models: ['RX 350', 'ES 350', 'GX 460', 'IS 250', 'LX 570', 'NX 200t', 'RX 330'],
  },
  {
    make: 'Mercedes-Benz',
    synonyms: ['benz', 'mercedes', 'ml350', 'gle', 'c300', 'glk', 'boot'],
    models: ['C300', 'GLK 350', 'E350', 'GLE 350', 'ML 350', 'CLA 250', 'GLC 300', 'G63 AMG', 'S550'],
  },
  {
    make: 'Hyundai',
    synonyms: ['hyundai'],
    models: ['Elantra', 'Sonata', 'Tucson', 'Santa Fe', 'Accent', 'Creta'],
  },
  {
    make: 'Kia',
    synonyms: ['kia'],
    models: ['Rio', 'Cerato', 'Optima', 'Sportage', 'Sorento', 'Picanto'],
  },
  {
    make: 'Ford',
    synonyms: ['ford'],
    models: ['Edge', 'Explorer', 'Escape', 'F-150', 'Focus', 'Mustang', 'Ranger'],
  },
  {
    make: 'Nissan',
    synonyms: ['nissan', 'infiniti'],
    models: ['Altima', 'Maxima', 'Pathfinder', 'Rogue', 'Murano', 'Sentra', 'Almera'],
  },
  {
    make: 'Peugeot',
    synonyms: ['peugeot', 'lion'],
    models: ['406', '307', '407', '508', '3008', '504'],
  },
  {
    make: 'Volkswagen',
    synonyms: ['vw', 'volks', 'golf'],
    models: ['Golf', 'Passat', 'Jetta', 'Tiguan', 'Touareg'],
  },
  {
    make: 'Bajaj / TVS (Motorcycles)',
    synonyms: ['okada', 'boxer', 'tvs', 'bajaj', 'dispatch bike', 'qlink'],
    models: ['Bajaj Boxer BM100', 'Bajaj Boxer BM150', 'TVS HLX 125', 'Qlink XP 200', 'Haojue Elegant'],
  },
];

export const SAFE_INSPECTION_LOCATIONS: Record<string, string[]> = {
  Lagos: [
    'Ikeja City Mall (ICM) Car Park — Alausa, Ikeja (CCTV & Security)',
    'Circle Mall Open Lot — Jakande, Lekki Toll Gate',
    'Berger Auto Mart Main Gate — Ojodu Berger',
    'Teslim Balogun Stadium Forecourt — Surulere',
  ],
  Abuja: [
    'Jabi Lake Mall Main Car Park — Bala Sokoto Way, Jabi',
    'Ceddi Plaza Forecourt — Central Business District',
    'Gwarinpa 3rd Avenue Total Filling Station Forecourt',
  ],
  Rivers: [
    'Port Harcourt Pleasure Park Main Parking — Aba Road',
    'SPAR Port Harcourt Mall Car Park — Garrison',
  ],
  Default: [
    'Nearest Major Shopping Mall Car Park (Daylight + CCTV)',
    'Busy Bank / Fuel Station Forecourt near Police Post',
  ],
};

