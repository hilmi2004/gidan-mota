import { DEFAULT_PLATFORM_CONFIG, nairaToKobo } from '@autodey/shared';
import type { ListingSummaryItem } from '../components/listings/ListingCards';

const now = Date.now();

export const DEMO_LISTINGS: ListingSummaryItem[] = [
  {
    id: 'demo-auc-1',
    slug: '2019-toyota-land-cruiser-prado-vxl-lagos-1',
    title: '2019 Toyota Land Cruiser Prado VX-L (Tokunbo)',
    year: 2019,
    make: 'Toyota',
    model: 'Land Cruiser Prado',
    trim: 'VX-L 4WD',
    condition: 'foreign_used',
    mileageKm: 38400,
    transmission: 'automatic',
    fuelType: 'petrol',
    bodyType: 'suv',
    state: 'Lagos',
    lga: 'Eti-Osa',
    priceKobo: nairaToKobo(36_500_000),
    negotiable: false,
    coverPhotoUrl:
      'https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?auto=format&fit=crop&w=1000&q=80',
    photoCount: 12,
    hasVideo: true,
    isAuction: true,
    badges: {
      vinChecked: true,
      customsReviewed: true,
      inspected: true,
    },
    seller: {
      id: 'dealer-1',
      displayName: 'Lekki Sovereign Motors',
      phoneVerified: true,
      idVerified: true,
      dealerVerified: true,
    },
    auction: {
      id: 'auc-101',
      status: 'live',
      currentPrice: nairaToKobo(32_400_000),
      startPrice: nairaToKobo(28_000_000),
      buyNowPrice: nairaToKobo(39_000_000),
      reserveMet: true,
      hasReserve: true,
      bidCount: 18,
      endsAt: new Date(now + 2 * 3600 * 1000 + 14 * 60 * 1000).toISOString(),
    },
  },
  {
    id: 'demo-auc-2',
    slug: '2018-lexus-rx-350-fsport-abuja-2',
    title: '2018 Lexus RX 350 F-Sport AWD (Foreign Used)',
    year: 2018,
    make: 'Lexus',
    model: 'RX 350',
    trim: 'F-Sport',
    condition: 'foreign_used',
    mileageKm: 44200,
    transmission: 'automatic',
    fuelType: 'petrol',
    bodyType: 'suv',
    state: 'FCT',
    lga: 'Abuja Municipal',
    priceKobo: nairaToKobo(29_800_000),
    negotiable: false,
    coverPhotoUrl:
      'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=1000&q=80',
    photoCount: 10,
    hasVideo: true,
    isAuction: true,
    badges: {
      vinChecked: true,
      customsReviewed: true,
      inspected: true,
    },
    seller: {
      id: 'dealer-2',
      displayName: 'Maitama Premier Auto Lot',
      phoneVerified: true,
      idVerified: true,
      dealerVerified: true,
    },
    auction: {
      id: 'auc-102',
      status: 'live',
      currentPrice: nairaToKobo(24_900_000),
      startPrice: nairaToKobo(21_000_000),
      buyNowPrice: nairaToKobo(31_500_000),
      reserveMet: true,
      hasReserve: false,
      bidCount: 24,
      endsAt: new Date(now + 41 * 60 * 1000).toISOString(),
    },
  },
  {
    id: 'demo-auc-3',
    slug: '2020-mercedes-benz-gle-450-4matic-lagos-3',
    title: '2020 Mercedes-Benz GLE 450 4MATIC AMG Line',
    year: 2020,
    make: 'Mercedes-Benz',
    model: 'GLE 350',
    trim: 'AMG Line 4MATIC',
    condition: 'foreign_used',
    mileageKm: 29100,
    transmission: 'automatic',
    fuelType: 'hybrid',
    bodyType: 'suv',
    state: 'Lagos',
    lga: 'Ikeja',
    priceKobo: nairaToKobo(58_000_000),
    negotiable: false,
    coverPhotoUrl:
      'https://images.unsplash.com/photo-1618843479319-561729142657?auto=format&fit=crop&w=1000&q=80',
    photoCount: 14,
    hasVideo: true,
    isAuction: true,
    badges: {
      vinChecked: true,
      customsReviewed: true,
      inspected: true,
    },
    seller: {
      id: 'dealer-3',
      displayName: 'Berger Prime Auto Mart',
      phoneVerified: true,
      idVerified: true,
      dealerVerified: true,
    },
    auction: {
      id: 'auc-103',
      status: 'live',
      currentPrice: nairaToKobo(49_500_000),
      startPrice: nairaToKobo(44_000_000),
      buyNowPrice: nairaToKobo(60_000_000),
      reserveMet: false,
      hasReserve: true,
      bidCount: 11,
      endsAt: new Date(now + 5 * 3600 * 1000 + 20 * 60 * 1000).toISOString(),
    },
  },
  {
    id: 'demo-car-1',
    slug: '2017-toyota-camry-xle-tokunbo-lagos',
    title: '2017 Toyota Camry XLE V6 (Direct Tokunbo)',
    year: 2017,
    make: 'Toyota',
    model: 'Camry',
    trim: 'XLE V6',
    condition: 'foreign_used',
    mileageKm: 61500,
    transmission: 'automatic',
    fuelType: 'petrol',
    bodyType: 'sedan',
    state: 'Lagos',
    lga: 'Ikeja',
    priceKobo: nairaToKobo(14_800_000),
    negotiable: true,
    coverPhotoUrl:
      'https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?auto=format&fit=crop&w=1000&q=80',
    photoCount: 9,
    hasVideo: false,
    isAuction: false,
    badges: {
      vinChecked: true,
      customsReviewed: true,
      inspected: true,
    },
    promotion: {
      topAdUntil: new Date(now + 7 * 86400 * 1000).toISOString(),
    },
    seller: {
      id: 'dealer-3',
      displayName: 'Berger Prime Auto Mart',
      phoneVerified: true,
      idVerified: true,
      dealerVerified: true,
    },
  },
  {
    id: 'demo-car-2',
    slug: '2016-honda-accord-sport-lagos',
    title: '2016 Honda Accord Sport 2.4L (Thumbstart)',
    year: 2016,
    make: 'Honda',
    model: 'Accord',
    trim: 'Sport',
    condition: 'foreign_used',
    mileageKm: 72000,
    transmission: 'automatic',
    fuelType: 'petrol',
    bodyType: 'sedan',
    state: 'Lagos',
    lga: 'Surulere',
    priceKobo: nairaToKobo(11_900_000),
    negotiable: true,
    coverPhotoUrl:
      'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=1000&q=80',
    photoCount: 8,
    hasVideo: false,
    isAuction: false,
    badges: {
      vinChecked: true,
      customsReviewed: true,
      inspected: false,
    },
    seller: {
      id: 'dealer-1',
      displayName: 'Lekki Sovereign Motors',
      phoneVerified: true,
      idVerified: true,
      dealerVerified: true,
    },
  },
  {
    id: 'demo-car-3',
    slug: '2019-toyota-hilux-adventure-4x4-ph',
    title: '2019 Toyota Hilux Adventure 4x4 Double Cabin',
    year: 2019,
    make: 'Toyota',
    model: 'Hilux',
    trim: 'Adventure 4x4',
    condition: 'nigerian_used',
    mileageKm: 54000,
    transmission: 'automatic',
    fuelType: 'diesel',
    bodyType: 'pickup',
    state: 'Rivers',
    lga: 'Port Harcourt',
    priceKobo: nairaToKobo(27_500_000),
    negotiable: true,
    coverPhotoUrl:
      'https://images.unsplash.com/photo-1559416523-140ddc3d238c?auto=format&fit=crop&w=1000&q=80',
    photoCount: 10,
    hasVideo: true,
    isAuction: false,
    badges: {
      vinChecked: true,
      customsReviewed: true,
      inspected: true,
    },
    seller: {
      id: 'dealer-2',
      displayName: 'Maitama Premier Auto Lot',
      phoneVerified: true,
      idVerified: true,
      dealerVerified: true,
    },
  },
  {
    id: 'demo-car-4',
    slug: '2015-mercedes-benz-c300-4matic-abuja',
    title: '2015 Mercedes-Benz C300 4MATIC Panoramic Roof',
    year: 2015,
    make: 'Mercedes-Benz',
    model: 'C300',
    trim: '4MATIC Luxury',
    condition: 'foreign_used',
    mileageKm: 68900,
    transmission: 'automatic',
    fuelType: 'petrol',
    bodyType: 'sedan',
    state: 'FCT',
    lga: 'Bwari',
    priceKobo: nairaToKobo(17_200_000),
    negotiable: true,
    coverPhotoUrl:
      'https://images.unsplash.com/photo-1617788138017-80ad40651399?auto=format&fit=crop&w=1000&q=80',
    photoCount: 8,
    hasVideo: false,
    isAuction: false,
    badges: {
      vinChecked: true,
      customsReviewed: true,
      inspected: false,
    },
    seller: {
      id: 'dealer-2',
      displayName: 'Maitama Premier Auto Lot',
      phoneVerified: true,
      idVerified: true,
      dealerVerified: true,
    },
  },
];

