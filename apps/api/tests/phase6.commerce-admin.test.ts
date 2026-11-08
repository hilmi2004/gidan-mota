import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';
import { connectDatabase, disconnectDatabase } from '../src/config/db.js';
import {
  AuctionAuditLogModel,
  AuctionModel,
  BidModel,
  ListingModel,
  UserModel,
} from '../src/models/index.js';
import { runSeed } from '../src/seed/seedData.js';

const app = createApp();

async function loginWithPhone(phone: string): Promise<{ token: string; userId: string }> {
  const otpReq = await request(app).post('/api/v1/auth/otp/request').send({ phone });
  const verifyRes = await request(app)
    .post('/api/v1/auth/otp/verify')
    .send({ phone, code: otpReq.body.devOtpCode });
  return { token: verifyRes.body.accessToken, userId: verifyRes.body.user.id };
}

describe('Phase 6 — Promotions Checkout, Dealer Plans & Storefronts, Admin Console, Anti-Shill Audit & Runtime Config', () => {
  let sellerToken = '';
  let sellerId = '';
  let buyerId = '';
  let adminToken = '';
  let targetListingId = '';

  beforeAll(async () => {
    await connectDatabase('autodey_test_phase6');
    await mongoose.connection.db?.dropDatabase();
    await runSeed();

    const sellerAuth = await loginWithPhone('08031000001');
    sellerToken = sellerAuth.token;
    sellerId = sellerAuth.userId;

    const buyerAuth = await loginWithPhone('08031000005');
    buyerId = buyerAuth.userId;

    const adminAuth = await loginWithPhone('08031000010');
    await UserModel.updateOne(
      { _id: adminAuth.userId },
      { $set: { roles: ['buyer', 'seller', 'moderator', 'admin'] } },
    );
    const adminReLogin = await loginWithPhone('08031000010');
    adminToken = adminReLogin.token;

    const sellerListing = await ListingModel.findOne({ sellerId }).lean();
    targetListingId = String(sellerListing!._id);
  }, 60_000);

  afterAll(async () => {
    await disconnectDatabase();
  });

  it('activates listing promotions (Top Ad, Urgent) from dynamic config and subscribes dealer storefronts', async () => {
    const pricingRes = await request(app).get('/api/v1/pricing/config');
    expect(pricingRes.status).toBe(200);
    expect(pricingRes.body.promotions.top_ad.priceKobo).toBeGreaterThan(0);

    // Promote listing as Top Ad
    const promoRes = await request(app)
      .post('/api/v1/promotions/checkout')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({
        listingId: targetListingId,
        type: 'top_ad',
      });
    expect(promoRes.status).toBe(201);
    expect(promoRes.body.promotion.type).toBe('top_ad');

    const updatedListing = await ListingModel.findById(targetListingId).lean();
    expect(updatedListing?.promotion?.topAdUntil).toBeDefined();

    // Subscribe Seller to Pro Dealer Plan & create storefront
    const subRes = await request(app)
      .post('/api/v1/dealers/subscribe')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({
        planTier: 'pro',
        businessName: 'Berger Sovereign Motors Ltd',
        cacNumber: 'RC-8829104',
        address: 'Plot 22 Berger Auto Mart, Ojodu',
        state: 'Lagos',
        lga: 'Ikeja',
        openingHours: 'Mon-Sat 8am - 6pm',
      });

    expect(subRes.status).toBe(201);
    expect(subRes.body.dealerProfile.planTier).toBe('pro');
    const slug = subRes.body.dealerProfile.slug as string;

    // Fetch public dealer storefront and verify inventory + leadStats
    const storefrontRes = await request(app).get(`/api/v1/dealers/${slug}`);
    expect(storefrontRes.status).toBe(200);
    expect(storefrontRes.body.dealer.businessName).toBe('Berger Sovereign Motors Ltd');
    expect(storefrontRes.body.inventory.length).toBeGreaterThan(0);
    expect(storefrontRes.body.leadStats).toBeDefined();
  });

  it('moderates flagged listings, approves dealer CAC, detects anti-shill IP overlap in auction audit, and logs runtime config edits', async () => {
    // Flag a listing and moderate it
    await ListingModel.findByIdAndUpdate(targetListingId, {
      $set: { status: 'pending_review', moderationFlags: ['PRICE_ANOMALY_LOW'] },
    });

    const modQueue = await request(app)
      .get('/api/v1/admin/moderation/listings')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(modQueue.status).toBe(200);
    expect(modQueue.body.listings.some((l: { _id: string }) => l._id === targetListingId)).toBe(
      true,
    );

    const modApprove = await request(app)
      .patch(`/api/v1/admin/moderation/listings/${targetListingId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ action: 'approve', reason: 'Verified clean title' });
    expect(modApprove.status).toBe(200);
    expect(modApprove.body.listing.status).toBe('active');

    // Approve Dealer CAC
    const usersDealers = await request(app)
      .get('/api/v1/admin/users')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(usersDealers.status).toBe(200);
    const dealerProfileId = usersDealers.body.dealerApplications[0]._id as string;

    const cacReview = await request(app)
      .patch(`/api/v1/admin/dealers/${dealerProfileId}/review`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'approved' });
    expect(cacReview.status).toBe(200);
    expect(cacReview.body.dealer.status).toBe('approved');

    // Create two bids sharing the same IP hash from different users on an auction to test Anti-Shill detection
    const liveAuction = await AuctionModel.findOne({ status: 'live' }).lean();
    expect(liveAuction).toBeTruthy();
    const auctionId = String(liveAuction!._id);

    await BidModel.create([
      {
        auctionId: liveAuction!._id,
        bidderId: new mongoose.Types.ObjectId(sellerId),
        maskedBidderName: 'B***1',
        amountKobo: 11_000_000_00,
        type: 'manual',
        ipHash: 'shared-ip-hash-999',
        deviceFingerprintHash: 'device-fp-alpha',
        sequence: 901,
      },
      {
        auctionId: liveAuction!._id,
        bidderId: new mongoose.Types.ObjectId(buyerId),
        maskedBidderName: 'A***5',
        amountKobo: 12_200_000_00,
        type: 'proxy',
        ipHash: 'shared-ip-hash-999',
        deviceFingerprintHash: 'device-fp-alpha',
        sequence: 902,
      },
    ]);

    await AuctionAuditLogModel.create({
      auctionId: liveAuction!._id,
      bidderId: new mongoose.Types.ObjectId(buyerId),
      eventType: 'bid_placed',
      submittedMaxKobo: 13_000_000_00,
      resultingPriceKobo: 12_200_000_00,
      ipHash: 'shared-ip-hash-999',
      deviceFingerprintHash: 'device-fp-alpha',
    });

    const auditRes = await request(app)
      .get(`/api/v1/admin/auctions/${auctionId}/audit`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(auditRes.status).toBe(200);
    expect(auditRes.body.bids.length).toBeGreaterThanOrEqual(2);
    expect(auditRes.body.auditLogs.length).toBeGreaterThanOrEqual(1);
    expect(auditRes.body.auditLogs[0].submittedMaxKobo).toBeDefined();
    expect(auditRes.body.shillSignals.length).toBeGreaterThanOrEqual(2); // Both IP and device fingerprint overlap

    // Update runtime config and verify AuditLog records all admin mutations
    const cfgUpdate = await request(app)
      .put('/api/v1/admin/config')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        key: 'minDepositKobo',
        value: 15_000_000, // ₦150,000 in kobo
      });
    expect(cfgUpdate.status).toBe(200);

    const logsRes = await request(app)
      .get('/api/v1/admin/audit-logs')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(logsRes.status).toBe(200);
    const actions = logsRes.body.logs.map((l: { action: string }) => l.action);
    expect(actions).toContain('moderation.listing.approve');
    expect(actions).toContain('dealer.review.approved');
    expect(actions).toContain('config.update.minDepositKobo');
  });
});
