import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { nairaToKobo } from '@autodey/shared';
import { createApp } from '../src/app.js';
import { connectDatabase, disconnectDatabase } from '../src/config/db.js';
import { ListingModel, NotificationModel, UserModel } from '../src/models/index.js';
import { runSeed } from '../src/seed/seedData.js';

const app = createApp();

async function loginWithPhone(phone: string): Promise<{ token: string; userId: string }> {
  const otpReq = await request(app).post('/api/v1/auth/otp/request').send({ phone });
  const verifyRes = await request(app)
    .post('/api/v1/auth/otp/verify')
    .send({ phone, code: otpReq.body.devOtpCode });
  return { token: verifyRes.body.accessToken, userId: verifyRes.body.user.id };
}

describe('Phase 5 — VIN Decoder & Mismatch Flagging, Customs Verification Adapter, Saved Search Alerts & 3-Car Compare', () => {
  let sellerToken = '';
  let sellerId = '';
  let buyerToken = '';
  let buyerId = '';
  let adminToken = '';
  let targetListingId = '';
  let secondListingId = '';
  let thirdListingId = '';

  beforeAll(async () => {
    await connectDatabase('autodey_test_phase5');
    await mongoose.connection.db?.dropDatabase();
    await runSeed();

    const sellerAuth = await loginWithPhone('08031000001'); // Berger Prime Auto Mart
    sellerToken = sellerAuth.token;
    sellerId = sellerAuth.userId;

    const buyerAuth = await loginWithPhone('08031000005'); // Abubakar
    buyerToken = buyerAuth.token;
    buyerId = buyerAuth.userId;

    const adminAuth = await loginWithPhone('08031000010'); // Platform Admin
    await UserModel.updateOne(
      { _id: adminAuth.userId },
      { $set: { roles: ['buyer', 'seller', 'moderator', 'admin'] } },
    );
    const adminReLogin = await loginWithPhone('08031000010');
    adminToken = adminReLogin.token;

    const sellerListings = await ListingModel.find({ sellerId }).limit(3).lean();
    targetListingId = String(sellerListings[0]!._id);
    secondListingId = String(sellerListings[1]!._id);
    thirdListingId = String(sellerListings[2]!._id);
  }, 60_000);

  afterAll(async () => {
    await disconnectDatabase();
  });

  it('decodes 17-char VIN, detects make/year mismatches, and blocks duplicate active VINs across listings', async () => {
    // 1. Decode a valid 2018 Toyota Camry VIN (4T1BF1FK5JU123456: 4T1=Toyota, BF=Camry, J=2018)
    const decodeMatch = await request(app)
      .post('/api/v1/vehicles/decode-vin')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({
        vin: '4T1BF1FK5JU123456',
        make: 'Toyota',
        model: 'Camry',
        year: 2018,
      });

    expect(decodeMatch.status).toBe(200);
    expect(decodeMatch.body.validFormat).toBe(true);
    expect(decodeMatch.body.decoded.make).toBe('Toyota');
    expect(decodeMatch.body.decoded.year).toBe(2018);
    expect(decodeMatch.body.mismatchFlag).toBe(false);

    // 2. Decode with mismatched seller input (Honda 2022 vs Toyota 2018 VIN) -> flags mismatch
    const decodeMismatch = await request(app)
      .post('/api/v1/vehicles/decode-vin')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({
        vin: '4T1BF1FK5JU123456',
        make: 'Honda',
        model: 'Accord',
        year: 2022,
      });

    expect(decodeMismatch.status).toBe(200);
    expect(decodeMismatch.body.mismatchFlag).toBe(true);
    expect(decodeMismatch.body.mismatchReasons.length).toBeGreaterThan(0);

    // 3. Verify VIN on first listing and then attempt duplicate VIN on second active listing -> 409 DUPLICATE_ACTIVE_VIN
    await ListingModel.updateOne(
      { _id: targetListingId },
      { $set: { make: 'Toyota', model: 'Camry', year: 2018 } },
    );

    const uniqueVin = '4T1BF1FK5JU987654';
    const verifyRes1 = await request(app)
      .post(`/api/v1/listings/${targetListingId}/verify-vin`)
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ vin: uniqueVin });

    expect(verifyRes1.status).toBe(200);
    expect(verifyRes1.body.vinCheckedBadge).toBe(true);

    const duplicateRes = await request(app)
      .post(`/api/v1/listings/${secondListingId}/verify-vin`)
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ vin: uniqueVin });

    expect(duplicateRes.status).toBe(409);
    expect(duplicateRes.body.error.code).toBe('DUPLICATE_ACTIVE_VIN');
  });

  it('queues customs duty papers via ManualAdminCustomsAdapter and unlocks customsReviewed badge on moderator approval', async () => {
    const uploadRes = await request(app)
      .post(`/api/v1/listings/${targetListingId}/documents`)
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({
        type: 'customs_duty',
        fileUrl: 'https://res.cloudinary.com/demo/image/upload/customs-duty-slip.pdf',
        customsReferenceNumber: 'NCS/APAPA/2026/88412',
      });

    expect(uploadRes.status).toBe(201);
    expect(uploadRes.body.document.status).toBe('pending');
    expect(uploadRes.body.customsReviewedBadge).toBe(false);

    const docId = uploadRes.body.document._id as string;

    // Moderator reviews & approves the customs document
    const reviewRes = await request(app)
      .patch(`/api/v1/documents/${docId}/review`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'approved' });

    expect(reviewRes.status).toBe(200);
    expect(reviewRes.body.document.status).toBe('approved');
    expect(reviewRes.body.listingBadges.customsReviewed).toBe(true);

    // Non-admin cannot upload partner inspection_report
    const sellerInspAttempt = await request(app)
      .post(`/api/v1/listings/${targetListingId}/documents`)
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({
        type: 'inspection_report',
        fileUrl: 'https://res.cloudinary.com/demo/image/upload/inspection-200pt.pdf',
      });
    expect(sellerInspAttempt.status).toBe(403);

    // Admin uploads partner inspection report -> unlocks inspected badge immediately
    const adminInspRes = await request(app)
      .post(`/api/v1/listings/${targetListingId}/documents`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        type: 'inspection_report',
        fileUrl: 'https://res.cloudinary.com/demo/image/upload/inspection-200pt.pdf',
        summary: '200-Point Engine, Transmission & Chassis Check Passed (94/100)',
      });
    expect(adminInspRes.status).toBe(201);
    expect(adminInspRes.body.inspectedBadge).toBe(true);
  });

  it('creates saved search alerts, dispatches notifications on matching listing, and compares 3 vehicles side by side', async () => {
    const createSavedRes = await request(app)
      .post('/api/v1/saved-searches')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({
        name: 'Toyota Camry Under ₦25M in Lagos',
        filters: {
          make: 'Toyota',
          model: 'Camry',
          maxPriceKobo: nairaToKobo(25_000_000),
        },
        channels: { inApp: true, email: true, sms: false, push: true },
      });

    expect(createSavedRes.status).toBe(201);
    const savedSearchId = createSavedRes.body.savedSearch._id as string;

    // Trigger saved search matching against targetListingId (which is a 2018 Toyota Camry)
    const triggerRes = await request(app)
      .post(`/api/v1/saved-searches/trigger/${targetListingId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(triggerRes.status).toBe(200);
    expect(triggerRes.body.matchedCount).toBeGreaterThanOrEqual(1);

    const buyerNotifs = await NotificationModel.find({
      userId: buyerId,
      title: /Saved Search Match/i,
    }).lean();
    expect(buyerNotifs.length).toBeGreaterThanOrEqual(1);

    // Compare 3 vehicles side-by-side
    const compareRes = await request(app).get(
      `/api/v1/compare?ids=${targetListingId},${secondListingId},${thirdListingId}`,
    );
    expect(compareRes.status).toBe(200);
    expect(compareRes.body.vehicles).toHaveLength(3);
    expect(compareRes.body.vehicles[0].badges.vinChecked).toBe(true);
    expect(compareRes.body.vehicles[0].badges.customsReviewed).toBe(true);
    expect(compareRes.body.vehicles[0].badges.inspected).toBe(true);

    // Delete saved search
    const delRes = await request(app)
      .delete(`/api/v1/saved-searches/${savedSearchId}`)
      .set('Authorization', `Bearer ${buyerToken}`);
    expect(delRes.status).toBe(200);
    expect(delRes.body.deleted).toBe(true);
  });
});

