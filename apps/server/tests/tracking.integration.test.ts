import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import {
  confirmTrackingSent,
  expireAbandonedTrackingRecords,
} from '../src/modules/tracking/tracking.service.js';

const runIntegration = process.env.RUN_DB_INTEGRATION_TESTS === 'true';
const testDbUrl = process.env.TEST_DATABASE_URL ?? '';

describe.skipIf(!runIntegration)('PostgreSQL Integration Suite (Dedicated Test DB)', () => {
  const app = createApp();
  let testPrisma: PrismaClient;
  let user1Id = '';
  let user1Token = '';
  let user2Token = '';
  const createdUserIds: string[] = [];

  beforeAll(async () => {
    if (!testDbUrl || !/test/i.test(testDbUrl)) {
      throw new Error(
        'TEST_DATABASE_URL must be set to a dedicated test database (e.g., mailtrack_test) when RUN_DB_INTEGRATION_TESTS=true',
      );
    }
    process.env.DATABASE_URL = testDbUrl;

    testPrisma = new PrismaClient({ datasources: { db: { url: testDbUrl } } });
    await testPrisma.$queryRaw`SELECT 1`;

    const u1 = await request(app)
      .post('/api/auth/register')
      .send({
        email: `int-u1-${Date.now()}@example.com`,
        password: 'Password123!',
      });
    if (u1.status === 201 && u1.body?.user?.id) {
      createdUserIds.push(u1.body.user.id as string);
    }
    if (u1.status !== 201) {
      throw new Error(`u1 registration failed (${u1.status}): ${JSON.stringify(u1.body)}`);
    }

    const u2 = await request(app)
      .post('/api/auth/register')
      .send({
        email: `int-u2-${Date.now()}@example.com`,
        password: 'Password123!',
      });
    if (u2.status === 201 && u2.body?.user?.id) {
      createdUserIds.push(u2.body.user.id as string);
    }
    if (u2.status !== 201) {
      throw new Error(`u2 registration failed (${u2.status}): ${JSON.stringify(u2.body)}`);
    }

    user1Id = u1.body.user.id as string;
    user1Token = u1.body.accessToken as string;
    user2Token = u2.body.accessToken as string;
  }, 30_000);

  afterAll(async () => {
    if (!testPrisma) {
      return;
    }
    try {
      if (createdUserIds.length > 0) {
        await testPrisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
      }
    } finally {
      await testPrisma.$disconnect();
    }
  }, 30_000);

  it('verifies health, registration, strict SENT rejection, pixel persistence, ownership, and expiration', async () => {
    const health = await request(app).get('/health');
    expect(health.status).toBe(200);
    expect(health.body.database).toBe('connected');

    const reg = await request(app)
      .post('/api/tracking/register')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ recipientReference: 'lead@example.com', subject: 'Integration Test' });
    expect(reg.status).toBe(201);

    const { trackingId, pixelUrl } = reg.body as { trackingId: string; pixelUrl: string };
    const rawToken = pixelUrl.split('/api/track/')[1]!;

    // Extension cannot self-assert SENT
    const sentRejected = await request(app)
      .patch(`/api/tracking/emails/${trackingId}/status`)
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ status: 'SENT' });
    expect(sentRejected.status).toBe(403);

    const dispatched = await request(app)
      .patch(`/api/tracking/emails/${trackingId}/status`)
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ status: 'DISPATCHED' });
    expect(dispatched.status).toBe(200);
    expect(dispatched.body.status).toBe('DISPATCHED');

    // Concurrent pixel hits
    await Promise.all([
      request(app).get(`/api/track/${rawToken}`).set('User-Agent', 'Mozilla/5.0 Chrome/125.0.0.0'),
      request(app)
        .get(`/api/track/${rawToken}`)
        .set('User-Agent', 'Mozilla/5.0 (via ggpht.com GoogleImageProxy)'),
    ]);
    // Poll until both asynchronous pixel persistence writes commit (max 15000ms)
    const pollDeadline = Date.now() + 15000;
    let detail = await request(app)
      .get(`/api/tracking/emails/${trackingId}`)
      .set('Authorization', `Bearer ${user1Token}`);

    while (
      (detail.status !== 200 || (detail.body?.events?.length ?? 0) < 2) &&
      Date.now() < pollDeadline
    ) {
      await new Promise((r) => setTimeout(r, 250));
      detail = await request(app)
        .get(`/api/tracking/emails/${trackingId}`)
        .set('Authorization', `Bearer ${user1Token}`);
    }

    if (detail.status !== 200 || (detail.body?.events?.length ?? 0) !== 2) {
      throw new Error(
        `Timed out after 15000ms waiting for 2 TrackingEvents; status=${detail.status}, found=${detail.body?.events?.length ?? 0}`,
      );
    }

    expect(detail.status).toBe(200);
    expect(detail.body.events.length).toBe(2);

    // Ownership check
    const readDenied = await request(app)
      .get(`/api/tracking/emails/${trackingId}`)
      .set('Authorization', `Bearer ${user2Token}`);
    expect(readDenied.status).toBe(404);

    // Trusted SENT confirmation is never expired
    await confirmTrackingSent(user1Id, trackingId, {
      provider: 'GMAIL_API',
      externalMessageId: 'gmail-msg-integration',
    });

    // Register a second PENDING record and verify expiration
    const pendingReg = await request(app)
      .post('/api/tracking/register')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ recipientReference: 'abandoned@example.com' });
    const pendingId = (pendingReg.body as { trackingId: string }).trackingId;

    const expiredCount = await expireAbandonedTrackingRecords(
      new Date(Date.now() + 30 * 24 * 3600 * 1000),
    );
    expect(expiredCount).toBeGreaterThanOrEqual(1);

    const expiredDetail = await request(app)
      .get(`/api/tracking/emails/${pendingId}`)
      .set('Authorization', `Bearer ${user1Token}`);
    expect(expiredDetail.body.status).toBe('EXPIRED');

    const sentDetail = await request(app)
      .get(`/api/tracking/emails/${trackingId}`)
      .set('Authorization', `Bearer ${user1Token}`);
    expect(sentDetail.body.status).toBe('SENT');
  }, 45_000);
});
