import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { nairaToKobo } from '@autodey/shared';
import { createApp } from '../src/app.js';
import { connectDatabase, disconnectDatabase } from '../src/config/db.js';
import { ListingModel } from '../src/models/index.js';
import { runSeed } from '../src/seed/seedData.js';

const app = createApp();

async function loginWithPhone(phone: string): Promise<{ token: string; userId: string }> {
  const otpReq = await request(app).post('/api/v1/auth/otp/request').send({ phone });
  const verifyRes = await request(app)
    .post('/api/v1/auth/otp/verify')
    .send({ phone, code: otpReq.body.devOtpCode });
  return { token: verifyRes.body.accessToken, userId: verifyRes.body.user.id };
}

describe('Phase 3 API — Chat, Structured Offers, Inspection Scheduler, Phone Reveal, Dashboard, Reviews & Auto-Hide Reports', () => {
  let sellerToken = '';
  let sellerId = '';
  let buyer1Token = '';
  let buyer2Token = '';
  let buyer3Token = '';
  let targetListingId = '';
  let conversationId = '';

  beforeAll(async () => {
    await connectDatabase('autodey_test_phase3');
    await mongoose.connection.db?.dropDatabase();
    await runSeed();

    // Seller: Berger Prime Auto Mart (+2348031000001)
    const sellerAuth = await loginWithPhone('08031000001');
    sellerToken = sellerAuth.token;
    sellerId = sellerAuth.userId;

    // Buyers
    const b1 = await loginWithPhone('08031000005'); // Abubakar
    buyer1Token = b1.token;
    const b2 = await loginWithPhone('08031000006'); // Olamide
    buyer2Token = b2.token;
    const b3 = await loginWithPhone('08031000007'); // Tamuno
    buyer3Token = b3.token;

    const sellerListing = await ListingModel.findOne({ sellerId, status: 'active' }).lean();
    targetListingId = sellerListing!._id.toString();
  }, 45_000);

  afterAll(async () => {
    await mongoose.connection.db?.dropDatabase();
    await disconnectDatabase();
  });

  it('starts a conversation, sends messages, and updates seller response-time stats', async () => {
    const startRes = await request(app)
      .post('/api/v1/conversations')
      .set('Authorization', `Bearer ${buyer1Token}`)
      .send({
        listingId: targetListingId,
        initialMessage: 'Hello boss, can I inspect this vehicle tomorrow morning?',
      });

    expect(startRes.status).toBe(201);
    conversationId = startRes.body.conversation.id;

    // Seller replies
    const replyRes = await request(app)
      .post(`/api/v1/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({
        type: 'text',
        body: 'Yes boss, we are open from 8:00 AM at Ojodu Berger.',
      });
    expect(replyRes.status).toBe(201);

    const msgsRes = await request(app)
      .get(`/api/v1/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${buyer1Token}`);
    expect(msgsRes.status).toBe(200);
    expect(msgsRes.body.messages.length).toBe(2);
    expect(msgsRes.body.safeLocations.length).toBeGreaterThan(0);
  });

  it('supports structured offers (create, counter, accept) and safe inspection scheduling', async () => {
    const offerRes = await request(app)
      .post(`/api/v1/conversations/${conversationId}/offers`)
      .set('Authorization', `Bearer ${buyer1Token}`)
      .send({ amountKobo: nairaToKobo(16_500_000) });

    expect(offerRes.status).toBe(201);
    const offerId = offerRes.body.offer.id;

    const counterRes = await request(app)
      .patch(`/api/v1/offers/${offerId}`)
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({
        action: 'counter',
        counterAmountKobo: nairaToKobo(17_800_000),
      });
    expect(counterRes.status).toBe(200);
    expect(counterRes.body.offer.status).toBe('countered');

    const acceptRes = await request(app)
      .patch(`/api/v1/offers/${offerId}`)
      .set('Authorization', `Bearer ${buyer1Token}`)
      .send({ action: 'accept' });
    expect(acceptRes.status).toBe(200);
    expect(acceptRes.body.offer.status).toBe('accepted');

    // Propose & accept inspection
    const inspRes = await request(app)
      .post(`/api/v1/conversations/${conversationId}/inspection`)
      .set('Authorization', `Bearer ${buyer1Token}`)
      .send({
        location: 'Ikeja City Mall (ICM) Car Park — Alausa, Ikeja (CCTV & Security)',
        scheduledAt: new Date(Date.now() + 86400 * 1000).toISOString(),
      });
    expect(inspRes.status).toBe(201);
    expect(inspRes.body.inspectionProposal.status).toBe('proposed');

    const acceptInspRes = await request(app)
      .patch(`/api/v1/conversations/${conversationId}/inspection`)
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ status: 'accepted' });
    expect(acceptInspRes.status).toBe(200);
    expect(acceptInspRes.body.inspectionProposal.status).toBe('accepted');
  });

  it('reveals seller phone number (rate-limited) and increments Seller Dashboard analytics', async () => {
    const revealRes = await request(app)
      .post(`/api/v1/listings/${targetListingId}/reveal-phone`)
      .set('Authorization', `Bearer ${buyer1Token}`);

    expect(revealRes.status).toBe(200);
    expect(revealRes.body.phone).toBe('+2348031000001');
    expect(revealRes.body.whatsappUrl).toContain('wa.me/');

    const dashRes = await request(app)
      .get('/api/v1/seller/dashboard')
      .set('Authorization', `Bearer ${sellerToken}`);

    expect(dashRes.status).toBe(200);
    expect(dashRes.body.summary.phoneReveals).toBeGreaterThan(0);
    expect(dashRes.body.summary.chatStarts).toBeGreaterThan(0);
  });

  it('enforces interaction-gated reviews (blocks non-interacted user, allows 1 review per interaction)', async () => {
    // Buyer 3 has NOT chatted with seller -> must be rejected with 403
    const unauthorizedReview = await request(app)
      .post('/api/v1/reviews')
      .set('Authorization', `Bearer ${buyer3Token}`)
      .send({
        sellerId,
        listingId: targetListingId,
        interactionType: 'chat',
        rating: 5,
        comment: 'Attempting to review without chatting.',
      });
    expect(unauthorizedReview.status).toBe(403);

    // Buyer 1 HAS chatted with seller -> succeeds with 201
    const validReview = await request(app)
      .post('/api/v1/reviews')
      .set('Authorization', `Bearer ${buyer1Token}`)
      .send({
        sellerId,
        listingId: targetListingId,
        interactionType: 'chat',
        interactionRefId: conversationId,
        rating: 5,
        comment: 'Responsive dealer, agreed to meet at Ikeja City Mall with customs papers.',
      });
    expect(validReview.status).toBe(201);

    // Second review for the same interaction -> rejected with 409 DUPLICATE_REVIEW
    const duplicateReview = await request(app)
      .post('/api/v1/reviews')
      .set('Authorization', `Bearer ${buyer1Token}`)
      .send({
        sellerId,
        listingId: targetListingId,
        interactionType: 'chat',
        interactionRefId: conversationId,
        rating: 4,
        comment: 'Second review on same conversation.',
      });
    expect(duplicateReview.status).toBe(409);
  });

  it('auto-hides a listing after 3 unique user reports and delivers in-app notifications', async () => {
    const r1 = await request(app)
      .post('/api/v1/reports')
      .set('Authorization', `Bearer ${buyer1Token}`)
      .send({
        targetType: 'listing',
        targetId: targetListingId,
        reason: 'wrong_price_or_bait',
      });
    expect(r1.status).toBe(201);
    expect(r1.body.autoHidden).toBe(false);

    const r2 = await request(app)
      .post('/api/v1/reports')
      .set('Authorization', `Bearer ${buyer2Token}`)
      .send({
        targetType: 'listing',
        targetId: targetListingId,
        reason: 'fake_customs_documents',
      });
    expect(r2.status).toBe(201);
    expect(r2.body.autoHidden).toBe(false);

    const r3 = await request(app)
      .post('/api/v1/reports')
      .set('Authorization', `Bearer ${buyer3Token}`)
      .send({
        targetType: 'listing',
        targetId: targetListingId,
        reason: 'scam_or_advance_fee',
      });
    expect(r3.status).toBe(201);
    expect(r3.body.autoHidden).toBe(true);

    const hiddenListing = await ListingModel.findById(targetListingId).lean();
    expect(hiddenListing?.status).toBe('pending_review');
    expect(hiddenListing?.moderationFlags).toContain('AUTO_HIDDEN_REPORTS_THRESHOLD');

    // Check notifications for seller
    const notifRes = await request(app)
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${sellerToken}`);
    expect(notifRes.status).toBe(200);
    expect(notifRes.body.items.length).toBeGreaterThan(0);
  });
});