export const DEMO_DEALERS = [
  {
    _id: 'dealer-1',
    userId: 'user-dealer-1',
    slug: 'lekki-sovereign-motors',
    businessName: 'Lekki Sovereign Motors Ltd',
    cacNumber: 'RC-1849201',
    status: 'approved',
    cacStatus: 'approved',
    address: 'Plot 14 Lekki-Epe Expressway, Beside Chevron',
    state: 'Lagos',
    lga: 'Eti-Osa',
    openingHours: 'Mon–Sat: 8:00 AM – 6:30 PM',
    planTier: 'premier',
    listingLimit: 100,
    leadStats: {
      views: 1840,
      phoneReveals: 215,
      chatStarts: 142,
      totalViews: 1840,
      totalPhoneReveals: 215,
      totalChatStarts: 142,
    },
  },
  {
    _id: 'dealer-2',
    userId: 'user-dealer-2',
    slug: 'maitama-premier-auto-lot',
    businessName: 'Maitama Premier Auto Lot',
    cacNumber: 'RC-2094812',
    status: 'approved',
    cacStatus: 'approved',
    address: '42 Aminu Kano Crescent, Wuse II / Maitama',
    state: 'FCT',
    lga: 'Abuja Municipal',
    openingHours: 'Mon–Sat: 8:30 AM – 6:00 PM',
    planTier: 'pro',
    listingLimit: 50,
    leadStats: {
      views: 1290,
      phoneReveals: 164,
      chatStarts: 98,
      totalViews: 1290,
      totalPhoneReveals: 164,
      totalChatStarts: 98,
    },
  },
  {
    _id: 'dealer-3',
    userId: 'user-dealer-3',
    slug: 'berger-prime-auto-mart',
    businessName: 'Berger Prime Auto Mart',
    cacNumber: 'RC-1193844',
    status: 'approved',
    cacStatus: 'approved',
    address: 'Block C, Berger Auto Mart, Ojodu Berger',
    state: 'Lagos',
    lga: 'Ikeja',
    openingHours: 'Mon–Sat: 8:00 AM – 6:00 PM',
    planTier: 'pro',
    listingLimit: 50,
    leadStats: {
      views: 2410,
      phoneReveals: 310,
      chatStarts: 189,
      totalViews: 2410,
      totalPhoneReveals: 310,
      totalChatStarts: 189,
    },
  },
];

