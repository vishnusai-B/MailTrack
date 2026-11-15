import path from 'node:path';
import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
dotenv.config();

const LOCALHOST_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1', '[::1]', '0.0.0.0']);

export function parseOrigins(raw: string): string[] {
  return raw
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function isLocalhostUrl(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    const host = parsed.hostname.toLowerCase();
    return LOCALHOST_HOSTNAMES.has(host) || host.endsWith('.localhost');
  } catch {
    return false;
  }
}

const envSchema = z
  .object({
    PORT: z.coerce.number().int().positive().default(4000),
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    DATABASE_URL: z.string().min(1).optional(),
    TRACKING_DOMAIN: z.string().url().default('http://localhost:4000'),
    DASHBOARD_ORIGIN: z.string().default('http://localhost:5173'),
    EXTENSION_ORIGIN: z.string().default(''),
    JWT_ACCESS_SECRET: z.string().min(16).optional(),
    JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
    JWT_ISSUER: z.string().min(1).default('mailtrack-api'),
    JWT_AUDIENCE: z.string().min(1).default('mailtrack-clients'),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().max(365).default(30),
    RATE_LIMIT_WINDOW_MS: z.coerce
      .number()
      .int()
      .positive()
      .default(15 * 60 * 1000),
    AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(30),
    LOGIN_FAILED_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
    PENDING_TTL_HOURS: z.coerce.number().int().positive().default(24),
    DISPATCHED_TTL_HOURS: z.coerce.number().int().positive().default(168),
    CLEANUP_INTERVAL_MS: z.coerce
      .number()
      .int()
      .min(10_000)
      .default(15 * 60 * 1000),
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV !== 'production') {
      return;
    }

    if (!data.DATABASE_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['DATABASE_URL'],
        message: 'DATABASE_URL is required in production',
      });
    }

    if (!data.JWT_ACCESS_SECRET || data.JWT_ACCESS_SECRET.length < 32) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['JWT_ACCESS_SECRET'],
        message: 'JWT_ACCESS_SECRET (at least 32 characters) is required in production',
      });
    }

    let trackingUrl: URL | null = null;
    try {
      trackingUrl = new URL(data.TRACKING_DOMAIN);
    } catch {
      trackingUrl = null;
    }

    if (!trackingUrl || trackingUrl.protocol !== 'https:' || isLocalhostUrl(data.TRACKING_DOMAIN)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['TRACKING_DOMAIN'],
        message: 'TRACKING_DOMAIN must be a valid non-localhost HTTPS URL in production',
      });
    }

    const dashboardOrigins = parseOrigins(data.DASHBOARD_ORIGIN);
    if (dashboardOrigins.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['DASHBOARD_ORIGIN'],
        message: 'DASHBOARD_ORIGIN must include at least one valid origin in production',
      });
    } else {
      for (const origin of dashboardOrigins) {
        let parsedOrigin: URL | null = null;
        try {
          parsedOrigin = new URL(origin);
        } catch {
          parsedOrigin = null;
        }
        if (!parsedOrigin || parsedOrigin.protocol !== 'https:' || isLocalhostUrl(origin)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['DASHBOARD_ORIGIN'],
            message: `DASHBOARD_ORIGIN entries must be valid non-localhost HTTPS URLs in production (invalid: ${origin})`,
          });
        }
      }
    }

    const extensionOrigins = parseOrigins(data.EXTENSION_ORIGIN);
    if (extensionOrigins.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['EXTENSION_ORIGIN'],
        message: 'EXTENSION_ORIGIN must be explicitly configured in production',
      });
    } else {
      for (const origin of extensionOrigins) {
        if (!/^chrome-extension:\/\/[a-p]{32}$/.test(origin)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['EXTENSION_ORIGIN'],
            message: `EXTENSION_ORIGIN entries must be valid chrome-extension://<32-char-id> origins in production (invalid: ${origin})`,
          });
        }
      }
    }
  });

export function parseEnv(rawEnv: NodeJS.ProcessEnv) {
  const parsed = envSchema.parse(rawEnv);
  return {
    ...parsed,
    JWT_ACCESS_SECRET: parsed.JWT_ACCESS_SECRET ?? 'dev-only-insecure-secret-set-env-in-production',
  };
}

export const env = parseEnv(process.env);
