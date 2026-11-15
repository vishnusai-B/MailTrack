# Phase 7: Campaign Management, Follow-up Reminders, CSV Export & Campaign Analytics

This document describes the Phase 7 implementation for MailTrack across `packages/shared`, `apps/server`, and `apps/dashboard`.

## 1. Database Schema & Migrations

Migration: `apps/server/prisma/migrations/20261114030000_add_campaigns_and_reminders/migration.sql`

- **`CampaignStatus` enum**: `ACTIVE`, `ARCHIVED`
- **`ReminderStatus` enum**: `PENDING`, `COMPLETED`, `CANCELLED`
- **`campaigns` table**:
  - `id`, `userId` (FK -> `users.id`, `ON DELETE CASCADE`), `name`, `description` (nullable), `status` (default `ACTIVE`), `archivedAt` (nullable), `createdAt`, `updatedAt`
  - Indexes on `(userId, status, createdAt)` and `(userId, name)`
- **`tracked_emails.campaignId` column**:
  - Nullable `TEXT` FK -> `campaigns.id` (`ON DELETE SET NULL`)
  - Index on `(userId, campaignId, createdAt)`
  - Preserves all existing `TrackedEmail` rows without requiring a campaign.
- **`follow_up_reminders` table**:
  - `id`, `userId` (FK -> `users.id`, `ON DELETE CASCADE`), `trackedEmailId` (FK -> `tracked_emails.id`, `ON DELETE CASCADE`), `dueAt`, `note` (nullable), `status` (default `PENDING`), `completedAt`, `cancelledAt`, `createdAt`, `updatedAt`
  - Indexes on `(userId, status, dueAt)` and `(trackedEmailId, status)`

> **Note:** Real PostgreSQL migration deployment (`prisma migrate deploy`) and `tracking.integration.test.ts` remain pending until a PostgreSQL instance is provisioned in the environment.

---

## 2. REST API Endpoints

All endpoints below require JWT authentication (`requireAuth`) and enforce strict `userId` ownership scoping.

### Campaigns (`/api/campaigns`)

- `POST /api/campaigns` — Create campaign (`name` required 1–120 chars, `description` optional <= 500 chars)
- `GET /api/campaigns` — List campaigns with `search`, `status` (`ACTIVE` | `ARCHIVED`), `page`, `limit` (1–50)
- `GET /api/campaigns/:id` — Get single campaign with email, event, and pending reminder counts
- `PATCH /api/campaigns/:id` — Update campaign `name`, `description`, or `status` (rejects invalid whitespace-only names)
- `POST /api/campaigns/:id/archive` — Archive campaign (sets `status = 'ARCHIVED'` and `archivedAt`)
- `GET /api/campaigns/:id/emails` — List paginated `TrackedEmail` items belonging to the campaign
- `GET /api/campaigns/:id/analytics` — Campaign-level analytics (`days` or `from`/`to` UTC range)

### Email-to-Campaign Assignment (`/api/tracking`)

- `PATCH /api/tracking/emails/:id/campaign` — Assign (`campaignId`) or unassign (`campaignId: null`) a tracked email. Verifies both email ownership and campaign ownership (`404` otherwise).
- `GET /api/tracking/emails` — Supports optional `campaignId` filter and returns `campaignId` / `campaignName` on items.

### Follow-up Reminders (`/api/reminders`)

- `POST /api/reminders` — Schedule a reminder (`trackedEmailId`, ISO UTC `dueAt`, optional `note`). Rejects invalid dates and prevents duplicate `PENDING` reminders on the same tracked email (`409 Conflict`).
- `GET /api/reminders` — List paginated reminders with `filter` (`upcoming`, `overdue`, `completed`, `cancelled`), `trackedEmailId`, `campaignId`, `page`, `limit` (1–50)
- `GET /api/reminders/:id` — Get single reminder
- `PATCH /api/reminders/:id` — Reschedule (`dueAt`) or update `note` on a `PENDING` reminder
- `POST /api/reminders/:id/complete` — Mark reminder `COMPLETED` with UTC `completedAt`
- `POST /api/reminders/:id/cancel` — Mark reminder `CANCELLED` with UTC `cancelledAt`

### CSV Exports (`/api/exports`)

- `GET /api/exports/emails` — Export user's tracked emails (`search`, `status`, `campaignId`, `from`, `to`)
- `GET /api/exports/campaigns` — Export user's campaigns summary (`search`, `status`)
- `GET /api/exports/campaigns/:id/analytics` — Export campaign daily activity & summary (`days`, `from`, `to`)
- `GET /api/exports/events` — Export user's tracking events (`classification`, `campaignId`, `from`, `to`)

---

## 3. Security & Reliability Design

### CSV Formula-Injection & RFC-4180 Protection (`apps/server/src/utils/csv.ts`)

- Implemented with native Node.js (no external CSV dependencies).
- **Formula neutralization**: Any string cell whose trimmed or raw value begins with `=`, `+`, `-`, `@`, `\t`, or `\r` is prefixed with a single quote (`'`) so spreadsheet applications do not evaluate formulas.
- **RFC-4180 escaping**: Cells containing `,`, `"`, `\r`, or `\n` are wrapped in double quotes with internal `"` doubled (`""`). Rows use `\r\n` line endings.
- **Bounded exports**: Exports are capped at `5000` rows per request (`MAX_EXPORT_ROWS`).
- **No sensitive fields**: Exports exclude `trackingTokenHash`, raw tracking tokens, raw IP addresses, and auth secrets.

### UTC Reminder Semantics

- `dueAt` is parsed and validated as a UTC `Date` (`ISO-8601`).
- `upcoming` filters `status = 'PENDING'` and `dueAt >= now (UTC)`.
- `overdue` filters `status = 'PENDING'` and `dueAt < now (UTC)`.

### Campaign Analytics Accuracy

- `statusCounts`, `classificationCounts`, `reminderCounts`, `dailyActivity`, and `comparison` are scoped to `req.user.id`.
- Pixel events represent HTTP pixel requests (`RECORDED`, `LIKELY_PROXY`, `SUSPECTED_SCANNER`), **not** verified unique human opens.
- `SENT` remains reserved for trusted server-side delivery confirmation.