export function resolveDemoApiFallback<T>(path: string, options: RequestInit = {}): T {
  const cleanPath = path.split('?')[0]!;
  const queryStr = path.split('?')[1] || '';
  const params = new URLSearchParams(queryStr);

  if (cleanPath === '/search' || cleanPath === '/listings') {
    let items = [...DEMO_LISTINGS];
    if (params.get('auctionOnly') === 'true') {
      items = items.filter((i) => i.isAuction);
    }
    const make = params.get('make');
    if (make && make !== 'All') {
      items = items.filter((i) => i.make.toLowerCase() === make.toLowerCase());
    }
    const state = params.get('state');
    if (state && state !== 'All') {
      items = items.filter((i) => i.state.toLowerCase() === state.toLowerCase());
    }
    return {
      items,
      total: items.length,
      page: 1,
      hasMore: false,
      serverTimeMs: Date.now(),
    } as unknown as T;
  }

  if (cleanPath === '/auctions') {
    const auctions = DEMO_LISTINGS.filter((i) => i.isAuction).map((item) => ({
      _id: item.auction!.id,
      listingId: item.id,
      sellerId: item.seller?.id ?? 'dealer-1',
      status: item.auction!.status,
      startPrice: item.auction!.startPrice ?? item.priceKobo,
      currentPrice: item.auction!.currentPrice,
      reserveMet: item.auction!.reserveMet,
      hasReserve: item.auction!.hasReserve,
      buyNowPrice: item.auction!.buyNowPrice ?? null,
      buyNowAvailable: Boolean(item.auction!.buyNowPrice),
      startsAt: new Date(now - 3600_000).toISOString(),
      endsAt: item.auction!.endsAt,
      originalEndsAt: item.auction!.endsAt,
      extensions: 0,
      bidCount: item.auction!.bidCount,
      nextMinBidKobo: item.auction!.currentPrice + nairaToKobo(100_000),
      leader: {
        userId: 'user-buyer-1',
        maskedName: 'Ch***a',
        placedAt: new Date(now - 120_000).toISOString(),
      },
      settlementMode: 'DIRECT',
      listing: {
        id: item.id,
        slug: item.slug,
        title: item.title,
        year: item.year,
        make: item.make,
        model: item.model,
        trim: item.trim,
        condition: item.condition,
        mileageKm: item.mileageKm,
        transmission: item.transmission,
        fuelType: item.fuelType,
        state: item.state,
        lga: item.lga,
        coverPhotoUrl: item.coverPhotoUrl,
        badges: item.badges,
      },
    }));
    return { items: auctions, serverTimeMs: Date.now() } as unknown as T;
  }

  if (cleanPath.startsWith('/auctions/')) {
    const id = cleanPath.replace('/auctions/', '').split('/')[0]!;
    const matched =
      DEMO_LISTINGS.find((i) => i.auction?.id === id || i.id === id) ?? DEMO_LISTINGS[0]!;
    return {
      auction: {
        _id: matched.auction?.id ?? 'auc-101',
        listingId: matched.id,
        sellerId: matched.seller?.id ?? 'dealer-1',
        status: 'live',
        startPrice: matched.auction?.startPrice ?? nairaToKobo(25_000_000),
        currentPrice: matched.auction?.currentPrice ?? nairaToKobo(32_400_000),
        reserveMet: true,
        hasReserve: true,
        buyNowPrice: matched.auction?.buyNowPrice ?? nairaToKobo(39_000_000),
        buyNowAvailable: true,
        startsAt: new Date(now - 3600_000).toISOString(),
        endsAt: matched.auction?.endsAt ?? new Date(now + 7200_000).toISOString(),
        originalEndsAt: matched.auction?.endsAt ?? new Date(now + 7200_000).toISOString(),
        extensions: 0,
        bidCount: matched.auction?.bidCount ?? 18,
        nextMinBidKobo: (matched.auction?.currentPrice ?? nairaToKobo(32_400_000)) + nairaToKobo(100_000),
        leader: {
          userId: 'user-buyer-1',
          maskedName: 'Ch***a',
          placedAt: new Date(now - 120_000).toISOString(),
        },
        settlementMode: 'DIRECT',
      },
      listing: {
        ...matched,
        description:
          'Verified clean title vehicle with full NHTSA 17-digit VIN check and reviewed Nigeria Customs Service duty papers.',
        photos: [
          { url: matched.coverPhotoUrl, angle: 'front', order: 0 },
          {
            url: 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=1000&q=80',
            angle: 'interior',
            order: 1,
          },
        ],
        features: ['Factory Chilling AC', 'Reverse Camera', 'Thumbstart Push Button', 'Leather Seats'],
      },
      bids: [
        {
          _id: 'b-1',
          maskedBidderName: 'Ch***a',
          amountKobo: matched.auction?.currentPrice ?? nairaToKobo(32_400_000),
          type: 'proxy',
          sequence: 18,
          createdAt: new Date(now - 90_000).toISOString(),
        },
        {
          _id: 'b-2',
          maskedBidderName: 'Ab***r',
          amountKobo: (matched.auction?.currentPrice ?? nairaToKobo(32_400_000)) - nairaToKobo(200_000),
          type: 'manual',
          sequence: 17,
          createdAt: new Date(now - 240_000).toISOString(),
        },
      ],
      settlement: null,
      serverTimeMs: Date.now(),
    } as unknown as T;
  }

  if (cleanPath.startsWith('/listings/')) {
    const slugOrId = cleanPath.replace('/listings/', '').split('/')[0]!;
    const item =
      DEMO_LISTINGS.find((l) => l.slug === slugOrId || l.id === slugOrId) ?? DEMO_LISTINGS[3]!;
    return {
      listing: {
        ...item,
        vin: '4T1BF1FK5JU123456',
        customsStatus: 'yes',
        accidentHistory: 'none',
        driveSide: 'lhd',
        exteriorColor: 'Metallic Silver',
        interiorColor: 'Black Leather',
        ownersCount: 1,
        swapAccepted: true,
        description:
          'Super clean Tokunbo vehicle with chilling factory AC, untouched V6 engine, smooth gear selection, and verified customs duty papers.',
        features: ['Factory AC', 'Reverse Camera', 'Alloy Wheels', 'Leather Interior', 'Bluetooth'],
        photos: [
          { url: item.coverPhotoUrl, angle: 'front', order: 0 },
          {
            url: 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=1000&q=80',
            angle: 'rear',
            order: 1,
          },
        ],
        stats: { views: 412, phoneReveals: 38, chatStarts: 19, favoritesCount: 27 },
      },
      seller: {
        id: item.seller?.id ?? 'dealer-1',
        displayName: item.seller?.displayName ?? 'Lekki Sovereign Motors',
        memberSince: new Date(now - 180 * 86400_000).toISOString(),
        activeListingsCount: 14,
        verification: {
          phoneVerified: true,
          idVerified: true,
          dealerVerified: true,
        },
        responseStats: { ratePercent: 98, avgResponseMinutes: 6 },
        ratingStats: { avg: 4.9, count: 34 },
      },
      fairPrice: {
        verdict: 'fair',
        label: 'Fair Market Price',
        medianKobo: item.priceKobo,
        sampleSize: 9,
        diffPercent: -2,
      },
      similarListings: DEMO_LISTINGS.slice(0, 3),
      moreFromSeller: DEMO_LISTINGS.slice(3, 6),
    } as unknown as T;
  }

  if (cleanPath === '/dealers') {
    return { dealers: DEMO_DEALERS } as unknown as T;
  }

  if (cleanPath.startsWith('/dealers/')) {
    const slug = cleanPath.replace('/dealers/', '');
    const dealer = DEMO_DEALERS.find((d) => d.slug === slug || d._id === slug) ?? DEMO_DEALERS[0]!;
    return {
      dealer,
      seller: {
        _id: dealer.userId,
        displayName: dealer.businessName,
        verification: { phoneVerified: true, idVerified: true, dealerVerified: true },
      },
      inventory: DEMO_LISTINGS,
      leadStats: {
        totalViews: dealer.leadStats.totalViews,
        totalPhoneReveals: dealer.leadStats.totalPhoneReveals,
        totalChatStarts: dealer.leadStats.totalChatStarts,
        totalFavorites: 94,
      },
    } as unknown as T;
  }

  if (cleanPath === '/pricing/config') {
    return {
      promotions: DEFAULT_PLATFORM_CONFIG.promotions,
      dealerPlans: DEFAULT_PLATFORM_CONFIG.dealerPlans,
    } as unknown as T;
  }

  if (cleanPath === '/wallet') {
    return {
      wallet: {
        availableKobo: nairaToKobo(250_000),
        heldKobo: nairaToKobo(100_000),
        forfeitedKobo: 0,
        currency: 'NGN',
        biddingPowerKobo: nairaToKobo(12_500_000),
      },
      config: {
        minDepositKobo: DEFAULT_PLATFORM_CONFIG.minDepositKobo,
        depositMultiplier: DEFAULT_PLATFORM_CONFIG.depositMultiplier,
      },
      transactions: [
        {
          _id: 'tx-1',
          type: 'deposit',
          direction: 'credit',
          amountKobo: nairaToKobo(350_000),
          balanceAfterAvailableKobo: nairaToKobo(350_000),
          balanceAfterHeldKobo: 0,
          description: 'Refundable bidding deposit credited via Paystack',
          createdAt: new Date(now - 86400_000).toISOString(),
        },
        {
          _id: 'tx-2',
          type: 'hold',
          direction: 'debit',
          amountKobo: nairaToKobo(100_000),
          balanceAfterAvailableKobo: nairaToKobo(250_000),
          balanceAfterHeldKobo: nairaToKobo(100_000),
          description: 'Deposit held for active winning bid on 2019 Land Cruiser Prado',
          createdAt: new Date(now - 3600_000).toISOString(),
        },
      ],
    } as unknown as T;
  }

  if (cleanPath === '/seller/dashboard') {
    return {
      summary: {
        views: 3420,
        phoneReveals: 289,
        chatStarts: 164,
        favoritesCount: 218,
        activeCount: DEMO_LISTINGS.length,
        soldCount: 5,
      },
      listings: DEMO_LISTINGS.map((l) => ({
        ...l,
        status: 'active',
        moderationFlags: [],
        stats: { views: 480, phoneReveals: 41, chatStarts: 23, favoritesCount: 31 },
        expiresAt: new Date(now + 45 * 86400_000).toISOString(),
      })),
    } as unknown as T;
  }

  if (cleanPath === '/admin/overview') {
    return {
      kpis: {
        totalUsers: 1420,
        activeListings: 40,
        flaggedListings: 2,
        liveAuctions: 6,
        pendingDocuments: 3,
        pendingDealers: 1,
        openDisputes: 0,
        openReports: 1,
        auctionGmvKobo: nairaToKobo(184_500_000),
        totalPlatformRevenueKobo: nairaToKobo(6_420_000),
      },
    } as unknown as T;
  }

  if (cleanPath === '/admin/moderation/listings') {
    return {
      listings: [
        {
          _id: 'mod-1',
          title: '2018 Toyota Camry XSE (Flagged Price Anomaly Check)',
          make: 'Toyota',
          model: 'Camry',
          year: 2018,
          priceKobo: nairaToKobo(6_500_000),
          state: 'Lagos',
          status: 'pending_review',
          moderationFlags: ['PRICE_BELOW_MARKET_MEDIAN'],
          reportsCount: 1,
        },
      ],
      reports: [],
    } as unknown as T;
  }

  if (cleanPath === '/admin/users') {
    return {
      users: [
        {
          _id: 'u-1',
          phone: '+2348031000001',
          displayName: 'Berger Prime Auto Mart',
          roles: ['seller', 'dealer'],
          strikes: 0,
          verification: { phoneVerified: true, idVerified: true, dealerVerified: true },
        },
        {
          _id: 'u-2',
          phone: '+2348031000010',
          displayName: 'Gidan Mota Trust Admin',
          roles: ['buyer', 'seller', 'moderator', 'admin'],
          strikes: 0,
          verification: { phoneVerified: true, idVerified: true, dealerVerified: false },
        },
      ],
      dealerApplications: DEMO_DEALERS,
    } as unknown as T;
  }

  if (cleanPath === '/admin/documents') {
    return { documents: [] } as unknown as T;
  }

  if (cleanPath === '/admin/disputes') {
    return { disputes: [] } as unknown as T;
  }

  if (cleanPath === '/admin/audit-logs') {
    return {
      logs: [
        {
          _id: 'log-1',
          actorId: 'admin-1',
          action: 'dealer.review.approved',
          entityType: 'DealerProfile',
          entityId: 'lekki-sovereign-motors',
          createdAt: new Date(now - 1800_000).toISOString(),
        },
      ],
    } as unknown as T;
  }

  if (cleanPath === '/auth/otp/request') {
    return {
      message: 'OTP sent successfully',
      phoneMasked: '+234803 *** **99',
      devOtpCode: '123456',
    } as unknown as T;
  }

  if (cleanPath === '/auth/otp/verify') {
    const body = options.body ? (JSON.parse(String(options.body)) as Record<string, string>) : {};
    return {
      accessToken: 'demo-jwt-access-token',
      refreshToken: 'demo-jwt-refresh-token',
      isNewUser: false,
      user: {
        id: 'demo-user-1',
        phone: body.phone || '+2348035550199',
        displayName: body.displayName || 'Alhaji Musa Ibrahim',
        roles: ['buyer', 'seller', 'dealer', 'admin'],
        verification: {
          phoneVerified: true,
          idVerified: true,
          dealerVerified: true,
        },
      },
    } as unknown as T;
  }

  if (cleanPath === '/compare') {
    return { listings: DEMO_LISTINGS.slice(0, 3) } as unknown as T;
  }

  if (cleanPath === '/favorites') {
    return { items: DEMO_LISTINGS.slice(0, 4) } as unknown as T;
  }

  if (cleanPath === '/conversations') {
    return { conversations: [] } as unknown as T;
  }

  if (cleanPath === '/notifications') {
    return { notifications: [], unreadCount: 0 } as unknown as T;
  }

  return { items: [], listings: [], dealers: [] } as unknown as T;
}
