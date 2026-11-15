import crypto from 'node:crypto';

/**
 * Generates a 256-bit cryptographically random URL-safe tracking token.
 */
export function generateTrackingToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

/**
 * Computes a SHA-256 hex digest of a raw tracking token.
 * Only the hash is stored in the database; raw tokens are never persisted or logged.
 */
export function hashTrackingToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}
