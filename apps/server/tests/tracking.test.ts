import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockEmailCreate,
  mockEmailFindUnique,
  mockEmailFindFirst,
  mockEmailFindMany,
  mockEmailCount,
  mockEmailGroupBy,
  mockEmailUpdate,
  mockEmailUpdateMany,
  mockEventCount,
  mockEventCreate,
  mockEventFindMany,
  mockEventGroupBy,
  mockTransaction,
} = vi.hoisted(() => ({
  mockEmailCreate: vi.fn(),
  mockEmailFindUnique: vi.fn(),
  mockEmailFindFirst: vi.fn(),
  mockEmailFindMany: vi.fn(),
  mockEmailCount: vi.fn(),
  mockEmailGroupBy: vi.fn(),
  mockEmailUpdate: vi.fn(),
  mockEmailUpdateMany: vi.fn(),
  mockEventCount: vi.fn(),
  mockEventCreate: vi.fn(),
  mockEventFindMany: vi.fn(),
  mockEventGroupBy: vi.fn(),
  mockTransaction: vi.fn(),
}));

vi.mock('../src/lib/prisma.js', () => ({
  prisma: {
    trackedEmail: {
      create: mockEmailCreate,
      findUnique: mockEmailFindUnique,
      findFirst: mockEmailFindFirst,
      findMany: mockEmailFindMany,
      count: mockEmailCount,
      groupBy: mockEmailGroupBy,
      update: mockEmailUpdate,
      updateMany: mockEmailUpdateMany,
    },
    trackingEvent: {
      count: mockEventCount,
      create: mockEventCreate,
      findMany: mockEventFindMany,
      groupBy: mockEventGroupBy,
    },
    $transaction: mockTransaction,
    $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
    $disconnect: vi.fn(),
  },
  checkDatabaseConnection: vi.fn().mockResolvedValue(true),
}));

import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { classifyTrackingRequest } from '../src/modules/tracking/classifier.js';
import {
  confirmTrackingSent,
  expireAbandonedTrackingRecords,
} from '../src/modules/tracking/tracking.service.js';
import { TRANSPARENT_1X1_PNG } from '../src/utils/pngPixel.js';
import { generateTrackingToken, hashTrackingToken } from '../src/utils/tokens.js';

function makeAuthHeader(userId: string, email: string, secret = env.JWT_ACCESS_SECRET): string {
  const token = jwt.sign({ sub: userId, email }, secret, {
    algorithm: 'HS256',
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
    expiresIn: '1h',
  });
  return `Bearer ${token}`;
}

describe('Tokens & Conservative Classifier', () => {
  it('generates unique 256-bit tokens and deterministic SHA-256 hashes', () => {
    const t1 = generateTrackingToken();
    const t2 = generateTrackingToken();
    expect(t1).not.toBe(t2);
    expect(t1.length).toBeGreaterThanOrEqual(42);
    expect(hashTrackingToken(t1)).not.toBe(t1);
    expect(hashTrackingToken(t1)).toBe(hashTrackingToken(t1));
    expect(hashTrackingToken(t1)).not.toBe(hashTrackingToken(t2));
  });

  it('classifies proxies, scanners, early interactive browsers, and unknown clients conservatively', () => {
    const sentAt = new Date('2026-11-14T10:00:00.000Z');
    const oneSecLater = new Date('2026-11-14T10:00:01.000Z');
    const tenMinLater = new Date('2026-11-14T10:10:00.000Z');

    expect(
      classifyTrackingRequest(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0.0.0',
        sentAt,
        oneSecLater,
      ),
    ).toBe('RECORDED');

    expect(classifyTrackingRequest('', sentAt, oneSecLater)).toBe('SUSPECTED_SCANNER');
    expect(classifyTrackingRequest('CustomMailClient/1.0', sentAt, tenMinLater)).toBe('RECORDED');
    expect(classifyTrackingRequest(undefined, null, tenMinLater)).toBe('RECORDED');

    expect(
      classifyTrackingRequest('Mozilla/5.0 (via ggpht.com GoogleImageProxy)', sentAt, tenMinLater),
    ).toBe('LIKELY_PROXY');
    expect(
      classifyTrackingRequest(
        'Mozilla/5.0 AppleWebKit/605.1.15 CFNetwork/1404',
        sentAt,
        tenMinLater,
      ),
    ).toBe('LIKELY_PROXY');
    expect(classifyTrackingRequest('Barracuda Sentinel', sentAt, tenMinLater)).toBe(
      'SUSPECTED_SCANNER',
    );
  });
});

