# MailTrack Dashboard Analytics (Phase 5)

## Architecture

The MailTrack web dashboard (`apps/dashboard`) is a React 19 + TypeScript + Vite + Tailwind CSS v4 single-page application that consumes `@mailtrack/shared` DTOs and authenticates against `@mailtrack/server` using JWT Bearer tokens.

### Structure

- `src/lib/api.ts`: Centralized HTTP client (`apiClient`) with Bearer token injection, `ApiError` normalization, and automatic `401` session expiration handling.
- `src/lib/format.ts`: Timestamp and relative-time formatting helpers.
- `src/components/Layout.tsx`: Responsive sidebar navigation (`Overview`, `Tracked Emails`, `Activity`, `Analytics`, `Settings`) with mobile drawer support and top header.
- `src/components/Charts.tsx`: Lightweight SVG/CSS charts for daily pixel activity, status distribution, classification distribution, and daily classification trends.
- `src/components/AuthScreen.tsx`: Sign-in and account registration form backed by `/api/auth/login` and `/api/auth/register`.
- `src/pages/`:
  - `OverviewPage.tsx`: Status summary cards, 30-day activity chart, status breakdown, and recent tracking events.
  - `TrackedEmailsPage.tsx`: Server-side paginated, searchable, filterable email table.
  - `EmailDetailPage.tsx`: Metadata, lifecycle timestamps, and chronological event history with classification disclaimer.
  - `ActivityPage.tsx`: Server-side paginated tracking event log with classification and date filters.
  - `AnalyticsPage.tsx`: Multi-chart analytics view with selectable date windows (`7d`, `14d`, `30d`, `90d`).
  - `SettingsPage.tsx`: Read-only account profile and live `/health` status.

## API Endpoints Used

| Endpoint                   | Method | Purpose                                                                                  | Auth       |
| -------------------------- | ------ | ---------------------------------------------------------------------------------------- | ---------- |
| `/health`                  | `GET`  | Backend and PostgreSQL connectivity status                                               | Public     |
| `/api/auth/login`          | `POST` | Authenticate and obtain JWT access token                                                 | Public     |
| `/api/auth/register`       | `POST` | Register a new user account                                                              | Public     |
| `/api/auth/me`             | `GET`  | Restore authenticated user session                                                       | Bearer JWT |
| `/api/tracking/analytics`  | `GET`  | Aggregated status counts, classification counts, daily activity, and recent events       | Bearer JWT |
| `/api/tracking/emails`     | `GET`  | Server-side paginated tracked emails (`page`, `limit`, `search`, `status`, `from`, `to`) | Bearer JWT |
| `/api/tracking/emails/:id` | `GET`  | Single tracked email metadata and chronological event history                            | Bearer JWT |
| `/api/tracking/events`     | `GET`  | Server-side paginated tracking events (`page`, `limit`, `classification`, `from`, `to`)  | Bearer JWT |

All `/api/tracking/*` endpoints enforce user ownership via `req.user.id` on the backend.

## Metrics Definitions & Conservative Interpretation

- **Lifecycle Statuses**:
  - `PENDING`: Pixel registered in compose; awaiting send dispatch.
  - `DISPATCHED`: Gmail Send action triggered; awaiting trusted server-side confirmation.
  - `SENT`: Reserved for records confirmed by trusted server-side submission evidence (e.g., future Gmail API integration). Never inferred from extension clicks.
  - `FAILED`: Send attempt failed before completion.
  - `EXPIRED`: Abandoned `PENDING` or `DISPATCHED` record expired per retention policy.
- **Recorded Events**: Counts total HTTP pixel requests recorded by `GET /api/track/:token`. Duplicate pixel requests are **not** collapsed into "unique human opens".
- **Event Classifications**:
  - `RECORDED`: Standard pixel request without known proxy or scanner signatures.
  - `LIKELY_PROXY`: Request matching image proxy / caching fetcher patterns.
  - `SUSPECTED_SCANNER`: Request matching automated security scanner patterns.
  - Classifications describe HTTP request characteristics only and **do not** establish whether a human read the email. Raw tracking tokens and raw IP addresses are never exposed in the dashboard.

## Pagination

- `GET /api/tracking/emails` defaults to `limit=15` in the UI (`max 100` on the server).
- `GET /api/tracking/events` defaults to `limit=20` in the UI (`max 100` on the server).
- Both return `{ items, total, page, limit, totalPages }` using `skip` / `take` and `count` queries scoped to the authenticated user.

## Authentication Handling

- Access tokens are stored in `localStorage` under `mailtrack_access_token`.
- On initial load, the dashboard calls `GET /api/auth/me` to validate the stored token.
- Any `401` response from an authenticated API request clears the stored token, resets user state, and displays an expired-session notice on the sign-in screen.

## Local Development

```bash
# Build shared types first if changed
npm.cmd run build --workspace=@mailtrack/shared

# Start backend server (port 4000)
npm.cmd run dev:server

# Start dashboard dev server (port 5173)
npm.cmd run dev:dashboard
```

Set `VITE_API_URL` in `apps/dashboard/.env` (see `apps/dashboard/.env.example`, default `http://localhost:4000`).
