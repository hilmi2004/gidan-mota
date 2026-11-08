import {
  DEFAULT_PLATFORM_CONFIG,
  VEHICLE_CATALOG,
  maskBidderName,
  nairaToKobo,
} from '@autodey/shared';
import {
  AuctionModel,
  BidModel,
  ConfigEntryModel,
  ConversationModel,
  DealerProfileModel,
  ListingMediaModel,
  ListingModel,
  MessageModel,
  ReviewModel,
  SettlementModel,
  UserModel,
  VehicleDocumentModel,
  VehicleModel,
  WalletAccountModel,
  WalletTransactionModel,
} from '../models/index.js';
import { logger } from '../config/logger.js';

const CAR_PHOTOS = [
  'https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?w=1000&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1555215695-3004980ad54e?w=1000&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1563720223185-11003d516935?w=1000&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1559416523-140ddc3d238c?w=1000&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?w=1000&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=1000&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1590362891991-f776e747a588?w=1000&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=1000&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=1000&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1542362567-b07e54358753?w=1000&auto=format&fit=crop&q=80',
];

const GUIDED_ANGLES = [
  'front',
  'rear',
  'left',
  'right',
  'interior',
  'dashboard',
  'engine',
  'boot',
] as const;

interface RawSeedListing {
  category: 'cars' | 'suvs' | 'buses_vans' | 'trucks' | 'motorcycles';
  make: string;
  model: string;
  trim: string;
  year: number;
  condition: 'brand_new' | 'foreign_used' | 'nigerian_used';
  mileageKm: number;
  transmission: 'automatic' | 'manual' | 'cvt';
  fuelType: 'petrol' | 'diesel' | 'hybrid';
  bodyType: 'sedan' | 'suv' | 'hatchback' | 'pickup' | 'minivan' | 'bus' | 'motorcycle';
  exteriorColor: string;
  state: string;
  lga: string;
  priceNaira: number;
  negotiable: boolean;
  vinChecked: boolean;
  customsReviewed: boolean;
  inspected?: boolean;
  featured?: boolean;
  topAd?: boolean;
  urgent?: boolean;
}

