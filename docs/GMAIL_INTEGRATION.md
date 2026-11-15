# Gmail Compose Integration (Phase 2)

## Overview

The MailTrack Chrome Extension integrates with Gmail (`https://mail.google.com/*`) to render an isolated **Track: ON / OFF** toggle inside every active compose toolbar (new emails, replies, and forwards) without reading the inbox or interfering with Gmail's native Send flow.

## Architecture

- **`src/content/gmailSelectors.ts`**: Centralized semantic selectors for Gmail compose dialogs (`div[role="dialog"]`, `div.M9`, `table.aoP`, `div.ip`), Send buttons, and toolbar anchors.
- **`src/content/composeState.ts`**: `ComposeStateManager` maintains an isolated `ComposeDraftState` per compose window. Global default changes apply only to newly created drafts and never mutate open drafts.
- **`src/content/toggleView.ts`**: `ToggleView` renders the **Track: ON / OFF** button inside an isolated `ShadowRoot` (`data-mailtrack-toggle-host="1"`) with accessible `aria-pressed` and `aria-label` attributes.
- **`src/content/composeManager.ts`**: `ComposeManager` uses a `requestAnimationFrame`-throttled `MutationObserver` plus `hashchange` / `popstate` listeners to detect new compose windows, prevent duplicate controls, and clean up destroyed drafts.
- **`src/background/service-worker.ts`**: Stateless MV3 service worker handling `PING`, `GET_PREFERENCES`, and `SET_DEFAULT_TRACKING` backed by `chrome.storage.local`.

## Manual Testing Checklist

1. **Build & Load Extension:**
   - Run `npm run build --workspace=@mailtrack/extension`.
   - Open `chrome://extensions`, enable **Developer mode**, click **Load unpacked**, and select `apps/extension/dist`.
2. **Initial Gmail Load:**
   - Open `https://mail.google.com/` and verify there are no console errors.
3. **New Compose Window:**
   - Click **Compose**. Verify the **Track: OFF** pill appears next to the Send toolbar.
   - Click it to switch to **Track: ON** (`aria-pressed="true"`).
4. **Reply & Forward:**
   - Open any thread, click **Reply**, and verify an independent **Track: OFF** pill appears.
   - Open **Forward** on a message and verify an independent **Track: OFF** pill appears.
5. **Multiple Simultaneous Drafts:**
   - Open two floating compose windows side by side. Toggle Window A to **ON** and confirm Window B remains **OFF**.
6. **Closing Drafts:**
   - Close Window A (discard or close) and confirm no errors or orphaned DOM nodes remain.
7. **Gmail SPA Navigation:**
   - Switch between Inbox, Sent, and Drafts without refreshing; open a new compose window and confirm the toggle attaches cleanly with no duplicates.
8. **Global Default Preference & Persistence:**
   - Click the MailTrack extension icon, toggle **Default for new drafts** ON, close and reopen the popup to verify persistence in `chrome.storage.local`.
   - Confirm already-open compose windows keep their existing state, while newly opened compose windows start as **Track: ON**.
9. **Extension Reload:**
   - Click **Reload** on the extension card in `chrome://extensions`, refresh Gmail, and verify compose detection resumes cleanly.
