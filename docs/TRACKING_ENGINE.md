# MailTrack — Email Tracking Engine (Phase 3)

## 1. Tracking Architecture

The tracking engine connects the Chrome Extension (MV3) to the Express + PostgreSQL backend across four boundaries:

1. **Compose State (`apps/extension/src/content/composeState.ts`)**: Maintains isolated per-draft `trackingEnabled` state.
2. **Send-Time Interception (`apps/extension/src/content/composeManager.ts`)**: Intercepts Send button clicks and `Ctrl/Cmd+Enter` shortcuts in capture phase **only** when tracking is enabled for that compose window.
3. **Registration (`POST /api/tracking/register`)**: Authenticated endpoint that generates a 256-bit CSPRNG token, stores only its SHA-256 hash (`trackingTokenHash`), and returns `pixelUrl` (`${TRACKING_DOMAIN}/api/track/${rawToken}`).
4. **Pixel Ingestion (`GET /api/track/:token`)**: Public endpoint that hashes the incoming token, records a `TrackingEvent` with conservative classification, updates `firstRecordedAt` if unset, and returns a `1x1` transparent PNG with strict no-cache headers.

## 2. Send-Time Workflow

1. User enables **Track: ON** in a Gmail compose window.
2. User clicks **Send** (or presses `Ctrl+Enter` / `Cmd+Enter`).
3. If tracking is **OFF**, the extension does nothing and Gmail's native send executes immediately.
4. If tracking is **ON**:
   - Capture-phase listener prevents immediate send and guards against duplicate clicks (`isPreparing`).
   - Content script sends `REGISTER_TRACKING` (recipient reference + subject metadata only; never email body) to the MV3 service worker.
   - Service worker calls `POST /api/tracking/register` with the user's Bearer JWT.
   - **On failure** (network error, unauthenticated, 5xx): Send is aborted, any partial pixel is removed, and the toggle displays `Track: Error (retry)`. The email is never silently sent untracked.
   - **On success**: `insertTrackingPixel()` appends a single invisible `1x1` `<img>` tag (`data-mailtrack-pixel="1"`) to the compose editor while preserving all existing HTML formatting, then triggers `sendButton.click()` with `bypassNextSend = true`.

## 3. API Endpoints

- `POST /api/auth/register` & `POST /api/auth/login` — Issue JWT access tokens for extension/dashboard authentication.
- `POST /api/tracking/register` (Bearer JWT, rate-limited) — Request: `{ recipientReference, subject? }`; Response (`201`): `{ pixelUrl }`.
- `GET /api/tracking/emails/:id` (Bearer JWT, owner-scoped) — Returns tracked email metadata and ordered `events[]`, or `404` if not owned by the caller.
- `GET /api/track/:token` (Public, burst-protected) — Always returns `200 OK` `image/png` with `Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0`, `Pragma: no-cache`, `Expires: 0`.

## 4. Database Design

Defined in `apps/server/prisma/schema.prisma`:

- **`TrackedEmail`**: `id`, `userId`, `trackingTokenHash` (`@unique` SHA-256), `subject`, `recipientReference`, `sentAt`, `firstRecordedAt`, `createdAt`. Indexed on `(userId, sentAt DESC)`.
- **`TrackingEvent`**: `id`, `trackedEmailId`, `eventType` (`PIXEL_REQUEST`), `classification` (`RECORDED | LIKELY_PROXY | SUSPECTED_SCANNER`), `occurredAt` (UTC), `createdAt`. Indexed on `(trackedEmailId, occurredAt ASC)`.

## 5. Event Classification & Known Accuracy Limitations

Pixel requests are classified conservatively in `apps/server/src/modules/tracking/classifier.ts`:

- **`LIKELY_PROXY`**: Matches `GoogleImageProxy` (Gmail), Apple Mail Privacy Protection (`CFNetwork` / `Mail/`), or Outlook image proxy User-Agents.
- **`SUSPECTED_SCANNER`**: Matches known security scanners/bots (Barracuda, Mimecast, Proofpoint, Defender, SafeLinks, crawlers) or arrives within 2 seconds of `sentAt`.
- **`RECORDED`**: Standard pixel request without proxy/scanner signatures.

**Important:** None of these classifications establish confirmed human identity or guaranteed reading. Image-blocking clients generate zero events, while pre-fetching proxies (e.g., Apple MPP) generate events without human interaction.

## 6. Gmail Compatibility Limitations & Alternative

DOM-based capture interception relies on Gmail's client-side Send button and keyboard shortcut events. While reliable for standard compose, reply, and forward flows, Gmail's proprietary async send pipeline (e.g., Undo Send, offline queuing, or major DOM refactors) cannot be 100% guaranteed at the DOM layer alone.

**Gmail API Alternative:** For enterprise-grade guaranteed delivery of the pixel, an alternative architecture uses `gmail.users.drafts.send` / `gmail.users.messages.send` via OAuth (`gmail.compose` / `gmail.send` scopes) to inject the `<img>` tag into the MIME HTML part server-side before submission.

## 7. Integration Testing Strategy (Real PostgreSQL)

Unit and route tests mock Prisma in CI/sandbox environments. To run full integration tests against a real PostgreSQL instance:

1. Start PostgreSQL: `docker compose up -d`.
2. Set `DATABASE_URL` in `.env` and run `npm run prisma:migrate`.
3. Execute `POST /api/auth/register` -> `POST /api/tracking/register` -> `GET /api/track/:token` -> `GET /api/tracking/emails/:id` against the running server and assert persisted rows in `TrackedEmail` and `TrackingEvent`.

## 8. Manual Testing Procedure

1. Start PostgreSQL (`docker compose up -d`), run `npm run prisma:migrate`, and start the server (`npm run dev:server`).
2. Build the extension (`npm run build --workspace=@mailtrack/extension`) and load `apps/extension/dist` in `chrome://extensions`.
3. Click the MailTrack extension icon and **Create Account / Sign In**.
4. Open Gmail (`https://mail.google.com/`), click **Compose**, toggle **Track: ON**, and send a test email to an external address.
5. Verify the server records `TrackedEmail` (with `trackingTokenHash` only) and `GET /api/track/:token` records a `TrackingEvent` when loaded.
6. Test **Track: OFF** and confirm no registration request is made and Gmail sends natively.
7. Stop the backend server, attempt to send with **Track: ON**, and confirm the send is aborted with `Track: Error (retry)` and no silent untracked send occurs.
