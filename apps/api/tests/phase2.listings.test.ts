import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { nairaToKobo } from '@autodey/shared';
import { createApp } from '../src/app.js';
import { connectDatabase, disconnectDatabase } from '../src/config/db.js';
import { runSeed } from '../src/seed/seedData.js';

const app = createApp();

describe('Phase 2 API — 40-Listing Seed, Search/Synonyms, Auto-Moderation, Fair-Price, Favorites & SEO', () => {
  let accessToken = '';

  beforeAll(async () => {
    await connectDatabase('autodey_test_phase2');
    await mongoose.connection.db?.dropDatabase();
    await runSeed();

    const otpReq = await request(app)
      .post('/api/v1/auth/otp/request')
      .send({ phone: '08031000004' });
    const verifyRes = await request(app)
      .post('/api/v1/auth/otp/verify')
      .send({ phone: '08031000004', code: otpReq.body.devOtpCode });
    accessToken = verifyRes.body.accessToken;
  }, 45_000);

  afterAll(async () => {
    await mongoose.connection.db?.dropDatabase();
    await disconnectDatabase();
  });

  it('returns seeded listings and supports Nigerian car synonyms ("benz", "tokunbo")', async () => {
    const allRes = await request(app).get('/api/v1/search?limit=50');
    expect(allRes.status).toBe(200);
    expect(allRes.body.totalCount).toBe(40);
    expect(allRes.body.items.length).toBe(40);

    const benzRes = await request(app).get('/api/v1/search?q=benz');
    expect(benzRes.status).toBe(200);
    expect(benzRes.body.items.length).toBeGreaterThanOrEqual(4);
    expect(benzRes.body.items[0].make).toBe('Mercedes-Benz');

    const auctionRes = await request(app).get('/api/v1/search?auctionOnly=true');
    expect(auctionRes.status).toBe(200);
    expect(auctionRes.body.totalCount).toBe(6);
  });

  it('returns listing detail with 6 guided-angle photos and Fair Price market insight', async () => {
    const searchCamry = await request(app).get('/api/v1/search?make=Toyota&model=Camry');
    expect(searchCamry.body.items.length).toBeGreaterThanOrEqual(5);
    const camrySlug = searchCamry.body.items[0].slug;

    const detailRes = await request(app).get(`/api/v1/listings/${camrySlug}`);
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.media.length).toBe(6);
    expect(detailRes.body.fairPriceInsight.available).toBe(true);
    expect(detailRes.body.fairPriceInsight.comparableCount).toBeGreaterThanOrEqual(5);
    expect(detailRes.body.fairPriceInsight.medianPriceKobo).toBeGreaterThan(0);
  });

  it('creates a clean 6-photo listing as active, blocks duplicate active VIN, and flags banned words', async () => {
    const samplePhotos = ['front', 'rear', 'left', 'right', 'interior', 'dashboard'].map(
      (angle, order) => ({
        url: `https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?w=800&sig=${order}`,
        angle,
        order,
        perceptualHash: `unique_hash_${order}`,
      }),
    );

    const createRes = await request(app)
      .post('/api/v1/listings')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        category: 'cars',
        make: 'Toyota',
        model: 'Camry',
        trim: 'XSE',
        year: 2018,
        condition: 'foreign_used',
        mileageKm: 55000,
        transmission: 'automatic',
        fuelType: 'petrol',
        bodyType: 'sedan',
        driveSide: 'lhd',
        exteriorColor: 'White',
        state: 'Lagos',
        lga: 'Lekki',
        vin: '1HGCM82633A004352',
        customsStatus: 'yes',
        accidentHistory: 'none',
        priceKobo: nairaToKobo(18_200_000),
        negotiable: true,
        swapAccepted: false,
        description:
          'Super clean direct US Tokunbo 2018 Toyota Camry XSE available for inspection in Lekki Phase 1.',
        features: ['Factory Ice-Cold AC', 'Reverse Camera'],
        photos: samplePhotos,
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.listing.status).toBe('active');
    expect(createRes.body.listing.badges.vinChecked).toBe(true);

    // Duplicate active VIN must be blocked with 409
    const dupVinRes = await request(app)
      .post('/api/v1/listings')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        category: 'cars',
        make: 'Toyota',
        model: 'Camry',
        year: 2018,
        condition: 'foreign_used',
        mileageKm: 60000,
        transmission: 'automatic',
        fuelType: 'petrol',
        bodyType: 'sedan',
        exteriorColor: 'Black',
        state: 'Lagos',
        lga: 'Ikeja',
        vin: '1HGCM82633A004352',
        customsStatus: 'yes',
        priceKobo: nairaToKobo(17_900_000),
        description: 'Another listing attempting to reuse the same active VIN.',
        photos: samplePhotos,
      });
    expect(dupVinRes.status).toBe(409);
    expect(dupVinRes.body.error.code).toBe('DUPLICATE_ACTIVE_VIN');

    // Listing with phone number or banned phrase in description is queued as pending_review
    const flaggedRes = await request(app)
      .post('/api/v1/listings')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        category: 'cars',
        make: 'Honda',
        model: 'Accord',
        year: 2017,
        condition: 'foreign_used',
        mileageKm: 71000,
        transmission: 'automatic',
        fuelType: 'petrol',
        bodyType: 'sedan',
        exteriorColor: 'Silver',
        state: 'Abuja',
        lga: 'Wuse',
        customsStatus: 'yes',
        priceKobo: nairaToKobo(14_000_000),
        description: 'Call me directly on 08031234567 and pay before inspection to reserve this car.',
        photos: samplePhotos,
      });
    expect(flaggedRes.status).toBe(201);
    expect(flaggedRes.body.listing.status).toBe('pending_review');
    expect(flaggedRes.body.listing.moderationFlags.length).toBeGreaterThanOrEqual(2);
  });

  it('toggles favorites and renders OpenGraph SEO preview for WhatsApp crawlers', async () => {
    const listRes = await request(app).get('/api/v1/search?limit=1');
    const firstItem = listRes.body.items[0];

    const favRes = await request(app)
      .post(`/api/v1/favorites/${firstItem.id}`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(favRes.status).toBe(200);
    expect(favRes.body.favorited).toBe(true);

    const myFavs = await request(app)
      .get('/api/v1/favorites')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(myFavs.status).toBe(200);
    expect(myFavs.body.items.length).toBe(1);

    const seoRes = await request(app).get(`/api/v1/seo/listings/${firstItem.slug}`);
    expect(seoRes.status).toBe(200);
    expect(seoRes.text).toContain('property="og:title"');
    expect(seoRes.text).toContain('property="product:price:currency" content="NGN"');
  });
});