const FORTY_NIGERIAN_LISTINGS: RawSeedListing[] = [
  // 1-6: Toyota Camry (comparable cluster for Fair Price Insight!)
  { category: 'cars', make: 'Toyota', model: 'Camry', trim: 'XSE V6', year: 2018, condition: 'foreign_used', mileageKm: 61200, transmission: 'automatic', fuelType: 'petrol', bodyType: 'sedan', exteriorColor: 'Pearl White', state: 'Lagos', lga: 'Lekki', priceNaira: 18_500_000, negotiable: true, vinChecked: true, customsReviewed: true, featured: true, topAd: true },
  { category: 'cars', make: 'Toyota', model: 'Camry', trim: 'SE', year: 2018, condition: 'foreign_used', mileageKm: 68400, transmission: 'automatic', fuelType: 'petrol', bodyType: 'sedan', exteriorColor: 'Cosmic Gray', state: 'Lagos', lga: 'Ojodu Berger', priceNaira: 17_200_000, negotiable: true, vinChecked: true, customsReviewed: true },
  { category: 'cars', make: 'Toyota', model: 'Camry', trim: 'LE', year: 2017, condition: 'foreign_used', mileageKm: 74100, transmission: 'automatic', fuelType: 'petrol', bodyType: 'sedan', exteriorColor: 'Silver Metallic', state: 'Abuja', lga: 'Maitama', priceNaira: 15_800_000, negotiable: true, vinChecked: true, customsReviewed: true },
  { category: 'cars', make: 'Toyota', model: 'Camry', trim: 'XLE', year: 2019, condition: 'foreign_used', mileageKm: 52900, transmission: 'automatic', fuelType: 'petrol', bodyType: 'sedan', exteriorColor: 'Midnight Black', state: 'Lagos', lga: 'Victoria Island', priceNaira: 20_500_000, negotiable: true, vinChecked: true, customsReviewed: true },
  { category: 'cars', make: 'Toyota', model: 'Camry', trim: 'SE', year: 2016, condition: 'nigerian_used', mileageKm: 98500, transmission: 'automatic', fuelType: 'petrol', bodyType: 'sedan', exteriorColor: 'Ruby Flare', state: 'Rivers', lga: 'Port Harcourt', priceNaira: 12_900_000, negotiable: true, vinChecked: true, customsReviewed: false },
  { category: 'cars', make: 'Toyota', model: 'Camry', trim: 'XLE V6', year: 2017, condition: 'nigerian_used', mileageKm: 94000, transmission: 'automatic', fuelType: 'petrol', bodyType: 'sedan', exteriorColor: 'Gold', state: 'Oyo', lga: 'Ibadan North', priceNaira: 14_200_000, negotiable: true, vinChecked: true, customsReviewed: false, urgent: true },

  // 7-11: Toyota Corolla
  { category: 'cars', make: 'Toyota', model: 'Corolla', trim: 'LE Eco', year: 2017, condition: 'foreign_used', mileageKm: 63000, transmission: 'cvt', fuelType: 'petrol', bodyType: 'sedan', exteriorColor: 'Silver', state: 'Lagos', lga: 'Ikeja', priceNaira: 12_800_000, negotiable: true, vinChecked: true, customsReviewed: true, featured: true },
  { category: 'cars', make: 'Toyota', model: 'Corolla', trim: 'SE Sport', year: 2019, condition: 'foreign_used', mileageKm: 49200, transmission: 'automatic', fuelType: 'petrol', bodyType: 'sedan', exteriorColor: 'Blueprint Blue', state: 'Abuja', lga: 'Wuse', priceNaira: 15_600_000, negotiable: false, vinChecked: true, customsReviewed: true },
  { category: 'cars', make: 'Toyota', model: 'Corolla', trim: 'S', year: 2015, condition: 'nigerian_used', mileageKm: 112000, transmission: 'automatic', fuelType: 'petrol', bodyType: 'sedan', exteriorColor: 'Black', state: 'Lagos', lga: 'Surulere', priceNaira: 8_400_000, negotiable: true, vinChecked: true, customsReviewed: false },
  { category: 'cars', make: 'Toyota', model: 'Corolla', trim: 'LE', year: 2016, condition: 'foreign_used', mileageKm: 77800, transmission: 'automatic', fuelType: 'petrol', bodyType: 'sedan', exteriorColor: 'White', state: 'Enugu', lga: 'Independence Layout', priceNaira: 11_400_000, negotiable: true, vinChecked: true, customsReviewed: true },
  { category: 'cars', make: 'Toyota', model: 'Corolla', trim: 'CE', year: 2011, condition: 'nigerian_used', mileageKm: 145000, transmission: 'automatic', fuelType: 'petrol', bodyType: 'sedan', exteriorColor: 'Ash Gray', state: 'Kano', lga: 'Nassarawa', priceNaira: 5_900_000, negotiable: true, vinChecked: false, customsReviewed: false },

  // 12-15: Toyota Highlander & RAV4
  { category: 'suvs', make: 'Toyota', model: 'Highlander', trim: 'Limited Platinum AWD', year: 2019, condition: 'foreign_used', mileageKm: 56000, transmission: 'automatic', fuelType: 'petrol', bodyType: 'suv', exteriorColor: 'Blizzard Pearl', state: 'Lagos', lga: 'Lekki', priceNaira: 31_500_000, negotiable: true, vinChecked: true, customsReviewed: true, inspected: true, featured: true },
  { category: 'suvs', make: 'Toyota', model: 'Highlander', trim: 'XLE V6', year: 2016, condition: 'foreign_used', mileageKm: 81000, transmission: 'automatic', fuelType: 'petrol', bodyType: 'suv', exteriorColor: 'Celestial Silver', state: 'Abuja', lga: 'Gwarinpa', priceNaira: 22_000_000, negotiable: true, vinChecked: true, customsReviewed: true },
  { category: 'suvs', make: 'Toyota', model: 'RAV4', trim: 'Adventure AWD', year: 2020, condition: 'foreign_used', mileageKm: 44300, transmission: 'automatic', fuelType: 'petrol', bodyType: 'suv', exteriorColor: 'Lunar Rock', state: 'Lagos', lga: 'Ikoyi', priceNaira: 27_800_000, negotiable: false, vinChecked: true, customsReviewed: true },
  { category: 'suvs', make: 'Toyota', model: 'RAV4', trim: 'XLE', year: 2015, condition: 'nigerian_used', mileageKm: 104000, transmission: 'automatic', fuelType: 'petrol', bodyType: 'suv', exteriorColor: 'Magnetic Gray', state: 'Rivers', lga: 'Port Harcourt', priceNaira: 13_500_000, negotiable: true, vinChecked: true, customsReviewed: false },

  // 16-19: Honda Accord & CR-V
  { category: 'cars', make: 'Honda', model: 'Accord', trim: 'Sport 2.0T', year: 2018, condition: 'foreign_used', mileageKm: 58900, transmission: 'automatic', fuelType: 'petrol', bodyType: 'sedan', exteriorColor: 'Still Night Pearl', state: 'Abuja', lga: 'Wuse', priceNaira: 16_900_000, negotiable: true, vinChecked: true, customsReviewed: true, topAd: true },
  { category: 'cars', make: 'Honda', model: 'Accord', trim: 'EX-L V6', year: 2016, condition: 'foreign_used', mileageKm: 79500, transmission: 'automatic', fuelType: 'petrol', bodyType: 'sedan', exteriorColor: 'Crystal Black', state: 'Lagos', lga: 'Ojodu Berger', priceNaira: 11_800_000, negotiable: true, vinChecked: true, customsReviewed: true },
  { category: 'suvs', make: 'Honda', model: 'CR-V', trim: 'Touring AWD', year: 2018, condition: 'foreign_used', mileageKm: 62100, transmission: 'cvt', fuelType: 'petrol', bodyType: 'suv', exteriorColor: 'Modern Steel', state: 'Lagos', lga: 'Lekki', priceNaira: 19_400_000, negotiable: true, vinChecked: true, customsReviewed: true },
  { category: 'suvs', make: 'Honda', model: 'CR-V', trim: 'EX', year: 2014, condition: 'nigerian_used', mileageKm: 118000, transmission: 'automatic', fuelType: 'petrol', bodyType: 'suv', exteriorColor: 'Alabaster Silver', state: 'Enugu', lga: 'GRA', priceNaira: 9_800_000, negotiable: true, vinChecked: true, customsReviewed: false },

  // 20-23: Lexus RX 350 & ES 350 & GX 460
  { category: 'suvs', make: 'Lexus', model: 'RX 350', trim: 'F-Sport AWD', year: 2019, condition: 'foreign_used', mileageKm: 41800, transmission: 'automatic', fuelType: 'petrol', bodyType: 'suv', exteriorColor: 'Ultra White', state: 'Lagos', lga: 'Lekki', priceNaira: 29_400_000, negotiable: false, vinChecked: true, customsReviewed: true, inspected: true, featured: true },
  { category: 'suvs', make: 'Lexus', model: 'RX 350', trim: 'Base Navigation', year: 2016, condition: 'foreign_used', mileageKm: 71000, transmission: 'automatic', fuelType: 'petrol', bodyType: 'suv', exteriorColor: 'Obsidian Black', state: 'Abuja', lga: 'Maitama', priceNaira: 23_500_000, negotiable: true, vinChecked: true, customsReviewed: true },
  { category: 'cars', make: 'Lexus', model: 'ES 350', trim: 'Luxury Package', year: 2017, condition: 'foreign_used', mileageKm: 64000, transmission: 'automatic', fuelType: 'petrol', bodyType: 'sedan', exteriorColor: 'Atomic Silver', state: 'Lagos', lga: 'Ikeja', priceNaira: 18_900_000, negotiable: true, vinChecked: true, customsReviewed: true },
  { category: 'suvs', make: 'Lexus', model: 'GX 460', trim: 'Luxury V8 4WD', year: 2018, condition: 'foreign_used', mileageKm: 59000, transmission: 'automatic', fuelType: 'petrol', bodyType: 'suv', exteriorColor: 'Starfire Pearl', state: 'Abuja', lga: 'Asokoro', priceNaira: 42_000_000, negotiable: true, vinChecked: true, customsReviewed: true, inspected: true },

  // 24-28: Mercedes-Benz C300, GLK 350, GLE 350, E350
  { category: 'cars', make: 'Mercedes-Benz', model: 'C300', trim: 'AMG Line 4MATIC', year: 2019, condition: 'foreign_used', mileageKm: 49100, transmission: 'automatic', fuelType: 'petrol', bodyType: 'sedan', exteriorColor: 'Selenite Grey', state: 'Abuja', lga: 'Maitama', priceNaira: 24_500_000, negotiable: false, vinChecked: true, customsReviewed: true, inspected: true },
  { category: 'cars', make: 'Mercedes-Benz', model: 'C300', trim: 'Luxury', year: 2016, condition: 'foreign_used', mileageKm: 76000, transmission: 'automatic', fuelType: 'petrol', bodyType: 'sedan', exteriorColor: 'Polar White', state: 'Lagos', lga: 'Lekki', priceNaira: 17_600_000, negotiable: true, vinChecked: true, customsReviewed: true },
  { category: 'suvs', make: 'Mercedes-Benz', model: 'GLK 350', trim: '4MATIC V6', year: 2015, condition: 'foreign_used', mileageKm: 82500, transmission: 'automatic', fuelType: 'petrol', bodyType: 'suv', exteriorColor: 'Black', state: 'Lagos', lga: 'Ojodu Berger', priceNaira: 16_800_000, negotiable: true, vinChecked: true, customsReviewed: true },
  { category: 'suvs', make: 'Mercedes-Benz', model: 'GLE 350', trim: '4MATIC', year: 2017, condition: 'foreign_used', mileageKm: 68400, transmission: 'automatic', fuelType: 'petrol', bodyType: 'suv', exteriorColor: 'Iridium Silver', state: 'Rivers', lga: 'Port Harcourt', priceNaira: 25_200_000, negotiable: false, vinChecked: true, customsReviewed: true },
  { category: 'cars', make: 'Mercedes-Benz', model: 'E350', trim: 'Sport', year: 2014, condition: 'nigerian_used', mileageKm: 109000, transmission: 'automatic', fuelType: 'petrol', bodyType: 'sedan', exteriorColor: 'Obsidian Black', state: 'Lagos', lga: 'Surulere', priceNaira: 12_500_000, negotiable: true, vinChecked: true, customsReviewed: false },

  // 29-32: Hyundai Elantra, Kia Rio, Ford Edge, Nissan Altima
  { category: 'cars', make: 'Hyundai', model: 'Elantra', trim: 'SEL', year: 2018, condition: 'foreign_used', mileageKm: 65000, transmission: 'automatic', fuelType: 'petrol', bodyType: 'sedan', exteriorColor: 'Symphony Silver', state: 'Lagos', lga: 'Yaba', priceNaira: 10_200_000, negotiable: true, vinChecked: true, customsReviewed: true },
  { category: 'cars', make: 'Kia', model: 'Rio', trim: 'EX Hatchback', year: 2017, condition: 'nigerian_used', mileageKm: 89000, transmission: 'automatic', fuelType: 'petrol', bodyType: 'hatchback', exteriorColor: 'Signal Red', state: 'Oyo', lga: 'Bodija', priceNaira: 6_800_000, negotiable: true, vinChecked: false, customsReviewed: false },
  { category: 'suvs', make: 'Ford', model: 'Edge', trim: 'Titanium AWD', year: 2017, condition: 'foreign_used', mileageKm: 72000, transmission: 'automatic', fuelType: 'petrol', bodyType: 'suv', exteriorColor: 'Magnetic Metallic', state: 'Abuja', lga: 'Jabi', priceNaira: 14_200_000, negotiable: true, vinChecked: true, customsReviewed: true },
  { category: 'cars', make: 'Nissan', model: 'Altima', trim: '2.5 SR', year: 2016, condition: 'nigerian_used', mileageKm: 105000, transmission: 'cvt', fuelType: 'petrol', bodyType: 'sedan', exteriorColor: 'Pearl White', state: 'Kano', lga: 'Tarauni', priceNaira: 7_400_000, negotiable: true, vinChecked: true, customsReviewed: false },

  // 33-37: Peugeot 406, Toyota Hiace, Toyota Sienna, Toyota Hilux
  { category: 'cars', make: 'Peugeot', model: '406', trim: 'Prestige 2.0 Manual', year: 2004, condition: 'nigerian_used', mileageKm: 182000, transmission: 'manual', fuelType: 'petrol', bodyType: 'sedan', exteriorColor: 'Navy Blue', state: 'Kano', lga: 'Kano Municipal', priceNaira: 2_850_000, negotiable: true, vinChecked: false, customsReviewed: false, urgent: true },
  { category: 'buses_vans', make: 'Toyota', model: 'Hiace', trim: 'High Roof 18-Seater Hummer Bus', year: 2016, condition: 'foreign_used', mileageKm: 94000, transmission: 'manual', fuelType: 'petrol', bodyType: 'bus', exteriorColor: 'White', state: 'Lagos', lga: 'Alimosho', priceNaira: 21_500_000, negotiable: true, vinChecked: true, customsReviewed: true },
  { category: 'buses_vans', make: 'Toyota', model: 'Sienna', trim: 'XLE 8-Passenger', year: 2015, condition: 'foreign_used', mileageKm: 88000, transmission: 'automatic', fuelType: 'petrol', bodyType: 'minivan', exteriorColor: 'Silver Sky', state: 'Enugu', lga: 'Enugu North', priceNaira: 13_900_000, negotiable: true, vinChecked: true, customsReviewed: true },
  { category: 'trucks', make: 'Toyota', model: 'Hilux', trim: 'Adventure 4x4 Double Cab', year: 2020, condition: 'foreign_used', mileageKm: 52000, transmission: 'automatic', fuelType: 'diesel', bodyType: 'pickup', exteriorColor: 'Attitude Black', state: 'Abuja', lga: 'Maitama', priceNaira: 34_200_000, negotiable: false, vinChecked: true, customsReviewed: true, inspected: true },
  { category: 'buses_vans', make: 'Toyota', model: 'Sienna', trim: 'LE', year: 2012, condition: 'nigerian_used', mileageKm: 138000, transmission: 'automatic', fuelType: 'petrol', bodyType: 'minivan', exteriorColor: 'Champagne Gold', state: 'Oyo', lga: 'Challenge', priceNaira: 7_800_000, negotiable: true, vinChecked: false, customsReviewed: false },

  // 38-40: Okada-Friendly & Dispatch Motorcycles
  { category: 'motorcycles', make: 'Bajaj / TVS (Motorcycles)', model: 'Bajaj Boxer BM150', trim: 'Heavy Duty Dispatch', year: 2024, condition: 'brand_new', mileageKm: 40, transmission: 'manual', fuelType: 'petrol', bodyType: 'motorcycle', exteriorColor: 'Red', state: 'Lagos', lga: 'Ikeja', priceNaira: 1_350_000, negotiable: false, vinChecked: false, customsReviewed: true },
  { category: 'motorcycles', make: 'Bajaj / TVS (Motorcycles)', model: 'TVS HLX 125', trim: '5-Gear Commercial', year: 2023, condition: 'nigerian_used', mileageKm: 12400, transmission: 'manual', fuelType: 'petrol', bodyType: 'motorcycle', exteriorColor: 'Black & Blue', state: 'Oyo', lga: 'Ibadan North', priceNaira: 920_000, negotiable: true, vinChecked: false, customsReviewed: false },
  { category: 'motorcycles', make: 'Bajaj / TVS (Motorcycles)', model: 'Qlink XP 200', trim: 'Enduro Logistics', year: 2024, condition: 'brand_new', mileageKm: 15, transmission: 'manual', fuelType: 'petrol', bodyType: 'motorcycle', exteriorColor: 'Orange', state: 'Abuja', lga: 'Lugbe', priceNaira: 1_580_000, negotiable: true, vinChecked: false, customsReviewed: true },
];