describe('Tracking Lifecycle, Strict SENT Confirmation, Expiration & Security', () => {
  const app = createApp();

  beforeEach(() => {
    vi.clearAllMocks();
    mockTransaction.mockImplementation(async (ops: unknown[]) => ops);
  });

  it('validates JWTs strictly on protected endpoints', async () => {
    const missing = await request(app).post('/api/tracking/register').send({
      recipientReference: 'lead@example.com',
    });
    expect(missing.status).toBe(401);

    const malformed = await request(app)
      .post('/api/tracking/register')
      .set('Authorization', 'Bearer not-a-jwt')
      .send({ recipientReference: 'lead@example.com' });
    expect(malformed.status).toBe(401);

    const wrongSecret = await request(app)
      .post('/api/tracking/register')
      .set('Authorization', makeAuthHeader('u1', 'u1@example.com', 'wrong-secret-key-min-16-chars'))
      .send({ recipientReference: 'lead@example.com' });
    expect(wrongSecret.status).toBe(401);
  });

  it('rejects malformed registration and status payloads with 400', async () => {
    const auth = makeAuthHeader('user-1', 'sender@example.com');

    const badRegister = await request(app)
      .post('/api/tracking/register')
      .set('Authorization', auth)
      .send({ recipientReference: '' });
    expect(badRegister.status).toBe(400);

    const placeholderRegister = await request(app)
      .post('/api/tracking/register')
      .set('Authorization', auth)
      .send({ recipientReference: 'enter another email address that you can access.' });
    expect(placeholderRegister.status).toBe(400);

    const invalidEmailRegister = await request(app)
      .post('/api/tracking/register')
      .set('Authorization', auth)
      .send({ recipientReference: 'not-an-email' });
    expect(invalidEmailRegister.status).toBe(400);

    const badStatus = await request(app)
      .patch('/api/tracking/emails/trk-1/status')
      .set('Authorization', auth)
      .send({ status: 'PENDING' });
    expect(badStatus.status).toBe(400);
  });

  it('prevents extension/client requests from falsely marking a record SENT', async () => {
    const auth = makeAuthHeader('user-1', 'sender@example.com');

    const res = await request(app)
      .patch('/api/tracking/emails/trk-1/status')
      .set('Authorization', auth)
      .send({ status: 'SENT' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('SENT_CONFIRMATION_REQUIRES_TRUSTED_EVIDENCE');
    expect(mockEmailUpdate).not.toHaveBeenCalled();
  });

  it('allows trusted server-side SENT confirmation only with verified GMAIL_API evidence', async () => {
    const now = new Date();
    await expect(
      confirmTrackingSent('user-1', 'trk-1', {
        provider: 'GMAIL_API',
        externalMessageId: '   ',
      }),
    ).rejects.toMatchObject({ statusCode: 403 });

    mockEmailFindFirst.mockResolvedValueOnce({
      id: 'trk-1',
      userId: 'user-1',
      trackingTokenHash: 'hash',
      subject: 'Hi',
      recipientReference: 'a@example.com',
      status: 'DISPATCHED',
      sentAt: null,
      expiresAt: new Date(now.getTime() + 60_000),
      firstRecordedAt: null,
      createdAt: now,
    });
    mockEmailUpdate.mockResolvedValueOnce({
      id: 'trk-1',
      userId: 'user-1',
      trackingTokenHash: 'hash',
      subject: 'Hi',
      recipientReference: 'a@example.com',
      status: 'SENT',
      sentAt: now,
      expiresAt: null,
      firstRecordedAt: null,
      createdAt: now,
    });

    const confirmed = await confirmTrackingSent('user-1', 'trk-1', {
      provider: 'GMAIL_API',
      externalMessageId: 'gmail-msg-123',
      sentAt: now,
    });
    expect(confirmed.status).toBe('SENT');
    expect(confirmed.sentAt).toBe(now.toISOString());
    expect(confirmed.expiresAt).toBeNull();
  });

  it('registers emails as PENDING with unique tokens and stores only token hashes', async () => {
    mockEmailCreate.mockResolvedValueOnce({ id: 'trk-1' }).mockResolvedValueOnce({ id: 'trk-2' });
    const auth = makeAuthHeader('user-1', 'sender@example.com');

    const res1 = await request(app)
      .post('/api/tracking/register')
      .set('Authorization', auth)
      .send({ recipientReference: 'a@example.com', subject: 'Hello A' });

    const res2 = await request(app)
      .post('/api/tracking/register')
      .set('Authorization', auth)
      .send({ recipientReference: 'b@example.com', subject: 'Hello B' });

    expect(res1.status).toBe(201);
    expect(res2.status).toBe(201);
    expect(res1.body.pixelUrl).not.toBe(res2.body.pixelUrl);

    const stored1 = mockEmailCreate.mock.calls[0]?.[0]?.data;
    const rawToken1 = (res1.body.pixelUrl as string).split('/api/track/')[1]!;
    expect(stored1.status).toBe('PENDING');
    expect(stored1.sentAt).toBeNull();
    expect(stored1.trackingTokenHash).toBe(hashTrackingToken(rawToken1));
  });

  it('transitions PENDING -> DISPATCHED with retention expiresAt and blocks invalid transitions', async () => {
    const auth = makeAuthHeader('user-1', 'sender@example.com');
    const now = new Date();
    const dispatchedExpiry = new Date(now.getTime() + env.DISPATCHED_TTL_HOURS * 3600 * 1000);

    mockEmailFindFirst.mockResolvedValueOnce({
      id: 'trk-1',
      userId: 'user-1',
      trackingTokenHash: 'hash',
      subject: 'Hi',
      recipientReference: 'a@example.com',
      status: 'PENDING',
      sentAt: null,
      expiresAt: new Date(now.getTime() + 60_000),
      firstRecordedAt: null,
      createdAt: now,
    });
    mockEmailUpdate.mockResolvedValueOnce({
      id: 'trk-1',
      userId: 'user-1',
      trackingTokenHash: 'hash',
      subject: 'Hi',
      recipientReference: 'a@example.com',
      status: 'DISPATCHED',
      sentAt: null,
      expiresAt: dispatchedExpiry,
      firstRecordedAt: null,
      createdAt: now,
    });

    const dispatchedRes = await request(app)
      .patch('/api/tracking/emails/trk-1/status')
      .set('Authorization', auth)
      .send({ status: 'DISPATCHED' });

    expect(dispatchedRes.status).toBe(200);
    expect(dispatchedRes.body.status).toBe('DISPATCHED');
    expect(dispatchedRes.body.sentAt).toBeNull();
    expect(dispatchedRes.body.expiresAt).toBeTruthy();

    // Reject SENT -> FAILED out-of-order transition
    mockEmailFindFirst.mockResolvedValueOnce({
      id: 'trk-1',
      userId: 'user-1',
      trackingTokenHash: 'hash',
      subject: 'Hi',
      recipientReference: 'a@example.com',
      status: 'SENT',
      sentAt: now,
      expiresAt: null,
      firstRecordedAt: null,
      createdAt: now,
    });

    const invalidTransition = await request(app)
      .patch('/api/tracking/emails/trk-1/status')
      .set('Authorization', auth)
      .send({ status: 'FAILED' });
    expect(invalidTransition.status).toBe(409);

    // Reject FAILED -> DISPATCHED
    mockEmailFindFirst.mockResolvedValueOnce({
      id: 'trk-2',
      userId: 'user-1',
      trackingTokenHash: 'hash2',
      subject: 'Hi',
      recipientReference: 'a@example.com',
      status: 'FAILED',
      sentAt: null,
      expiresAt: null,
      firstRecordedAt: null,
      createdAt: now,
    });

    const failedTransition = await request(app)
      .patch('/api/tracking/emails/trk-2/status')
      .set('Authorization', auth)
      .send({ status: 'DISPATCHED' });
    expect(failedTransition.status).toBe(409);
  });

  it('expires both PENDING and DISPATCHED records atomically using UTC without touching SENT or FAILED', async () => {
    const utcNow = new Date('2026-11-14T12:00:00.000Z');
    mockEmailUpdateMany.mockResolvedValueOnce({ count: 5 }).mockResolvedValueOnce({ count: 0 });

    const [firstCount, secondCount] = await Promise.all([
      expireAbandonedTrackingRecords(utcNow),
      expireAbandonedTrackingRecords(utcNow),
    ]);

    expect(firstCount).toBe(5);
    expect(secondCount).toBe(0);
    expect(mockEmailUpdateMany).toHaveBeenCalledWith({
      where: {
        status: { in: ['PENDING', 'DISPATCHED'] },
        expiresAt: { lt: utcNow },
      },
      data: {
        status: 'EXPIRED',
      },
    });
  });

  it('prevents one user from reading or updating another user tracking records and supports pagination', async () => {
    const user1Auth = makeAuthHeader('user-1', 'u1@example.com');
    const user2Auth = makeAuthHeader('user-2', 'u2@example.com');

    mockEmailFindMany.mockResolvedValueOnce([]);
    mockEmailCount.mockResolvedValueOnce(45);

    const listRes = await request(app)
      .get('/api/tracking/emails?page=2&limit=10')
      .set('Authorization', user1Auth);

    expect(listRes.status).toBe(200);
    expect(listRes.body.totalPages).toBe(5);

    mockEmailFindFirst.mockResolvedValueOnce(null);
    const readDenied = await request(app)
      .get('/api/tracking/emails/trk-owned-by-1')
      .set('Authorization', user2Auth);
    expect(readDenied.status).toBe(404);

    mockEmailFindFirst.mockResolvedValueOnce(null);
    const updateDenied = await request(app)
      .patch('/api/tracking/emails/trk-owned-by-1/status')
      .set('Authorization', user2Auth)
      .send({ status: 'DISPATCHED' });
    expect(updateDenied.status).toBe(404);
    expect(mockEmailUpdate).not.toHaveBeenCalled();
  });

  it('enforces CORS allowlist on API routes', async () => {
    const allowed = await request(app).get('/health').set('Origin', env.DASHBOARD_ORIGIN);
    expect(allowed.headers['access-control-allow-origin']).toBe(env.DASHBOARD_ORIGIN);

    const disallowed = await request(app).get('/health').set('Origin', 'https://evil.example.com');
    expect(disallowed.status).toBe(500);
    expect(disallowed.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('returns 200 PNG for invalid, unknown, expired DISPATCHED tokens, and DB failures without logging raw tokens', async () => {
    const rawToken = generateTrackingToken();
    mockEmailFindUnique.mockResolvedValueOnce(null);

    const invalidRes = await request(app).get('/api/track/bad!!token');
    expect(invalidRes.status).toBe(200);
    expect(invalidRes.headers['content-type']).toContain('image/png');
    expect(invalidRes.headers['cache-control']).toContain('no-store');
    expect(invalidRes.body.equals(TRANSPARENT_1X1_PNG)).toBe(true);

    const unknownRes = await request(app).get('/api/track/unknownValidFormatToken1234567890');
    expect(unknownRes.status).toBe(200);
    expect(unknownRes.body.equals(TRANSPARENT_1X1_PNG)).toBe(true);

    // Expired DISPATCHED record is lazily expired and does not record events
    const expiredToken = generateTrackingToken();
    mockEmailFindUnique.mockResolvedValueOnce({
      id: 'email-expired',
      status: 'DISPATCHED',
      sentAt: null,
      expiresAt: new Date(Date.now() - 10_000),
      firstRecordedAt: null,
    });
    const expiredRes = await request(app).get(`/api/track/${expiredToken}`);
    expect(expiredRes.status).toBe(200);
    await new Promise((r) => setTimeout(r, 20));
    expect(mockEmailUpdateMany).toHaveBeenCalledWith({
      where: { id: 'email-expired', status: 'DISPATCHED' },
      data: { status: 'EXPIRED' },
    });
    expect(mockEventCreate).not.toHaveBeenCalled();

    // DB transaction failure still returns 200 PNG without logging raw token
    mockEmailFindUnique.mockResolvedValueOnce({
      id: 'email-1',
      status: 'DISPATCHED',
      sentAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      firstRecordedAt: null,
    });
    mockEventCount.mockResolvedValueOnce(0);
    mockTransaction.mockRejectedValueOnce(new Error('DB connection lost'));

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const dbFailRes = await request(app).get(`/api/track/${rawToken}`);
    expect(dbFailRes.status).toBe(200);
    expect(dbFailRes.body.equals(TRANSPARENT_1X1_PNG)).toBe(true);

    await new Promise((r) => setTimeout(r, 20));
    const loggedText = JSON.stringify(consoleSpy.mock.calls);
    expect(loggedText).not.toContain(rawToken);
    consoleSpy.mockRestore();
  });

  it('persists UTC timestamps for multiple and concurrent pixel hits without overwriting firstRecordedAt', async () => {
    const rawToken = generateTrackingToken();
    const sentAt = new Date(Date.now() - 60_000);

    mockEmailFindUnique
      .mockResolvedValueOnce({
        id: 'email-1',
        status: 'DISPATCHED',
        sentAt,
        expiresAt: new Date(Date.now() + 60_000),
        firstRecordedAt: null,
      })
      .mockResolvedValue({
        id: 'email-1',
        status: 'DISPATCHED',
        sentAt,
        expiresAt: new Date(Date.now() + 60_000),
        firstRecordedAt: new Date(Date.now() - 5000),
      });
    mockEventCount.mockResolvedValue(0);

    const responses = await Promise.all([
      request(app).get(`/api/track/${rawToken}`).set('User-Agent', 'Mozilla/5.0 Chrome/125.0.0.0'),
      request(app)
        .get(`/api/track/${rawToken}`)
        .set('User-Agent', 'Mozilla/5.0 (via ggpht.com GoogleImageProxy)'),
      request(app).get(`/api/track/${rawToken}`).set('User-Agent', 'CustomClient/2.0'),
    ]);

    responses.forEach((res) => expect(res.status).toBe(200));
    await new Promise((r) => setTimeout(r, 30));

    expect(mockEventCreate).toHaveBeenCalledTimes(3);
    const occurredAt = mockEventCreate.mock.calls[0]?.[0]?.data?.occurredAt as Date;
    expect(occurredAt).toBeInstanceOf(Date);
    expect(occurredAt.toISOString().endsWith('Z')).toBe(true);
    expect(mockEmailUpdateMany).toHaveBeenCalledTimes(1);
  });

  it('supports filtered server-side pagination on GET /api/tracking/emails', async () => {
    mockEmailFindMany.mockResolvedValue([
      {
        id: 'trk-10',
        userId: 'user-1',
        trackingTokenHash: 'hash-10',
        subject: 'Q4 Proposal',
        recipientReference: 'alice@example.com',
        status: 'DISPATCHED',
        sentAt: null,
        expiresAt: new Date('2026-11-15T10:00:00.000Z'),
        firstRecordedAt: new Date('2026-11-14T10:05:00.000Z'),
        createdAt: new Date('2026-11-14T10:00:00.000Z'),
        _count: { events: 2 },
        events: [{ occurredAt: new Date('2026-11-14T10:06:00.000Z') }],
      },
    ]);
    mockEmailCount.mockResolvedValue(1);

    const res = await request(app)
      .get('/api/tracking/emails?page=1&limit=10&status=DISPATCHED&search=alice')
      .set('Authorization', makeAuthHeader('user-1', 'u1@example.com'));

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.items[0].eventCount).toBe(2);
    expect(res.body.items[0].lastRecordedAt).toBe('2026-11-14T10:06:00.000Z');
    expect(mockEmailFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'user-1',
          status: 'DISPATCHED',
        }),
        skip: 0,
        take: 10,
      }),
    );
  });

  it('returns user-scoped analytics and enforces auth on GET /api/tracking/analytics', async () => {
    const unauth = await request(app).get('/api/tracking/analytics');
    expect(unauth.status).toBe(401);

    mockEmailGroupBy.mockResolvedValue([
      { status: 'PENDING', _count: { _all: 2 } },
      { status: 'DISPATCHED', _count: { _all: 3 } },
      { status: 'FAILED', _count: { _all: 1 } },
    ]);
    mockEventGroupBy.mockResolvedValue([
      { classification: 'RECORDED', _count: { _all: 4 } },
      { classification: 'LIKELY_PROXY', _count: { _all: 2 } },
    ]);
    const today = new Date();
    mockEventFindMany
      .mockResolvedValueOnce([
        { occurredAt: today, classification: 'RECORDED' },
        { occurredAt: today, classification: 'LIKELY_PROXY' },
      ])
      .mockResolvedValueOnce([
        {
          id: 'ev-1',
          trackedEmailId: 'trk-1',
          eventType: 'PIXEL_REQUEST',
          classification: 'RECORDED',
          occurredAt: today,
          createdAt: today,
          trackedEmail: {
            id: 'trk-1',
            subject: 'Hello',
            recipientReference: 'bob@example.com',
            status: 'DISPATCHED',
          },
        },
      ]);

    const res = await request(app)
      .get('/api/tracking/analytics?days=7')
      .set('Authorization', makeAuthHeader('user-1', 'u1@example.com'));

    expect(res.status).toBe(200);
    expect(res.body.statusCounts).toEqual({
      PENDING: 2,
      DISPATCHED: 3,
      SENT: 0,
      FAILED: 1,
      EXPIRED: 0,
      totalEmails: 6,
    });
    expect(res.body.classificationCounts).toEqual({
      RECORDED: 4,
      LIKELY_PROXY: 2,
      SUSPECTED_SCANNER: 0,
      totalEvents: 6,
    });
    expect(res.body.dailyActivity).toHaveLength(7);
    expect(res.body.recentEvents).toHaveLength(1);
  });

  it('returns paginated user-scoped events on GET /api/tracking/events', async () => {
    const unauth = await request(app).get('/api/tracking/events');
    expect(unauth.status).toBe(401);

    const occurredAt = new Date('2026-11-14T10:15:00.000Z');
    mockEventFindMany.mockResolvedValue([
      {
        id: 'ev-9',
        trackedEmailId: 'trk-2',
        eventType: 'PIXEL_REQUEST',
        classification: 'SUSPECTED_SCANNER',
        occurredAt,
        createdAt: occurredAt,
        trackedEmail: {
          id: 'trk-2',
          subject: 'Security Check',
          recipientReference: 'sec@example.com',
          status: 'DISPATCHED',
        },
      },
    ]);
    mockEventCount.mockResolvedValue(1);

    const res = await request(app)
      .get('/api/tracking/events?page=1&limit=20&classification=SUSPECTED_SCANNER')
      .set('Authorization', makeAuthHeader('user-1', 'u1@example.com'));

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.items[0].classification).toBe('SUSPECTED_SCANNER');
    expect(mockEventFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          trackedEmail: { userId: 'user-1' },
          classification: 'SUSPECTED_SCANNER',
        }),
      }),
    );
  });

  it('rejects invalid pagination parameters and inverted or oversized date ranges', async () => {
    const auth = makeAuthHeader('user-1', 'u1@example.com');

    const badPage = await request(app)
      .get('/api/tracking/emails?page=0')
      .set('Authorization', auth);
    expect(badPage.status).toBe(400);

    const badLimit = await request(app)
      .get('/api/tracking/events?limit=101')
      .set('Authorization', auth);
    expect(badLimit.status).toBe(400);

    const invertedEmails = await request(app)
      .get('/api/tracking/emails?from=2026-11-15T00:00:00.000Z&to=2026-11-10T00:00:00.000Z')
      .set('Authorization', auth);
    expect(invertedEmails.status).toBe(400);

    const invertedAnalytics = await request(app)
      .get('/api/tracking/analytics?from=2026-11-15T00:00:00.000Z&to=2026-11-10T00:00:00.000Z')
      .set('Authorization', auth);
    expect(invertedAnalytics.status).toBe(400);

    const oversizedAnalytics = await request(app)
      .get('/api/tracking/analytics?from=2020-01-01T00:00:00.000Z&to=2026-11-14T00:00:00.000Z')
      .set('Authorization', auth);
    expect(oversizedAnalytics.status).toBe(400);
  });
});
