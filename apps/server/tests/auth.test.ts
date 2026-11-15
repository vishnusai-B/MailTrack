import type * as BcryptModule from 'bcryptjs';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockUserFindUnique,
  mockUserCreate,
  mockRefreshCreate,
  mockRefreshFindUnique,
  mockRefreshUpdateMany,
  mockEmailFindFirst,
  mockEventFindMany,
  mockEventCount,
  mockTransaction,
} = vi.hoisted(() => ({
  mockUserFindUnique: vi.fn(),
  mockUserCreate: vi.fn(),
  mockRefreshCreate: vi.fn(),
  mockRefreshFindUnique: vi.fn(),
  mockRefreshUpdateMany: vi.fn(),
  mockEmailFindFirst: vi.fn(),
  mockEventFindMany: vi.fn(),
  mockEventCount: vi.fn(),
  mockTransaction: vi.fn(),
}));

vi.mock('../src/lib/prisma.js', () => ({
  prisma: {
    user: {
      findUnique: mockUserFindUnique,
      create: mockUserCreate,
    },
    refreshToken: {
      create: mockRefreshCreate,
      findUnique: mockRefreshFindUnique,
      updateMany: mockRefreshUpdateMany,
    },
    trackedEmail: {
      findFirst: mockEmailFindFirst,
    },
    trackingEvent: {
      findMany: mockEventFindMany,
      count: mockEventCount,
    },
    $transaction: mockTransaction,
    $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
    $disconnect: vi.fn(),
  },
  checkDatabaseConnection: vi.fn().mockResolvedValue(true),
}));

vi.mock('bcryptjs', async () => {
  const actual = await vi.importActual<typeof BcryptModule>('bcryptjs');
  const DUMMY_COST_12 = '$2a$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW';
  const dummyCost4 = actual.hashSync('__mailtrack_dummy_timing_pad__', 4);
  return {
    ...actual,
    default: {
      ...actual,
      hash: (password: string) => actual.hash(password, 4),
      compare: (password: string, hash: string) =>
        actual.compare(password, hash === DUMMY_COST_12 ? dummyCost4 : hash),
    },
    hash: (password: string) => actual.hash(password, 4),
    compare: (password: string, hash: string) =>
      actual.compare(password, hash === DUMMY_COST_12 ? dummyCost4 : hash),
  };
});

import bcrypt from 'bcryptjs';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { authRateLimiter, failedLoginRateLimiter } from '../src/middleware/rateLimiter.js';

function makeAccessToken(
  userId: string,
  email: string,
  overrides: Partial<jwt.SignOptions> = {},
): string {
  return jwt.sign({ sub: userId, email }, env.JWT_ACCESS_SECRET, {
    algorithm: 'HS256',
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
    expiresIn: '15m',
    ...overrides,
  });
}

