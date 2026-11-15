import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

// Note: express-rate-limit defaults to in-memory storage. Multi-instance
// deployments must configure a shared store (e.g., Redis) for global limits.
export const authRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.AUTH_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts', code: 'RATE_LIMITED' },
});

export const failedLoginRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.LOGIN_FAILED_RATE_LIMIT_MAX,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many failed login attempts. Please try again later.',
    code: 'RATE_LIMITED',
  },
});

export const registerTrackingRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Rate limit exceeded for tracking registration', code: 'RATE_LIMITED' },
});

export const pixelRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: false,
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    // Do not leak rate-limit errors on pixel endpoint; let controller still serve image if needed
    next();
  },
});
