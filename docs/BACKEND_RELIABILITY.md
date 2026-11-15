# MailTrack — Backend Reliability & Hardening

## 1. Database Architecture & Migration Safety

Versioned SQL migrations live in `apps/server/prisma/migrations/`:

- `20261114000000_init/migration.sql`: Creates `User`, `TrackedEmail`, `TrackingEvent`, enums (`TrackingStatus`, `EventClassification`), unique constraints (`User.email`, `TrackedEmail.trackingTokenHash`), foreign keys (`ON DELETE CASCADE ON UPDATE CASCADE`), and query indexes.
- `20261114010000_add_dispatched_status/migration.sql`: Non-destructive `ALTER TYPE "TrackingStatus" ADD VALUE IF NOT EXISTS 'DISPATCHED';` preserving all existing records.
  - **Compatibility Note:** Executing `ALTER TYPE ... ADD VALUE` inside a Prisma migration requires PostgreSQL 12+ (satisfied by `postgres:16-alpine` in `docker-compose.yml`).

### Safe Migration Commands (New & Existing Databases)

Never use `prisma db push` or `prisma migrate reset` on existing/production databases.

- **Production / Existing Databases (non-interactive):**
  ```bash
  npx prisma migrate deploy --schema=apps/server/prisma/schema.prisma
  ```
- **Local Development (creating/applying migrations):**
  ```bash
  npm run prisma:migrate
  ```

### Index Strategy

- **`TrackedEmail`**: `@unique` on `trackingTokenHash`, `@@index([userId])`, `@@index([userId, sentAt(sort: Desc)])`, `@@index([status, expiresAt])`.
- **`TrackingEvent`**: `@@index([trackedEmailId])`, `@@index([occurredAt])`, `@@index([trackedEmailId, occurredAt(sort: Asc)])`.

## 2. Tracking Record Lifecycle & Strict `SENT` Confirmation

1. **`PENDING`**: Created by `POST /api/tracking/register` with `sentAt = null` and `expiresAt = now + PENDING_TTL_HOURS` (default `24h`).
2. **`DISPATCHED`**: Set by the extension after Gmail's Send button click is triggered (`PATCH /api/tracking/emails/:id/status`). Preserves `sentAt = null` and sets `expiresAt = now + DISPATCHED_TTL_HOURS` (default `168h` / 7 days).
3. **`SENT`**: Can **only** be confirmed by the trusted server-side `confirmTrackingSent()` service with verifiable `GMAIL_API` submission evidence (`externalMessageId`). Client/extension requests attempting `PATCH /status { status: 'SENT' }` are rejected with `403 SENT_CONFIRMATION_REQUIRES_TRUSTED_EVIDENCE`. Clears `expiresAt = null` so `SENT` records are never expired.
4. **`FAILED`**: Set when pre-send preparation/injection fails reliably before submission (`expiresAt = null`).
5. **`EXPIRED`**: Abandoned `PENDING` and `DISPATCHED` records past their UTC `expiresAt` are atomically expired by `expireAbandonedTrackingRecords()` (safe under concurrent execution). `SENT` and `FAILED` records are never expired.

Out-of-order and backward transitions (e.g., `SENT -> FAILED`, `FAILED -> DISPATCHED`, `EXPIRED -> *`) are rejected with `409 Conflict`.

## 3. Event Ingestion & Conservative Classification

- `GET /api/track/:token` hashes the token with SHA-256, checks `TrackedEmail` by `trackingTokenHash`, skips `FAILED`/`EXPIRED` (and lazily expires past-due `PENDING`/`DISPATCHED`), preserves duplicate hits (up to 30/min/email), records UTC `occurredAt`, and sets `firstRecordedAt` atomically once (`updateMany` where `null`).
- The `1x1` transparent PNG (`Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0`) is always returned with `200 OK` even for invalid/unknown tokens or DB write failures. Raw tokens are never logged.
- **Classification (`classifier.ts`):** `LIKELY_PROXY` (Gmail Proxy, Apple MPP, Outlook), `SUSPECTED_SCANNER` (known scanner UAs or `< 2s` post-`sentAt` non-browser hits), `RECORDED` (all other requests including unknown/ambiguous UAs).

## 4. Reproducible PostgreSQL & Integration Test Setup

1. **Start PostgreSQL:**
   ```bash
   docker compose up -d
   ```
2. **Required Environment Variables (`.env`):**
   - `DATABASE_URL`, `TEST_DATABASE_URL` (dedicated test database, e.g. `mailtrack_test`)
   - `JWT_ACCESS_SECRET` (minimum 16 chars, 32+ random chars recommended)
   - `TRACKING_DOMAIN`, `PENDING_TTL_HOURS=24`, `DISPATCHED_TTL_HOURS=168`
3. **Migrate Dedicated Test Database:**
   ```bash
   DATABASE_URL="$TEST_DATABASE_URL" npx prisma migrate deploy --schema=apps/server/prisma/schema.prisma
   ```
4. **Run Real PostgreSQL Integration Tests:**
   ```bash
   RUN_DB_INTEGRATION_TESTS=true TEST_DATABASE_URL="postgresql://POSTGRES_USER:POSTGRES_PASSWORD@localhost:5432/mailtrack_test?schema=public" npm test --workspace=@mailtrack/server
   ```
