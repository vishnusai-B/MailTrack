import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { AuthResponse, User } from '@mailtrack/shared';
import { env } from '../../config/env.js';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../middleware/errorHandler.js';

// Precomputed valid bcrypt hash (cost 12) used when user is not found to normalize login timing
const DUMMY_BCRYPT_HASH = '$2a$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW';

function toUserDTO(user: {
  id: string;
  email: string;
  name: string | null;
  defaultTrackingEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}): User {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    defaultTrackingEnabled: user.defaultTrackingEnabled,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

function signAccessToken(user: { id: string; email: string }): string {
  return jwt.sign({ sub: user.id, email: user.email }, env.JWT_ACCESS_SECRET, {
    algorithm: 'HS256',
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

function hashRefreshToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

async function issueRefreshToken(userId: string): Promise<string> {
  const rawToken = crypto.randomBytes(48).toString('base64url');
  const tokenHash = hashRefreshToken(rawToken);
  const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
    },
  });

  return rawToken;
}

export async function registerUser(input: {
  email: string;
  password: string;
  name?: string;
}): Promise<AuthResponse> {
  const email = input.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new AppError(409, 'Email is already registered', 'EMAIL_IN_USE');
  }

  const passwordHash = await bcrypt.hash(input.password, 12);
  const user = await prisma.user.create({
    data: {
      email,
      name: input.name ?? null,
      passwordHash,
    },
  });

  const refreshToken = await issueRefreshToken(user.id);

  return {
    accessToken: signAccessToken(user),
    refreshToken,
    user: toUserDTO(user),
  };
}

export async function loginUser(input: { email: string; password: string }): Promise<AuthResponse> {
  const email = input.email.toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    await bcrypt.compare(input.password, DUMMY_BCRYPT_HASH);
    throw new AppError(401, 'Invalid email or password', 'INVALID_CREDENTIALS');
  }

  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) {
    throw new AppError(401, 'Invalid email or password', 'INVALID_CREDENTIALS');
  }

  const refreshToken = await issueRefreshToken(user.id);

  return {
    accessToken: signAccessToken(user),
    refreshToken,
    user: toUserDTO(user),
  };
}

export async function refreshAuthSession(rawRefreshToken: string): Promise<AuthResponse> {
  const tokenHash = hashRefreshToken(rawRefreshToken);
  const existing = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!existing) {
    throw new AppError(401, 'Invalid refresh token', 'INVALID_REFRESH_TOKEN');
  }

  const now = new Date();
  if (existing.revokedAt !== null) {
    // Refresh token reuse detected: revoke all active sessions for this user
    await prisma.refreshToken.updateMany({
      where: { userId: existing.userId, revokedAt: null },
      data: { revokedAt: now },
    });
    throw new AppError(401, 'Refresh token reuse detected', 'REFRESH_TOKEN_REUSED');
  }

  if (existing.expiresAt <= now) {
    throw new AppError(401, 'Refresh token has expired', 'REFRESH_TOKEN_EXPIRED');
  }

  const nextRawToken = crypto.randomBytes(48).toString('base64url');
  const nextTokenHash = hashRefreshToken(nextRawToken);
  const nextExpiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

  // Atomic transaction: revoke old token and insert replacement together
  const txResult = await prisma.$transaction(async (tx) => {
    const revoked = await tx.refreshToken.updateMany({
      where: { id: existing.id, revokedAt: null },
      data: { revokedAt: now },
    });

    if (revoked.count === 0) {
      return { rotated: false as const };
    }

    await tx.refreshToken.create({
      data: {
        userId: existing.userId,
        tokenHash: nextTokenHash,
        expiresAt: nextExpiresAt,
      },
    });

    return { rotated: true as const };
  });

  if (!txResult.rotated) {
    // Concurrent rotation race detected outside tx so revocation is never rolled back
    await prisma.refreshToken.updateMany({
      where: { userId: existing.userId, revokedAt: null },
      data: { revokedAt: now },
    });
    throw new AppError(401, 'Refresh token already rotated', 'REFRESH_TOKEN_REUSED');
  }

  return {
    accessToken: signAccessToken(existing.user),
    refreshToken: nextRawToken,
    user: toUserDTO(existing.user),
  };
}

/**
 * Deletes expired refresh tokens past their UTC expiration timestamp.
 */
export async function cleanupExpiredRefreshTokens(now: Date = new Date()): Promise<number> {
  const result = await prisma.refreshToken.deleteMany({
    where: { expiresAt: { lt: now } },
  });
  return result.count;
}

export async function revokeRefreshToken(rawRefreshToken?: string): Promise<void> {
  if (!rawRefreshToken) return;
  const tokenHash = hashRefreshToken(rawRefreshToken);
  await prisma.refreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function getUserById(userId: string): Promise<User> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new AppError(404, 'User not found', 'NOT_FOUND');
  }
  return toUserDTO(user);
}
