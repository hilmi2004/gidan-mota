import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';
import { connectDatabase, disconnectDatabase } from '../src/config/db.js';
import { KycRecordModel } from '../src/models/index.js';

const app = createApp();

describe('Phase 1 API — Auth (Phone OTP + Refresh Rotation), Profiles, KYC & NDPA', () => {
  beforeAll(async () => {
    await connectDatabase('autodey_test_phase1');
    await mongoose.connection.db?.dropDatabase();
  }, 60_000);

  afterAll(async () => {
    await mongoose.connection.db?.dropDatabase();
    await disconnectDatabase();
  });

  let accessToken = '';
  let refreshToken = '';
  let userId = '';

  it('returns 200 on /health and /ready', async () => {
    const health = await request(app).get('/health');
    expect(health.status).toBe(200);
    expect(health.body.status).toBe('ok');

    const ready = await request(app).get('/ready');
    expect(ready.status).toBe(200);
    expect(ready.body.ready).toBe(true);
  });

  it('completes Phone OTP signup and issues JWT access + rotated refresh token', async () => {
    const otpReq = await request(app)
      .post('/api/v1/auth/otp/request')
      .send({ phone: '0803 555 0199' });

    expect(otpReq.status).toBe(200);
    expect(otpReq.body.devOtpCode).toMatch(/^\d{6}$/);

    const verifyRes = await request(app)
      .post('/api/v1/auth/otp/verify')
      .send({
        phone: '08035550199',
        code: otpReq.body.devOtpCode,
        displayName: 'Chinedu Okafor',
        email: 'chinedu@autodey.ng',
      });

    expect(verifyRes.status).toBe(201);
    expect(verifyRes.body.accessToken).toBeTruthy();
    expect(verifyRes.body.user.verification.phoneVerified).toBe(true);
    expect(verifyRes.body.user.displayName).toBe('Chinedu Okafor');

    accessToken = verifyRes.body.accessToken;
    refreshToken = verifyRes.body.refreshToken;
    userId = verifyRes.body.user.id;
  });

  it('rotates refresh token and blocks replay of old refresh token (reuse detection)', async () => {
    const refreshRes = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken });

    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.accessToken).toBeTruthy();
    expect(refreshRes.body.refreshToken).not.toBe(refreshToken);

    const newRefreshToken = refreshRes.body.refreshToken;
    accessToken = refreshRes.body.accessToken;

    // Replaying the old refresh token must fail and revoke the family
    const replayRes = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken });
    expect(replayRes.status).toBe(401);

    // Even the newly rotated token in that compromised family is now revoked
    const familyRevokedRes = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: newRefreshToken });
    expect(familyRevokedRes.status).toBe(401);
  });

  it('updates user profile and verifies KYC without storing raw NIN/BVN in DB', async () => {
    const patchRes = await request(app)
      .patch('/api/v1/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        displayName: 'Chinedu Okafor (Lekki)',
        bio: 'Importer of clean US-spec Tokunbo Toyota and Lexus vehicles.',
        state: 'Lagos',
        lga: 'Lekki',
      });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.user.state).toBe('Lagos');

    const rawTestNin = '72910482911';
    const kycRes = await request(app)
      .post('/api/v1/users/me/kyc')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        documentType: 'nin',
        idNumber: rawTestNin,
        firstName: 'Chinedu',
        lastName: 'Okafor',
      });

    expect(kycRes.status).toBe(200);
    expect(kycRes.body.verification.idVerified).toBe(true);
    expect(kycRes.body.kycRecord.providerReference).toMatch(/^KYC-MOCK-/);

    // Verify raw NIN is NEVER stored in the KycRecord collection
    const storedRecord = await KycRecordModel.findOne({ userId }).lean();
    expect(storedRecord).toBeTruthy();
    expect(JSON.stringify(storedRecord)).not.toContain(rawTestNin);
  });

  it('submits a Verified Dealer CAC application and returns public profile with badges', async () => {
    const dealerRes = await request(app)
      .post('/api/v1/users/me/dealer-application')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        businessName: 'Okafor Premier Motors Lekki',
        cacNumber: 'RC-1849201',
        address: 'Plot 14, Lekki-Epe Expressway, Jakande, Lagos',
        state: 'Lagos',
        lga: 'Lekki',
        shopPhotos: ['https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=800'],
      });

    expect(dealerRes.status).toBe(201);
    expect(dealerRes.body.dealerProfile.cacNumber).toBe('RC-1849201');

    const pubRes = await request(app).get(`/api/v1/users/${userId}/profile`);
    expect(pubRes.status).toBe(200);
    expect(pubRes.body.profile.badges.phoneVerified).toBe(true);
    expect(pubRes.body.profile.badges.idVerified).toBe(true);
    expect(pubRes.body.profile.phoneMasked).toContain('***');
  });

  it('exports NDPA 2023 user data package', async () => {
    const exportRes = await request(app)
      .get('/api/v1/users/me/export')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(exportRes.status).toBe(200);
    expect(exportRes.body.complianceFramework).toContain('NDPA');
    expect(exportRes.body.kycRecords.length).toBe(1);
  });
});

