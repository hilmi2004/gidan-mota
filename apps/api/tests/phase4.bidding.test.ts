import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { getBidIncrementKobo, nairaToKobo } from '@autodey/shared';
import { createApp } from '../src/app.js';
import { connectDatabase, disconnectDatabase } from '../src/config/db.js';
import {
  AuctionModel,
  BidModel,
  ListingModel,
  UserModel,
  WalletAccountModel,
} from '../src/models/index.js';
import { placeBid } from '../src/modules/auctions/bidding.service.js';
import { creditDepositToWallet } from '../src/modules/wallet/wallet.service.js';
import { runSeed } from '../src/seed/seedData.js';

const app = createApp();

async function loginWithPhone(phone: string): Promise<{ token: string; userId: string }> {
  const otpReq = await request(app).post('/api/v1/auth/otp/request').send({ phone });
  const verifyRes = await request(app)
    .post('/api/v1/auth/otp/verify')
    .send({ phone, code: otpReq.body.devOtpCode });
  return { token: verifyRes.body.accessToken, userId: verifyRes.body.user.id };
}

describe('Phase 4 — Authoritative Proxy Bidding Engine, Soft-Close, Reserve, Deposit Wallet & Concurrency (a-l)', () => {
  let sellerId = '';
  let sellerToken = '';
  let bidderAId = '';
  let bidderAToken = '';
  let bidderBId = '';
  let bidderBToken = '';
  let bidderNoDepositId = '';

  beforeAll(async () => {
    await connectDatabase('autodey_test_phase4');
    await mongoose.connection.db?.dropDatabase();
    await runSeed();

    const sellerAuth = await loginWithPhone('08031000001'); // Berger Prime Auto Mart
    sellerId = sellerAuth.userId;
    sellerToken = sellerAuth.token;

    const bA = await loginWithPhone('08031000005'); // Abubakar
    bidderAId = bA.userId;
    bidderAToken = bA.token;

    const bB = await loginWithPhone('08031000006'); // Olamide
    bidderBId = bB.userId;
    bidderBToken = bB.token;

    // Ensure Bidder A and Bidder B are KYC verified so they have no 24h new-account cap during high-value tests
    await UserModel.updateMany(
      { _id: { $in: [bidderAId, bidderBId] } },
      { $set: { 'verification.idVerified': true } },
    );

    // Fund Bidder A and Bidder B with N500,000 deposit (unlocks up to N25,000,000 bidding power)
    await creditDepositToWallet({
      userId: bidderAId,
      amountKobo: nairaToKobo(500_000),
      reference: 'SEED_DEP_A',
      idempotencyKey: 'test-seed-dep-a',
    });
    await creditDepositToWallet({
      userId: bidderBId,
      amountKobo: nairaToKobo(500_000),
      reference: 'SEED_DEP_B',
      idempotencyKey: 'test-seed-dep-b',
    });

    // Create a user with zero deposit for test (l)
    const noDepUser = await UserModel.create({
      phone: '+2348099990001',
      displayName: 'Zero Deposit Bidder',
      roles: ['buyer'],
      verification: {
        phoneVerified: true,
        idVerified: true,
        dealerVerified: false,
      },
    });
    bidderNoDepositId = String(noDepUser._id);
  }, 60_000);

  afterAll(async () => {
    await disconnectDatabase();
  });

  async function createTestAuction(overrides?: {
    startPrice?: number;
    reservePrice?: number | null;
    buyNowPrice?: number | null;
    endsAt?: Date;
    originalEndsAt?: Date;
  }) {
    const baseListing = await ListingModel.findOne({ sellerId }).lean();
    const clonedListing = await ListingModel.create({
      ...baseListing,
      _id: new mongoose.Types.ObjectId(),
      slug: `test-auction-car-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      vin: `4T1BF1FK${Math.floor(100000000 + Math.random() * 899999999)}`.slice(0, 17),
      isAuction: true,
    });

    const now = new Date();
    const defaultEndsAt = new Date(now.getTime() + 24 * 3600 * 1000);
    const startPrice = overrides?.startPrice ?? nairaToKobo(2_000_000); // N2,000,000
    const reservePrice =
      overrides?.reservePrice !== undefined ? overrides.reservePrice : null;

    const auction = await AuctionModel.create({
      listingId: clonedListing._id,
      sellerId: new mongoose.Types.ObjectId(sellerId),
      status: 'live',
      startPrice,
      currentPrice: startPrice,
      reservePrice,
      reserveMet: !reservePrice,
      buyNowPrice: overrides?.buyNowPrice ?? null,
      startsAt: now,
      endsAt: overrides?.endsAt ?? defaultEndsAt,
      originalEndsAt: overrides?.originalEndsAt ?? overrides?.endsAt ?? defaultEndsAt,
      extensions: 0,
      bidCount: 0,
      leader: null,
      settlementMode: 'DIRECT',
    });

    return auction;
  }

  it('(a), (b), (c) handles first bid at startPrice, leader raising own max without raising currentPrice, and rejects leader lowering max', async () => {
    const startPrice = nairaToKobo(2_000_000); // N2.0M
    const auction = await createTestAuction({ startPrice });

    // (a) First bid sets leader and keeps visible currentPrice at startPrice (N2.0M) even when proxyMax is N2.5M
    const resA = await placeBid({
      auctionId: String(auction._id),
      bidderId: bidderAId,
      maxBidKobo: nairaToKobo(2_500_000),
    });

    expect(resA.auction.currentPrice).toBe(startPrice);
    expect(resA.auction.leader?.userId).toBe(bidderAId);
    expect(resA.auction.myProxyMaxKobo).toBe(nairaToKobo(2_500_000));
    expect(resA.auction.bidCount).toBe(1);

    // (b) Leader raising own max to N3.0M does NOT raise visible currentPrice
    const resB = await placeBid({
      auctionId: String(auction._id),
      bidderId: bidderAId,
      maxBidKobo: nairaToKobo(3_000_000),
    });
    expect(resB.auction.currentPrice).toBe(startPrice);
    expect(resB.auction.myProxyMaxKobo).toBe(nairaToKobo(3_000_000));

    // (c) Leader lowering or matching own max is rejected with MAX_NOT_HIGHER
    await expect(
      placeBid({
        auctionId: String(auction._id),
        bidderId: bidderAId,
        maxBidKobo: nairaToKobo(2_800_000),
      }),
    ).rejects.toMatchObject({ code: 'MAX_NOT_HIGHER' });
  });

  it('(d), (e), (f) handles challenger below leader max, tie on proxyMax going to earlier leader, and challenger beating leader max', async () => {
    const startPrice = nairaToKobo(2_000_000); // N2,000,000 (increment band N1m-N3m -> N25,000)
    const auction = await createTestAuction({ startPrice });

    // Bidder A leads with proxyMax = N2,500,000; visible price = N2,000,000
    await placeBid({
      auctionId: String(auction._id),
      bidderId: bidderAId,
      maxBidKobo: nairaToKobo(2_500_000),
    });

    // (d) Challenger B bids N2,200,000 (below A's N2.5M max):
    // Price advances to N2,200,000 + N25,000 = N2,225,000; A retains the lead
    const resD = await placeBid({
      auctionId: String(auction._id),
      bidderId: bidderBId,
      maxBidKobo: nairaToKobo(2_200_000),
    });
    expect(resD.auction.leader?.userId).toBe(bidderAId);
    expect(resD.auction.currentPrice).toBe(nairaToKobo(2_225_000));

    // (e) Challenger B bids exact tie N2,500,000 (== A's N2.5M max):
    // Earlier proxy (Bidder A) wins the tie at exact price N2,500,000
    const resE = await placeBid({
      auctionId: String(auction._id),
      bidderId: bidderBId,
      maxBidKobo: nairaToKobo(2_500_000),
    });
    expect(resE.auction.leader?.userId).toBe(bidderAId);
    expect(resE.auction.currentPrice).toBe(nairaToKobo(2_500_000));

    // (f) Challenger B bids N2,800,000 (above A's N2.5M max):
    // B takes the lead at oldLeader.proxyMax (N2.5M) + increment (N25k) = N2,525,000
    const resF = await placeBid({
      auctionId: String(auction._id),
      bidderId: bidderBId,
      maxBidKobo: nairaToKobo(2_800_000),
    });
    expect(resF.auction.leader?.userId).toBe(bidderBId);
    expect(resF.auction.currentPrice).toBe(
      nairaToKobo(2_500_000) + getBidIncrementKobo(nairaToKobo(2_500_000)),
    );
    expect(resF.outbidUserId).toBe(bidderAId);
  });

  it('(g) handles hidden reserve met via proxy jump and never leaks reservePrice or other user proxyMax', async () => {
    const startPrice = nairaToKobo(2_000_000);
    const reservePrice = nairaToKobo(3_200_000);
    const auction = await createTestAuction({ startPrice, reservePrice });

    // First bid below reserve (N2,500,000): price stays at startPrice (N2.0M), reserveMet = false
    const belowRes = await placeBid({
      auctionId: String(auction._id),
      bidderId: bidderAId,
      maxBidKobo: nairaToKobo(2_500_000),
    });
    expect(belowRes.auction.reserveMet).toBe(false);
    expect(belowRes.auction.currentPrice).toBe(startPrice);

    // Challenger B bids N3,500,000 (>= reserve N3,200,000):
    // Normal increment over A (N2.5M + N25k = N2.525M) is below reserve, so price jumps to reservePrice (N3,200,000) and reserveMet = true!
    const metRes = await placeBid({
      auctionId: String(auction._id),
      bidderId: bidderBId,
      maxBidKobo: nairaToKobo(3_500_000),
    });
    expect(metRes.auction.reserveMet).toBe(true);
    expect(metRes.reserveJustMet).toBe(true);
    expect(metRes.auction.currentPrice).toBe(reservePrice);

    // Verify public GET endpoint never leaks reservePrice or leader.proxyMax to another user
    const getRes = await request(app)
      .get(`/api/v1/auctions/${String(auction._id)}`)
      .set('Authorization', `Bearer ${bidderAToken}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.auction.reservePrice).toBeUndefined();
    expect(getRes.body.auction.leader.proxyMax).toBeUndefined();
    expect(getRes.body.auction.myProxyMaxKobo).toBeUndefined();
  });

  it('(h) extends endsAt on soft-close within final 2 minutes and enforces 30-minute maximum extension cap', async () => {
    const baseNow = new Date();
    // Auction originally scheduled to end 60 seconds from baseNow (inside 2-minute soft-close window)
    const originalEndsAt = new Date(baseNow.getTime() + 60 * 1000);
    const auction = await createTestAuction({
      startPrice: nairaToKobo(1_500_000),
      endsAt: originalEndsAt,
      originalEndsAt,
    });

    // Bid arrives at baseNow (60s before endsAt <= 120s window)
    const extRes = await placeBid({
      auctionId: String(auction._id),
      bidderId: bidderAId,
      maxBidKobo: nairaToKobo(1_600_000),
      now: baseNow,
    });
    expect(extRes.softCloseExtended).toBe(true);
    expect(extRes.auction.extensions).toBe(1);
    expect(new Date(extRes.auction.endsAt).getTime()).toBe(baseNow.getTime() + 2 * 60 * 1000);

    // Now test max-extension cap (originalEndsAt + 30 minutes)
    const maxCapMs = originalEndsAt.getTime() + 30 * 60 * 1000;
    await AuctionModel.updateOne(
      { _id: auction._id },
      { $set: { endsAt: new Date(maxCapMs - 10_000) } },
    );

    const lateBidNow = new Date(maxCapMs - 15_000); // 5 seconds before endsAt (15s before maxCapMs)
    const capRes = await placeBid({
      auctionId: String(auction._id),
      bidderId: bidderBId,
      maxBidKobo: nairaToKobo(1_800_000),
      now: lateBidNow,
    });
    // Capped at exact originalEndsAt + 30 minutes
    expect(new Date(capRes.auction.endsAt).getTime()).toBe(maxCapMs);
  });

  it('(j), (k), (l) rejects bid after endsAt, seller bidding on own auction, and bid without sufficient deposit', async () => {
    const auction = await createTestAuction({ startPrice: nairaToKobo(2_000_000) });

    // (k) Seller bidding on own auction -> OWN_AUCTION
    await expect(
      placeBid({
        auctionId: String(auction._id),
        bidderId: sellerId,
        maxBidKobo: nairaToKobo(2_500_000),
      }),
    ).rejects.toMatchObject({ code: 'OWN_AUCTION' });

    // (l) Bidder without deposit -> INSUFFICIENT_BIDDING_DEPOSIT
    await expect(
      placeBid({
        auctionId: String(auction._id),
        bidderId: bidderNoDepositId,
        maxBidKobo: nairaToKobo(2_500_000),
      }),
    ).rejects.toMatchObject({ code: 'INSUFFICIENT_BIDDING_DEPOSIT' });

    // (j) Bid after endsAt -> AUCTION_ENDED
    const afterEndsAt = new Date(auction.endsAt.getTime() + 1000);
    await expect(
      placeBid({
        auctionId: String(auction._id),
        bidderId: bidderAId,
        maxBidKobo: nairaToKobo(2_500_000),
        now: afterEndsAt,
      }),
    ).rejects.toMatchObject({ code: 'AUCTION_ENDED' });
  });

  it('(i) CONCURRENCY TEST: 50 concurrent bids from 20 users on one auction produce a strictly consistent final state and bid history with zero lost updates', async () => {
    const startPrice = nairaToKobo(1_000_000); // N1,000,000
    const auction = await createTestAuction({ startPrice });

    // Create 20 verified bidder accounts and fund each with N500,000 deposit
    const numUsers = 20;
    const bidderIds: string[] = [];

    for (let i = 0; i < numUsers; i++) {
      const u = await UserModel.create({
        phone: `+2348155500${String(i).padStart(3, '0')}`,
        displayName: `ConcurrentBidder${i + 1}`,
        roles: ['buyer'],
        verification: {
          phoneVerified: true,
          idVerified: true,
          dealerVerified: false,
        },
      });
      const uid = String(u._id);
      bidderIds.push(uid);

      await creditDepositToWallet({
        userId: uid,
        amountKobo: nairaToKobo(500_000),
        reference: `CONC_DEP_${i}`,
        idempotencyKey: `conc-dep-${i}-${Date.now()}`,
      });
    }

    // Generate 50 concurrent bids across the 20 users with distinct escalating & interleaved maxBids
    // Highest maxBid will be placed by bidderIds[19] at N6,500,000, second highest at N6,400,000
    const concurrentProposals: { bidderId: string; maxBidKobo: number }[] = [];
    for (let idx = 0; idx < 50; idx++) {
      const userIndex = idx % numUsers;
      const maxBidKobo = nairaToKobo(1_100_000 + idx * 100_000); // From N1.1M up to N6.0M
      concurrentProposals.push({
        bidderId: bidderIds[userIndex]!,
        maxBidKobo,
      });
    }

    // Fire all 50 bids simultaneously via Promise.allSettled
    const results = await Promise.allSettled(
      concurrentProposals.map((p) =>
        placeBid({
          auctionId: String(auction._id),
          bidderId: p.bidderId,
          maxBidKobo: p.maxBidKobo,
        }),
      ),
    );

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    expect(fulfilled.length).toBeGreaterThan(0);

    // Inspect final auction state and bid history
    const finalAuction = await AuctionModel.findById(auction._id).lean();
    const allBids = await BidModel.find({ auctionId: auction._id })
      .sort({ sequence: 1 })
      .lean();

    expect(finalAuction).toBeTruthy();
    // Bid count must equal the exact number of Bid documents persisted
    expect(finalAuction!.bidCount).toBe(allBids.length);

    // Sequences must be strictly 1..N with zero gaps or duplicates
    const sequences = allBids.map((b) => b.sequence);
    expect(sequences).toEqual(Array.from({ length: allBids.length }, (_, i) => i + 1));

    // Bid amounts must be monotonically non-decreasing across sequence 1..N
    for (let i = 1; i < allBids.length; i++) {
      expect(allBids[i]!.amountKobo).toBeGreaterThanOrEqual(allBids[i - 1]!.amountKobo);
    }

    // Final auction currentPrice must equal the highest recorded bid amount
    const highestRecordedBid = allBids[allBids.length - 1]!;
    expect(finalAuction!.currentPrice).toBe(highestRecordedBid.amountKobo);

    // The highest maxBid (idx=49 -> N6,000,000 by bidderIds[49 % 20 = 9]) must be the winning leader!
    expect(String(finalAuction!.leader?.userId)).toBe(bidderIds[49 % numUsers]);
    expect(finalAuction!.leader?.proxyMax).toBe(nairaToKobo(1_100_000 + 49 * 100_000));
  }, 60_000);

  it('completes Paystack deposit webhook idempotently, executes Buy Now, and settles with deposit release', async () => {
    // 1. Initialize deposit payment via API
    const initRes = await request(app)
      .post('/api/v1/payments/paystack/initialize')
      .set('Authorization', `Bearer ${bidderAToken}`)
      .send({
        amountKobo: nairaToKobo(100_000),
        purpose: 'bidding_deposit',
      });
    expect(initRes.status).toBe(201);
    const reference = initRes.body.reference as string;

    const walletBefore = await WalletAccountModel.findOne({ userId: bidderAId }).lean();
    const availBefore = walletBefore?.availableKobo ?? 0;

    // 2. Call Paystack webhook twice with same reference -> credits once idempotently
    const webhookRes1 = await request(app)
      .post('/api/v1/payments/paystack/webhook')
      .set('x-paystack-signature', 'mock-valid-signature')
      .send({
        event: 'charge.success',
        data: { reference, amount: nairaToKobo(100_000), status: 'success' },
      });
    expect(webhookRes1.status).toBe(200);
    expect(webhookRes1.body.alreadyProcessed).toBe(false);

    const webhookRes2 = await request(app)
      .post('/api/v1/payments/paystack/webhook')
      .set('x-paystack-signature', 'mock-valid-signature')
      .send({
        event: 'charge.success',
        data: { reference, amount: nairaToKobo(100_000), status: 'success' },
      });
    expect(webhookRes2.status).toBe(200);
    expect(webhookRes2.body.alreadyProcessed).toBe(true);

    const walletAfterWebhook = await WalletAccountModel.findOne({ userId: bidderAId }).lean();
    expect(walletAfterWebhook!.availableKobo).toBe(availBefore + nairaToKobo(100_000));

    // 3. Create auction with Buy Now price and execute Buy Now
    const buyNowAuctionDoc = await createTestAuction({
      startPrice: nairaToKobo(2_000_000),
      buyNowPrice: nairaToKobo(3_000_000),
    });

    const buyNowRes = await request(app)
      .post(`/api/v1/auctions/${String(buyNowAuctionDoc._id)}/buy-now`)
      .set('Authorization', `Bearer ${bidderAToken}`);
    expect(buyNowRes.status).toBe(200);
    expect(buyNowRes.body.auction.status).toBe('sold_pending_settlement');
    expect(buyNowRes.body.settlement.hammerPriceKobo).toBe(nairaToKobo(3_000_000));

    const settlementId = buyNowRes.body.settlement._id as string;

    // 4. Buyer and Seller both confirm settlement -> status becomes 'completed', winner deposit released
    const buyerConfirm = await request(app)
      .post(`/api/v1/settlements/${settlementId}/confirm`)
      .set('Authorization', `Bearer ${bidderAToken}`);
    expect(buyerConfirm.status).toBe(200);
    expect(buyerConfirm.body.settlement.status).toBe('buyer_confirmed');

    const sellerConfirm = await request(app)
      .post(`/api/v1/settlements/${settlementId}/confirm`)
      .set('Authorization', `Bearer ${sellerToken}`);
    expect(sellerConfirm.status).toBe(200);
    expect(sellerConfirm.body.settlement.status).toBe('completed');
  });
});

