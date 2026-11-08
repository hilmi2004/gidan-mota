import type { UserRole } from '../schemas/index.js';

export interface UserVerificationBadges {
  phoneVerified: boolean;
  idVerified: boolean;
  dealerVerified: boolean;
}

export interface PublicUserProfileDTO {
  id: string;
  displayName: string;
  phoneMasked: string;
  email?: string;
  avatarUrl?: string;
  bio?: string;
  state?: string;
  lga?: string;
  roles: UserRole[];
  badges: UserVerificationBadges;
  memberSince: string;
  activeListingsCount: number;
  responseRatePercent: number;
  avgResponseMinutes: number;
  ratingAvg: number;
  reviewCount: number;
  dealerProfile?: {
    slug: string;
    businessName: string;
    cacNumber: string;
    address: string;
    state: string;
    lga: string;
    status: 'pending' | 'approved' | 'rejected';
    planTier: string;
  } | null;
}

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface AuctionPublicStateDTO {
  id: string;
  listingId: string;
  sellerId: string;
  status:
    | 'draft'
    | 'pending_review'
    | 'scheduled'
    | 'live'
    | 'sold_pending_settlement'
    | 'ended_reserve_not_met'
    | 'settled'
    | 'cancelled'
    | 'disputed';
  startPriceKobo: number;
  currentPriceKobo: number;
  nextMinimumBidKobo: number;
  buyNowPriceKobo?: number;
  reserveStatus: 'no_reserve' | 'reserve_not_met' | 'reserve_met';
  startsAt: string;
  endsAt: string;
  originalEndsAt: string;
  extensions: number;
  bidCount: number;
  winningBidderMasked?: string;
  viewerState?: 'winning' | 'outbid' | 'not_bidding';
  serverTimeMs: number;
}

