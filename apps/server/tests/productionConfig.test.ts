import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseEnv } from '../src/config/env.js';
import { startCleanupScheduler } from '../src/lib/cleanupScheduler.js';

const VALID_PROD_ENV: NodeJS.ProcessEnv = {
  NODE_ENV: 'production',
  PORT: '4000',
  DATABASE_URL: 'postgresql://user:pass@db.example.com:5432/mailtrack?sslmode=require',
  JWT_ACCESS_SECRET: '0123456789abcdef0123456789abcdef',
  TRACKING_DOMAIN: 'https://api.example.com',
  DASHBOARD_ORIGIN: 'https://app.example.com, https://preview.example.com',
  EXTENSION_ORIGIN: 'chrome-extension://abcdefghijklmnopabcdefghijklmnop',
};

describe('Phase 8.2 Production Config, CORS & Cleanup Scheduler', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('validates required production environment variables and rejects HTTP/localhost/missing extension origin', () => {
    const valid = parseEnv(VALID_PROD_ENV);
    expect(valid.NODE_ENV).toBe('production');
    expect(valid.TRACKING_DOMAIN).toBe('https://api.example.com');

    // HTTP tracking domain rejected in production
    expect(() =>
      parseEnv({
        ...VALID_PROD_ENV,
        TRACKING_DOMAIN: 'http://api.example.com',
      }),
    ).toThrow(/TRACKING_DOMAIN/);

    // Localhost tracking domain rejected in production
    expect(() =>
      parseEnv({
        ...VALID_PROD_ENV,
        TRACKING_DOMAIN: 'https://localhost:4000',
      }),
    ).toThrow(/TRACKING_DOMAIN/);

    // Missing EXTENSION_ORIGIN rejected in production
    expect(() =>
      parseEnv({
        ...VALID_PROD_ENV,
        EXTENSION_ORIGIN: '',
      }),
    ).toThrow(/EXTENSION_ORIGIN/);

    // Localhost DASHBOARD_ORIGIN rejected in production
    expect(() =>
      parseEnv({
        ...VALID_PROD_ENV,
        DASHBOARD_ORIGIN: 'http://localhost:5173',
      }),
    ).toThrow(/DASHBOARD_ORIGIN/);
  });

  it('allows multiple comma-separated CORS origins and rejects unauthorized origins', async () => {
    vi.doMock('../src/config/env.js', () => ({
      env: parseEnv(VALID_PROD_ENV),
      parseOrigins: (raw: string) =>
        raw
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
    }));
    vi.doMock('../src/lib/prisma.js', () => ({
      prisma: { $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]) },
      checkDatabaseConnection: vi.fn().mockResolvedValue(true),
    }));

    const { createApp } = await import('../src/app.js');
    const app = createApp();

    const allowed1 = await request(app).get('/health').set('Origin', 'https://app.example.com');
    expect(allowed1.status).toBe(200);
    expect(allowed1.headers['access-control-allow-origin']).toBe('https://app.example.com');

    const allowed2 = await request(app).get('/health').set('Origin', 'https://preview.example.com');
    expect(allowed2.status).toBe(200);
    expect(allowed2.headers['access-control-allow-origin']).toBe('https://preview.example.com');

    const allowedExt = await request(app)
      .get('/health')
      .set('Origin', 'chrome-extension://abcdefghijklmnopabcdefghijklmnop');
    expect(allowedExt.status).toBe(200);

    const rejected = await request(app).get('/health').set('Origin', 'https://evil.example.com');
    expect(rejected.status).toBe(500);

    // Arbitrary chrome-extension origin rejected in production
    const rejectedExt = await request(app)
      .get('/health')
      .set('Origin', 'chrome-extension://pppppppppppppppppppppppppppppppp');
    expect(rejectedExt.status).toBe(500);
  });

  it('prevents overlapping cleanup executions, logs errors safely, and stops on shutdown', async () => {
    let resolveFirst!: (count: number) => void;
    const runCleanup = vi
      .fn<() => Promise<number>>()
      .mockImplementationOnce(
        () =>
          new Promise<number>((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockRejectedValueOnce(new Error('DB transient error'));

    const logger = { info: vi.fn(), error: vi.fn() };
    const handle = startCleanupScheduler({
      intervalMs: 60_000,
      runCleanup,
      logger,
    });

    const p1 = handle.trigger();
    const p2 = handle.trigger(); // Overlaps while p1 is in-flight -> skipped
    expect(runCleanup).toHaveBeenCalledTimes(1);

    resolveFirst(3);
    await Promise.all([p1, p2]);
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('expired 3'));

    // Next trigger catches error without throwing
    await handle.trigger();
    expect(runCleanup).toHaveBeenCalledTimes(2);
    expect(logger.error).toHaveBeenCalled();

    // Stop prevents further triggers
    handle.stop();
    await handle.trigger();
    expect(runCleanup).toHaveBeenCalledTimes(2);
  });
});
