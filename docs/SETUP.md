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

## 1. Environment Variables

Copy `.env.example` to `.env` at the repository root (and optionally in `apps/server/.env` and `apps/dashboard/.env`):

- `DATABASE_URL`: PostgreSQL connection string (e.g. `postgresql://user:password@localhost:5432/mailtrack?schema=public`).
- `PORT`: Backend HTTP port (default `4000`).
- `DASHBOARD_ORIGIN`: Allowed CORS origin for the dashboard (default `http://localhost:5173`).
- `VITE_API_URL`: Backend URL used by the dashboard (default `http://localhost:4000`).

## 2. Database Setup (PostgreSQL + Prisma)

1. Start PostgreSQL (e.g., `docker compose up -d` using `docker-compose.yml`).
2. Generate the Prisma client:
   ```bash
   npm run prisma:generate
   ```
3. Run database migrations:
   ```bash
   npm run prisma:migrate
   ```

## 3. Development Scripts

- `npm run build` — Build all workspaces (`shared`, `server`, `dashboard`, `extension`).
- `npm run typecheck` — Run strict TypeScript type-checking across all workspaces.
- `npm run lint` — Run ESLint across the monorepo.
- `npm run format:check` — Verify Prettier formatting.
- `npm run dev:server` — Start Express server with `tsx watch` on `http://localhost:4000`.
- `npm run dev:dashboard` — Start Vite dev server on `http://localhost:5173`.
- `npm run dev:extension` — Watch and rebuild the Chrome extension into `apps/extension/dist`.

## 4. Loading the Chrome Extension

1. Build the extension: `npm run build --workspace=@mailtrack/extension`.
2. Open `chrome://extensions` in Chrome.
3. Enable **Developer mode**.
4. Click **Load unpacked** and select `apps/extension/dist`.
