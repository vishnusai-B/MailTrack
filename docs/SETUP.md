# MailTrack Setup Guide

## Monorepo Structure

```text
mailtrack/
├── apps/
│   ├── extension/   # Chrome Extension (Manifest V3 + TypeScript + esbuild)
│   ├── dashboard/   # Web Dashboard (React + Vite + TypeScript + Tailwind CSS)
│   └── server/      # Backend API (Node.js + Express + TypeScript + Prisma + PostgreSQL)
├── packages/
│   └── shared/      # Shared TypeScript interfaces and domain types
└── docs/            # Architecture and setup documentation
```

## 1. Install

Install dependencies from the repository root:

```bash
npm ci
```

Build order matters: `packages/shared` points its `main`/`types` at `./dist/*`, so it must be
built before any other workspace can typecheck, test, or build against it. The root
`typecheck` and `test` scripts build `@mailtrack/shared` first automatically. The server
additionally needs a generated Prisma client (see §3) before it can typecheck or build.

## 2. Environment Variables

Copy `.env.example` to `.env` at the repository root (and optionally in `apps/server/.env` and `apps/dashboard/.env`):

Server and database:

- `DATABASE_URL`: PostgreSQL connection string (e.g. `postgresql://user:password@localhost:5432/mailtrack?schema=public`). Required in production.
- `PORT`: Backend HTTP port (default `4000`).
- `NODE_ENV`: `development`, `test`, or `production` (default `development`).
- `TRACKING_DOMAIN`: Public base URL of the backend, used for tracking-pixel URLs (default `http://localhost:4000`). In production it must be a non-localhost HTTPS URL.
- `DASHBOARD_ORIGIN`: Allowed CORS origin(s) for the dashboard, comma-separated (default `http://localhost:5173`). In production each entry must be a non-localhost HTTPS URL.
- `EXTENSION_ORIGIN`: Allowed CORS origin(s) for the Chrome extension, comma-separated (default empty). In production it is required, and each entry must be a `chrome-extension://<32-character-id>` origin.

JWT and refresh tokens:

- `JWT_ACCESS_SECRET`: Secret used to sign access tokens. In production it is required and must be at least 32 characters.
- `JWT_ACCESS_EXPIRES_IN`: Access-token lifetime (default `15m`).
- `JWT_ISSUER`: JWT issuer claim (default `mailtrack-api`).
- `JWT_AUDIENCE`: JWT audience claim (default `mailtrack-clients`).
- `REFRESH_TOKEN_TTL_DAYS`: Refresh-token lifetime in days (default `30`, maximum `365`).

Rate limiting:

- `RATE_LIMIT_WINDOW_MS`: Rate-limit window in milliseconds (default `900000`, i.e. 15 minutes).
- `AUTH_RATE_LIMIT_MAX`: Maximum auth requests per window per IP (default `30`).
- `LOGIN_FAILED_RATE_LIMIT_MAX`: Maximum failed-login requests per window per IP (default `10`).

Tracking lifecycle and cleanup:

- `PENDING_TTL_HOURS`: Hours a tracking record may stay `PENDING` before it expires (default `24`).
- `DISPATCHED_TTL_HOURS`: Hours a tracking record may stay `DISPATCHED` before it expires (default `168`).
- `CLEANUP_INTERVAL_MS`: Interval in milliseconds between cleanup-scheduler runs (default `900000`, minimum `10000`).

Dashboard:

- `VITE_API_URL`: Backend URL used by the dashboard (default `http://localhost:4000`).

## 3. Database Setup (PostgreSQL + Prisma)

1. Start PostgreSQL (e.g., `docker compose up -d` using `docker-compose.yml`).
2. Generate the Prisma client:
   ```bash
   npm run prisma:generate
   ```
3. Run database migrations:
   ```bash
   npm run prisma:migrate
   ```

## 4. Development Scripts

- `npm run build` — Build all workspaces (`shared`, `server`, `dashboard`, `extension`).
- `npm run typecheck` — Build `packages/shared`, then run strict TypeScript type-checking across all workspaces.
- `npm test` — Build `packages/shared`, then run the default test suites across all workspaces. The server's PostgreSQL integration suite is excluded from this run; run it separately with `npm run test:integration --workspace=@mailtrack/server` (requires `TEST_DATABASE_URL` pointing at a dedicated test database).
- `npm run lint` — Run ESLint across the monorepo.
- `npm run format:check` — Verify Prettier formatting.
- `npm run dev:server` — Start Express server with `tsx watch` on `http://localhost:4000`.
- `npm run dev:dashboard` — Start Vite dev server on `http://localhost:5173`.
- `npm run dev:extension` — Watch and rebuild the Chrome extension into `apps/extension/dist`.

## 5. Loading the Chrome Extension

For local development, build the extension with the default (dev) build, which targets
`http://localhost:4000` unless `MAILTRACK_API_URL` is set, and includes sourcemaps:

```bash
npm run build --workspace=@mailtrack/extension
```

For production, use the production build instead. It requires `MAILTRACK_API_URL` to be a
valid non-localhost HTTPS URL, and produces a minified build without sourcemaps:

```bash
MAILTRACK_API_URL="https://api.example.com" npm run build:prod --workspace=@mailtrack/extension
```

Then load the built extension in Chrome:

1. Open `chrome://extensions` in Chrome.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select `apps/extension/dist`.