// Generate valid-looking 17-character VINs without I, O, Q
function buildSeedVin(index: number): string {
  const prefix = '4T1BF1FK';
  const serial = String(10000000 + index).slice(-8);
  return `${prefix}X${serial}`;
}

export async function runSeed(): Promise<{
  usersCount: number;
  listingsCount: number;
  auctionsCount: number;
}> {
  await Promise.all([
    UserModel.deleteMany({}),
    DealerProfileModel.deleteMany({}),
    VehicleModel.deleteMany({}),
    ListingModel.deleteMany({}),
    ListingMediaModel.deleteMany({}),
    VehicleDocumentModel.deleteMany({}),
    AuctionModel.deleteMany({}),
    BidModel.deleteMany({}),
    WalletAccountModel.deleteMany({}),
    WalletTransactionModel.deleteMany({}),
    ConversationModel.deleteMany({}),
    MessageModel.deleteMany({}),
    ReviewModel.deleteMany({}),
    SettlementModel.deleteMany({}),
    ConfigEntryModel.deleteMany({}),
  ]);

  // 1. Seed Platform Config & Vehicle Catalog
  await ConfigEntryModel.create({
    key: 'platform_config',
    value: DEFAULT_PLATFORM_CONFIG,
  });

  await VehicleModel.insertMany(
    VEHICLE_CATALOG.map((v) => ({
      make: v.make,
      models: v.models,
      synonyms: v.synonyms,
    })),
  );

  // 2. Seed 10 Realistic Nigerian Users (2 Verified Dealers, 1 Admin/Moderator, 7 Buyers/Sellers)
  const seedUsers = await UserModel.insertMany([
    {
      phone: '+2348031000001',
      email: 'berger@autodey.ng',
      displayName: 'Berger Prime Auto Mart',
      bio: 'Direct importer of US & Canadian Tokunbo Toyota, Lexus & Honda vehicles at Ojodu Berger, Lagos.',
      state: 'Lagos',
      lga: 'Ojodu Berger',
      roles: ['buyer', 'seller', 'dealer'],
      verification: { phoneVerified: true, idVerified: true, dealerVerified: true },
      responseStats: { ratePercent: 99, avgResponseMinutes: 4, totalConversations: 120, respondedConversations: 119 },
      ratingStats: { avg: 4.9, count: 42 },
    },
    {
      phone: '+2348031000002',
      email: 'maitama@autodey.ng',
      displayName: 'Maitama Premier Motors',
      bio: 'Abuja’s premier luxury and SUV dealership. Full customs duty verification and inspection bays on site.',
      state: 'Abuja',
      lga: 'Maitama',
      roles: ['buyer', 'seller', 'dealer'],
      verification: { phoneVerified: true, idVerified: true, dealerVerified: true },
      responseStats: { ratePercent: 98, avgResponseMinutes: 6, totalConversations: 85, respondedConversations: 83 },
      ratingStats: { avg: 4.8, count: 31 },
    },
    {
      phone: '+2348031000003',
      email: 'admin@autodey.ng',
      displayName: 'Adaeze Nwosu (AutoDey Admin)',
      bio: 'Platform Trust, Customs Verification & Auction Settlement Moderator.',
      state: 'Lagos',
      lga: 'Victoria Island',
      roles: ['buyer', 'seller', 'moderator', 'admin'],
      verification: { phoneVerified: true, idVerified: true, dealerVerified: false },
      responseStats: { ratePercent: 100, avgResponseMinutes: 2, totalConversations: 20, respondedConversations: 20 },
      ratingStats: { avg: 5.0, count: 10 },
    },
    {
      phone: '+2348031000004',
      email: 'chinedu@autodey.ng',
      displayName: 'Chinedu Okafor',
      bio: 'Lekki-based car enthusiast and verified Tokunbo importer.',
      state: 'Lagos',
      lga: 'Lekki',
      roles: ['buyer', 'seller'],
      verification: { phoneVerified: true, idVerified: true, dealerVerified: false },
      responseStats: { ratePercent: 95, avgResponseMinutes: 9, totalConversations: 24, respondedConversations: 23 },
      ratingStats: { avg: 4.7, count: 14 },
    },
    {
      phone: '+2348031000005',
      email: 'abubakar@autodey.ng',
      displayName: 'Abubakar Bello',
      bio: 'Verified buyer and fleet operator in Abuja & Kano.',
      state: 'Kano',
      lga: 'Nassarawa',
      roles: ['buyer', 'seller'],
      verification: { phoneVerified: true, idVerified: true, dealerVerified: false },
      responseStats: { ratePercent: 92, avgResponseMinutes: 14, totalConversations: 15, respondedConversations: 14 },
      ratingStats: { avg: 4.6, count: 8 },
    },
    {
      phone: '+2348031000006',
      email: 'olamide@autodey.ng',
      displayName: 'Olamide Adeyemi',
      state: 'Oyo',
      lga: 'Bodija',
      roles: ['buyer', 'seller'],
      verification: { phoneVerified: true, idVerified: true, dealerVerified: false },
      responseStats: { ratePercent: 94, avgResponseMinutes: 11, totalConversations: 18, respondedConversations: 17 },
      ratingStats: { avg: 4.8, count: 9 },
    },
    {
      phone: '+2348031000007',
      email: 'tamuno@autodey.ng',
      displayName: 'Tamuno Briggs',
      state: 'Rivers',
      lga: 'Port Harcourt',
      roles: ['buyer', 'seller'],
      verification: { phoneVerified: true, idVerified: true, dealerVerified: false },
      responseStats: { ratePercent: 91, avgResponseMinutes: 16, totalConversations: 12, respondedConversations: 11 },
      ratingStats: { avg: 4.5, count: 6 },
    },
    {
      phone: '+2348031000008',
      email: 'ifunanya@autodey.ng',
      displayName: 'Ifunanya Eze',
      state: 'Enugu',
      lga: 'Independence Layout',
      roles: ['buyer', 'seller'],
      verification: { phoneVerified: true, idVerified: true, dealerVerified: false },
    },
    {
      phone: '+2348031000009',
      email: 'segun@autodey.ng',
      displayName: 'Segun Ogunleye',
      state: 'Lagos',
      lga: 'Ikeja',
      roles: ['buyer', 'seller'],
      verification: { phoneVerified: true, idVerified: false, dealerVerified: false },
    },
    {
      phone: '+2348031000010',
      email: 'zainab@autodey.ng',
      displayName: 'Zainab Danjuma',
      state: 'Abuja',
      lga: 'Gwarinpa',
      roles: ['buyer', 'seller'],
      verification: { phoneVerified: true, idVerified: true, dealerVerified: false },
    },
  ]);

  const dealer1 = seedUsers[0]!;
  const dealer2 = seedUsers[1]!;
  const adminUser = seedUsers[2]!;
  const bidderChinedu = seedUsers[3]!;
  const bidderAbubakar = seedUsers[4]!;
  const bidderOlamide = seedUsers[5]!;

  // Create Dealer Profiles for the 2 Verified Dealers
  await DealerProfileModel.insertMany([
    {
      userId: dealer1._id,
      slug: 'berger-prime-auto-mart',
      businessName: 'Berger Prime Auto Mart Ltd',
      cacNumber: 'RC-1492018',
      address: 'Plot 22, Berger Auto Corridor, Ojodu Berger, Lagos',
      state: 'Lagos',
      lga: 'Ojodu Berger',
      coordinates: { lat: 6.6531, lng: 3.3768 },
      shopPhotos: [CAR_PHOTOS[0]!, CAR_PHOTOS[2]!],
      openingHours: 'Mon–Sat: 8:00 AM – 6:30 PM',
      status: 'approved',
      planTier: 'premier',
      listingLimit: 250,
      approvedBy: adminUser._id,
      approvedAt: new Date(),
    },
    {
      userId: dealer2._id,
      slug: 'maitama-premier-motors',
      businessName: 'Maitama Premier Motors Abuja',
      cacNumber: 'RC-1904821',
      address: '48 IBB Way, Maitama District, Abuja FCT',
      state: 'Abuja',
      lga: 'Maitama',
      coordinates: { lat: 9.082, lng: 7.4951 },
      shopPhotos: [CAR_PHOTOS[1]!, CAR_PHOTOS[3]!],
      openingHours: 'Mon–Sat: 8:30 AM – 6:00 PM',
      status: 'approved',
      planTier: 'pro',
      listingLimit: 60,
      approvedBy: adminUser._id,
      approvedAt: new Date(),
    },
  ]);

  // Create Wallets & Refundable Bidding Deposits for all users
  for (const u of seedUsers) {
    const depositKobo = nairaToKobo(500_000); // N500,000 refundable deposit -> N25,000,000+ bidding power
    const wallet = await WalletAccountModel.create({
      userId: u._id,
      availableKobo: depositKobo,
      heldKobo: 0,
      forfeitedKobo: 0,
      currency: 'NGN',
    });
    await WalletTransactionModel.create({
      walletId: wallet._id,
      userId: u._id,
      idempotencyKey: `seed-deposit-${u._id.toString()}`,
      type: 'deposit',
      direction: 'credit',
      amountKobo: depositKobo,
      balanceAfterAvailableKobo: depositKobo,
      balanceAfterHeldKobo: 0,
      referenceType: 'payment',
      referenceId: `PSK-SEED-${u._id.toString().slice(-6)}`,
      description: 'Initial Refundable Bidding Deposit (Seeded)',
    });
  }

  // 3. Create 40 Realistic Listings
  const createdListings = [];
  for (let i = 0; i < FORTY_NIGERIAN_LISTINGS.length; i++) {
    const item = FORTY_NIGERIAN_LISTINGS[i]!;
    const seller = seedUsers[i % 7]!;
    const title = `${item.year} ${item.make} ${item.model} ${item.trim}`;
    const slug = `${item.year}-${item.make}-${item.model}-${item.state}-${i + 1}`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-');
    const coverPhotoUrl = CAR_PHOTOS[i % CAR_PHOTOS.length]!;
    const vin = item.vinChecked ? buildSeedVin(i + 1) : undefined;

    const now = Date.now();
    const listing = await ListingModel.create({
      sellerId: seller._id,
      slug,
      title,
      category: item.category,
      make: item.make,
      model: item.model,
      trim: item.trim,
      year: item.year,
      condition: item.condition,
      mileageKm: item.mileageKm,
      transmission: item.transmission,
      fuelType: item.fuelType,
      bodyType: item.bodyType,
      driveSide: 'lhd',
      engineSize: item.bodyType === 'suv' ? '3.5L V6' : '2.5L 4-Cylinder',
      exteriorColor: item.exteriorColor,
      interiorColor: 'Black Leather',
      ownersCount: item.condition === 'foreign_used' ? 1 : 2,
      state: item.state,
      lga: item.lga,
      ...(vin ? { vin } : {}),
      customsStatus: item.customsReviewed ? 'yes' : 'unsure',
      accidentHistory: 'none',
      priceKobo: nairaToKobo(item.priceNaira),
      negotiable: item.negotiable,
      swapAccepted: i % 4 === 0,
      description: `Clean ${
        item.condition === 'foreign_used' ? 'direct US-spec Tokunbo' : 'well-maintained Nigerian used'
      } ${title} available for physical inspection in ${item.lga}, ${
        item.state
      }. Ice-cold factory AC, untouched engine & gearbox, sound suspension, and verified documents.`,
      features: [
        'Factory Ice-Cold AC',
        'Reverse Camera',
        'Bluetooth / Apple CarPlay',
        'Alloy Wheels',
        'Keyless Entry / Push Start',
        'Leather Seats',
      ],
      coverPhotoUrl,
      badges: {
        vinChecked: item.vinChecked,
        customsReviewed: item.customsReviewed,
        inspected: Boolean(item.inspected),
      },
      status: 'active',
      promotion: {
        topAdUntil: item.topAd ? new Date(now + 7 * 86400 * 1000) : null,
        featuredUntil: item.featured ? new Date(now + 7 * 86400 * 1000) : null,
        urgentUntil: item.urgent ? new Date(now + 14 * 86400 * 1000) : null,
        bumpedAt: new Date(now - i * 3600 * 1000),
      },
      stats: {
        views: 45 + ((i * 19) % 240),
        phoneReveals: 4 + (i % 15),
        chatStarts: 2 + (i % 9),
        favoritesCount: 3 + (i % 14),
      },
      isAuction: false,
    });

    // Insert 6 guided-angle photos per listing
    const mediaDocs = GUIDED_ANGLES.slice(0, 6).map((angle, photoIdx) => ({
      listingId: listing._id,
      sellerId: seller._id,
      url: CAR_PHOTOS[(i + photoIdx) % CAR_PHOTOS.length]!,
      angle,
      order: photoIdx,
      perceptualHash: `phash_${i}_${photoIdx}`,
    }));
    await ListingMediaModel.insertMany(mediaDocs);

    if (item.customsReviewed) {
      await VehicleDocumentModel.create({
        listingId: listing._id,
        sellerId: seller._id,
        type: 'customs_duty',
        fileUrl: coverPhotoUrl,
        customsReferenceNumber: `NCS-APAPA-2026-${1000 + i}`,
        summary: 'Nigeria Customs Service Apapa Port Single Goods Declaration (SGD) verified.',
        status: 'approved',
        reviewedBy: adminUser._id,
        reviewedAt: new Date(),
      });
    }

    createdListings.push(listing);
  }

  // 4. Seed 6 Auctions in Different States:
  //    (1) Live ending in 2m 45s (for soft-close testing!)
  //    (2) Live ending in 45m (urgent countdown, reserve met)
  //    (3) Live ending in 16h (no reserve)
  //    (4) Live ending in 3 days (reserve not met)
  //    (5) Ended with Reserve Met (sold_pending_settlement)
  //    (6) Ended without Reserve Met (ended_reserve_not_met)
  const auctionIndices = [19, 35, 23, 26, 11, 22]; // Lexus RX 350, Hilux, C300, GLE 350, Highlander, GX 460
  const nowMs = Date.now();
  const auctionConfigs = [
    {
      status: 'live' as const,
      startPriceKobo: nairaToKobo(25_000_000),
      currentPriceKobo: nairaToKobo(29_400_000),
      reservePriceKobo: nairaToKobo(28_000_000),
      reserveMet: true,
      buyNowPriceKobo: nairaToKobo(32_500_000),
      startsAt: new Date(nowMs - 3 * 86400 * 1000),
      endsAt: new Date(nowMs + 2 * 60 * 1000 + 45 * 1000), // 2 mins 45 secs!
      bidCount: 14,
      leader: {
        userId: bidderChinedu._id,
        proxyMax: nairaToKobo(30_000_000),
        placedAt: new Date(nowMs - 60_000),
      },
    },
    {
      status: 'live' as const,
      startPriceKobo: nairaToKobo(30_000_000),
      currentPriceKobo: nairaToKobo(34_200_000),
      reservePriceKobo: null,
      reserveMet: true,
      buyNowPriceKobo: nairaToKobo(37_000_000),
      startsAt: new Date(nowMs - 5 * 86400 * 1000),
      endsAt: new Date(nowMs + 48 * 60 * 1000), // 48 mins
      bidCount: 19,
      leader: {
        userId: bidderAbubakar._id,
        proxyMax: nairaToKobo(35_000_000),
        placedAt: new Date(nowMs - 120_000),
      },
    },
    {
      status: 'live' as const,
      startPriceKobo: nairaToKobo(20_000_000),
      currentPriceKobo: nairaToKobo(24_500_000),
      reservePriceKobo: nairaToKobo(24_000_000),
      reserveMet: true,
      buyNowPriceKobo: null,
      startsAt: new Date(nowMs - 2 * 86400 * 1000),
      endsAt: new Date(nowMs + 16 * 3600 * 1000), // 16 hours
      bidCount: 11,
      leader: {
        userId: bidderOlamide._id,
        proxyMax: nairaToKobo(25_200_000),
        placedAt: new Date(nowMs - 300_000),
      },
    },
    {
      status: 'live' as const,
      startPriceKobo: nairaToKobo(21_000_000),
      currentPriceKobo: nairaToKobo(23_100_000),
      reservePriceKobo: nairaToKobo(25_500_000),
      reserveMet: false,
      buyNowPriceKobo: nairaToKobo(27_500_000),
      startsAt: new Date(nowMs - 1 * 86400 * 1000),
      endsAt: new Date(nowMs + 3 * 86400 * 1000), // 3 days
      bidCount: 6,
      leader: {
        userId: bidderChinedu._id,
        proxyMax: nairaToKobo(23_800_000),
        placedAt: new Date(nowMs - 600_000),
      },
    },
    {
      status: 'sold_pending_settlement' as const,
      startPriceKobo: nairaToKobo(26_000_000),
      currentPriceKobo: nairaToKobo(31_500_000),
      reservePriceKobo: nairaToKobo(30_000_000),
      reserveMet: true,
      buyNowPriceKobo: null,
      startsAt: new Date(nowMs - 7 * 86400 * 1000),
      endsAt: new Date(nowMs - 4 * 3600 * 1000), // Ended 4 hours ago
      bidCount: 22,
      leader: {
        userId: bidderAbubakar._id,
        proxyMax: nairaToKobo(32_000_000),
        placedAt: new Date(nowMs - 5 * 3600 * 1000),
      },
    },
    {
      status: 'ended_reserve_not_met' as const,
      startPriceKobo: nairaToKobo(36_000_000),
      currentPriceKobo: nairaToKobo(39_200_000),
      reservePriceKobo: nairaToKobo(42_500_000),
      reserveMet: false,
      buyNowPriceKobo: null,
      startsAt: new Date(nowMs - 5 * 86400 * 1000),
      endsAt: new Date(nowMs - 2 * 3600 * 1000), // Ended 2 hours ago
      bidCount: 9,
      leader: {
        userId: bidderChinedu._id,
        proxyMax: nairaToKobo(39_200_000),
        placedAt: new Date(nowMs - 3 * 3600 * 1000),
      },
    },
  ];

  for (let idx = 0; idx < auctionIndices.length; idx++) {
    const listing = createdListings[auctionIndices[idx]!]!;
    const cfg = auctionConfigs[idx]!;

    const auction = await AuctionModel.create({
      listingId: listing._id,
      sellerId: listing.sellerId,
      status: cfg.status,
      startPrice: cfg.startPriceKobo,
      currentPrice: cfg.currentPriceKobo,
      reservePrice: cfg.reservePriceKobo,
      reserveMet: cfg.reserveMet,
      buyNowPrice: cfg.buyNowPriceKobo,
      startsAt: cfg.startsAt,
      endsAt: cfg.endsAt,
      originalEndsAt: cfg.endsAt,
      extensions: idx === 0 ? 1 : 0,
      bidCount: cfg.bidCount,
      leader: cfg.leader,
      settlementMode: 'DIRECT',
    });

    listing.isAuction = true;
    listing.auctionId = auction._id;
    listing.priceKobo = cfg.currentPriceKobo;
    await listing.save();

    // Seed sample Bid history for each auction
    await BidModel.insertMany([
      {
        auctionId: auction._id,
        bidderId: bidderOlamide._id,
        maskedBidderName: maskBidderName(bidderOlamide.displayName),
        amountKobo: cfg.startPriceKobo,
        type: 'manual',
        sequence: 1,
      },
      {
        auctionId: auction._id,
        bidderId: cfg.leader.userId,
        maskedBidderName: maskBidderName(
          cfg.leader.userId.equals(bidderChinedu._id)
            ? bidderChinedu.displayName
            : bidderAbubakar.displayName,
        ),
        amountKobo: cfg.currentPriceKobo,
        type: 'manual',
        sequence: 2,
      },
    ]);

    if (cfg.status === 'sold_pending_settlement') {
      await SettlementModel.create({
        auctionId: auction._id,
        listingId: listing._id,
        sellerId: listing.sellerId,
        winnerId: cfg.leader.userId,
        hammerPriceKobo: cfg.currentPriceKobo,
        platformFeeKobo: nairaToKobo(250_000),
        mode: 'DIRECT',
        status: 'pending',
        deadlineAt: new Date(nowMs + 68 * 3600 * 1000),
      });
    }
  }

  // 5. Seed Sample Conversations, Messages & Reviews
  const sampleListing = createdListings[0]!;
  const conv = await ConversationModel.create({
    listingId: sampleListing._id,
    buyerId: bidderChinedu._id,
    sellerId: sampleListing.sellerId,
    isSettlementChat: false,
    lastMessageAt: new Date(),
    lastMessagePreview: 'Good afternoon boss, is this 2018 Camry XSE available for inspection at Berger today?',
    buyerUnread: 0,
    sellerUnread: 1,
    firstBuyerMessageAt: new Date(nowMs - 600_000),
    firstSellerReplyAt: new Date(nowMs - 420_000),
  });

  await MessageModel.insertMany([
    {
      conversationId: conv._id,
      senderId: bidderChinedu._id,
      type: 'text',
      body: 'Good afternoon boss, is this 2018 Camry XSE available for inspection at Berger today?',
    },
    {
      conversationId: conv._id,
      senderId: sampleListing.sellerId,
      type: 'text',
      body: 'Yes boss, car is on ground at our Ojodu Berger lot with full Apapa customs duty papers.',
    },
  ]);

  await ReviewModel.create({
    reviewerId: bidderChinedu._id,
    sellerId: dealer1._id,
    listingId: sampleListing._id,
    interactionType: 'chat',
    interactionRefId: conv._id,
    rating: 5,
    comment: 'Inspected the Camry XSE at Berger Prime Auto Mart. VIN and customs papers matched 100%. Transparent dealer.',
  });

  logger.info(
    {
      users: seedUsers.length,
      listings: createdListings.length,
      auctions: auctionIndices.length,
    },
    'Seeded Nigerian marketplace data (40 listings, 10 users, 6 auctions, chats & reviews)',
  );

  return {
    usersCount: seedUsers.length,
    listingsCount: createdListings.length,
    auctionsCount: auctionIndices.length,
  };
}

export async function seedDatabaseIfEmpty(): Promise<void> {
  const count = await ListingModel.countDocuments();
  if (count === 0) {
    logger.info('Empty database detected — running initial Nigerian dataset seed...');
    await runSeed();
  }
}