describe('Phase 6 Authentication & Security (Mocked Prisma)', () => {
  const app = createApp();

  beforeEach(() => {
    vi.clearAllMocks();
    authRateLimiter.resetKey('127.0.0.1');
    authRateLimiter.resetKey('::ffff:127.0.0.1');
    failedLoginRateLimiter.resetKey('127.0.0.1');
    failedLoginRateLimiter.resetKey('::ffff:127.0.0.1');
    mockRefreshCreate.mockResolvedValue({ id: 'rt-1' });
    mockRefreshUpdateMany.mockResolvedValue({ count: 1 });
    mockTransaction.mockImplementation(
      async (
        fn: (tx: {
          refreshToken: {
            updateMany: typeof mockRefreshUpdateMany;
            create: typeof mockRefreshCreate;
          };
        }) => Promise<unknown>,
      ) =>
        fn({
          refreshToken: {
            updateMany: mockRefreshUpdateMany,
            create: mockRefreshCreate,
          },
        }),
    );
  });

  it('registers a user, stores hashed refresh token, and omits passwordHash', async () => {
    const now = new Date('2026-11-14T10:00:00.000Z');
    mockUserFindUnique.mockResolvedValue(null);
    mockUserCreate.mockImplementation(
      async ({ data }: { data: { email: string; name: string | null; passwordHash: string } }) => ({
        id: 'user-1',
        email: data.email,
        name: data.name,
        passwordHash: data.passwordHash,
        defaultTrackingEnabled: false,
        createdAt: now,
        updatedAt: now,
      }),
    );

    const res = await request(app).post('/api/auth/register').send({
      email: 'Alice@Example.com',
      password: 'StrongPassword123!',
      name: 'Alice',
    });

    expect(res.status).toBe(201);
    expect(res.body.accessToken).toBeTypeOf('string');
    expect(res.body.refreshToken).toBeTypeOf('string');
    expect(res.body.user.email).toBe('alice@example.com');
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain('StrongPassword123!');
    expect(mockRefreshCreate).toHaveBeenCalledTimes(1);
    const storedHash = mockRefreshCreate.mock.calls[0]?.[0]?.data?.tokenHash as string;
    expect(storedHash).not.toBe(res.body.refreshToken);
    expect(storedHash).toHaveLength(64);
  });

  it('rejects duplicate registration with 409', async () => {
    mockUserFindUnique.mockResolvedValue({ id: 'user-1', email: 'alice@example.com' });

    const res = await request(app).post('/api/auth/register').send({
      email: 'alice@example.com',
      password: 'StrongPassword123!',
    });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('EMAIL_IN_USE');
  });

  it('logs in with valid credentials and rejects wrong password or unknown email identically', async () => {
    const now = new Date('2026-11-14T10:00:00.000Z');
    const hash = await bcrypt.hash('CorrectPassword123!', 10);
    mockUserFindUnique.mockResolvedValue({
      id: 'user-1',
      email: 'alice@example.com',
      name: 'Alice',
      passwordHash: hash,
      defaultTrackingEnabled: false,
      createdAt: now,
      updatedAt: now,
    });

    const ok = await request(app).post('/api/auth/login').send({
      email: 'alice@example.com',
      password: 'CorrectPassword123!',
    });
    expect(ok.status).toBe(200);
    expect(ok.body.accessToken).toBeTypeOf('string');
    expect(ok.body.refreshToken).toBeTypeOf('string');
    expect(ok.body.user.passwordHash).toBeUndefined();

    const wrongPass = await request(app).post('/api/auth/login').send({
      email: 'alice@example.com',
      password: 'WrongPassword!',
    });
    expect(wrongPass.status).toBe(401);
    expect(wrongPass.body).toEqual({
      error: 'Invalid email or password',
      code: 'INVALID_CREDENTIALS',
    });

    mockUserFindUnique.mockResolvedValueOnce(null);
    const unknownEmail = await request(app).post('/api/auth/login').send({
      email: 'nobody@example.com',
      password: 'WrongPassword!',
    });
    expect(unknownEmail.status).toBe(401);
    expect(unknownEmail.body).toEqual(wrongPass.body);
  });

  it('rejects missing, expired, malformed, and wrong-audience/issuer JWTs', async () => {
    const missing = await request(app).get('/api/auth/me');
    expect(missing.status).toBe(401);

    const malformed = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer not-a-jwt');
    expect(malformed.status).toBe(401);

    const expired = jwt.sign(
      { sub: 'user-1', email: 'alice@example.com', exp: Math.floor(Date.now() / 1000) - 60 },
      env.JWT_ACCESS_SECRET,
      { algorithm: 'HS256', issuer: env.JWT_ISSUER, audience: env.JWT_AUDIENCE },
    );
    const expiredRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${expired}`);
    expect(expiredRes.status).toBe(401);

    const wrongAudience = makeAccessToken('user-1', 'alice@example.com', {
      audience: 'other-service',
    });
    const wrongAudRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${wrongAudience}`);
    expect(wrongAudRes.status).toBe(401);

    const wrongIssuer = makeAccessToken('user-1', 'alice@example.com', {
      issuer: 'untrusted-issuer',
    });
    const wrongIssRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${wrongIssuer}`);
    expect(wrongIssRes.status).toBe(401);
  });

  it('allows protected /api/auth/me access with valid JWT and omits passwordHash', async () => {
    const now = new Date('2026-11-14T10:00:00.000Z');
    mockUserFindUnique.mockResolvedValue({
      id: 'user-1',
      email: 'alice@example.com',
      name: 'Alice',
      passwordHash: 'secret-hash',
      defaultTrackingEnabled: true,
      createdAt: now,
      updatedAt: now,
    });

    const token = makeAccessToken('user-1', 'alice@example.com');
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe('user-1');
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it('enforces cross-user isolation on tracked email detail and event listing', async () => {
    const user2Token = makeAccessToken('user-2', 'bob@example.com');

    // Cross-user email detail lookup returns 404 without leaking user-1 data
    mockEmailFindFirst.mockResolvedValue(null);
    const detailRes = await request(app)
      .get('/api/tracking/emails/trk-owned-by-user-1')
      .set('Authorization', `Bearer ${user2Token}`);
    expect(detailRes.status).toBe(404);
    expect(mockEmailFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'trk-owned-by-user-1', userId: 'user-2' },
      }),
    );

    // Cross-user event listing ignores any client-supplied userId query param
    mockEventFindMany.mockResolvedValue([]);
    mockEventCount.mockResolvedValue(0);
    const eventsRes = await request(app)
      .get('/api/tracking/events?userId=user-1')
      .set('Authorization', `Bearer ${user2Token}`);
    expect(eventsRes.status).toBe(200);
    expect(mockEventFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          trackedEmail: { userId: 'user-2' },
        }),
      }),
    );
  });

  it('rotates refresh tokens, detects reuse, prevents concurrent rotation races, and revokes on logout', async () => {
    const now = new Date('2026-11-14T10:00:00.000Z');
    const user = {
      id: 'user-1',
      email: 'alice@example.com',
      name: 'Alice',
      passwordHash: 'hash',
      defaultTrackingEnabled: false,
      createdAt: now,
      updatedAt: now,
    };

    // Valid rotation
    mockRefreshFindUnique.mockResolvedValueOnce({
      id: 'rt-1',
      userId: 'user-1',
      tokenHash: 'h1',
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      user,
    });
    mockRefreshUpdateMany.mockResolvedValueOnce({ count: 1 });

    const rotated = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: 'raw-refresh-token-1234567890' });
    expect(rotated.status).toBe(200);
    expect(rotated.body.accessToken).toBeTypeOf('string');
    expect(rotated.body.refreshToken).toBeTypeOf('string');

    // Reuse detection revokes all active tokens for the user
    mockRefreshFindUnique.mockResolvedValueOnce({
      id: 'rt-1',
      userId: 'user-1',
      tokenHash: 'h1',
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: new Date(),
      user,
    });
    const reused = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: 'raw-refresh-token-1234567890' });
    expect(reused.status).toBe(401);
    expect(reused.body.code).toBe('REFRESH_TOKEN_REUSED');
    expect(mockRefreshUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1', revokedAt: null },
      }),
    );

    // Concurrent rotation race (count === 0)
    mockRefreshFindUnique.mockResolvedValueOnce({
      id: 'rt-2',
      userId: 'user-1',
      tokenHash: 'h2',
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      user,
    });
    mockRefreshUpdateMany.mockResolvedValueOnce({ count: 0 });
    const raced = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: 'raw-refresh-token-concurrent-12345' });
    expect(raced.status).toBe(401);

    // Logout revokes token, and subsequent refresh attempt is rejected
    const logoutRes = await request(app)
      .post('/api/auth/logout')
      .send({ refreshToken: 'raw-refresh-token-1234567890' });
    expect(logoutRes.status).toBe(200);
    expect(logoutRes.body).toEqual({ ok: true });

    mockRefreshFindUnique.mockResolvedValueOnce({
      id: 'rt-1',
      userId: 'user-1',
      tokenHash: 'h1',
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: new Date(),
      user,
    });
    const afterLogout = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: 'raw-refresh-token-1234567890' });
    expect(afterLogout.status).toBe(401);
    expect(afterLogout.body.code).toBe('REFRESH_TOKEN_REUSED');

    // Expired refresh token is rejected
    mockRefreshFindUnique.mockResolvedValueOnce({
      id: 'rt-exp',
      userId: 'user-1',
      tokenHash: 'h-exp',
      expiresAt: new Date(Date.now() - 60_000),
      revokedAt: null,
      user,
    });
    const expiredRefresh = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: 'expired-refresh-token-1234567890' });
    expect(expiredRefresh.status).toBe(401);
    expect(expiredRefresh.body.code).toBe('REFRESH_TOKEN_EXPIRED');
  });

  it('handles simultaneous concurrent refresh requests by revoking all user sessions on race', async () => {
    const now = new Date('2026-11-14T10:00:00.000Z');
    const user = {
      id: 'user-1',
      email: 'alice@example.com',
      name: 'Alice',
      passwordHash: 'hash',
      defaultTrackingEnabled: false,
      createdAt: now,
      updatedAt: now,
    };

    mockRefreshFindUnique.mockResolvedValue({
      id: 'rt-concurrent',
      userId: 'user-1',
      tokenHash: 'h-concurrent',
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      user,
    });

    // Simulate Request 1 winning the atomic updateMany (count: 1) and Request 2 losing (count: 0)
    mockRefreshUpdateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValue({ count: 1 });

    const [res1, res2] = await Promise.all([
      request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'concurrent-refresh-token-12345678' }),
      request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'concurrent-refresh-token-12345678' }),
    ]);

    const statuses = [res1.status, res2.status].sort();
    expect(statuses).toEqual([200, 401]);
    // Losing concurrent request revokes all active tokens for user-1 (including any replacement)
    expect(mockRefreshUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1', revokedAt: null },
      }),
    );
  });

  it('rejects invalid payloads and enforces failed login rate limiting with 429', async () => {
    const invalidPayload = await request(app).post('/api/auth/register').send({
      email: 'not-an-email',
      password: 'short',
    });
    expect(invalidPayload.status).toBe(400);
    expect(invalidPayload.body.code).toBe('VALIDATION_ERROR');

    // Trigger failed login rate limit (default LOGIN_FAILED_RATE_LIMIT_MAX=10)
    mockUserFindUnique.mockResolvedValue(null);
    let rateLimitedResponse: request.Response | null = null;
    for (let i = 0; i < 15; i += 1) {
      const res = await request(app).post('/api/auth/login').send({
        email: 'bruteforce@example.com',
        password: 'wrong-password',
      });
      if (res.status === 429) {
        rateLimitedResponse = res;
        break;
      }
    }
    expect(rateLimitedResponse).not.toBeNull();
    expect(rateLimitedResponse!.status).toBe(429);
    expect(rateLimitedResponse!.body.code).toBe('RATE_LIMITED');
  });
});
