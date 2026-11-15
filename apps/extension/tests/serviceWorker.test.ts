// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { storageData, mockChrome } = vi.hoisted(() => {
  const data: Record<string, unknown> = {};
  const chromeObj = {
    runtime: {
      id: 'ext-mailtrack-id',
      onInstalled: { addListener: vi.fn() },
      onMessage: { addListener: vi.fn() },
    },
    storage: {
      local: {
        get: vi.fn(async (keys: string[]) => {
          const result: Record<string, unknown> = {};
          for (const key of keys) {
            if (key in data) result[key] = data[key];
          }
          return result;
        }),
        set: vi.fn(async (items: Record<string, unknown>) => {
          Object.assign(data, items);
        }),
      },
    },
  };
  vi.stubGlobal('chrome', chromeObj);
  return { storageData: data, mockChrome: chromeObj };
});

import { handleExtensionMessage } from '../src/background/service-worker.js';

void mockChrome;

describe('Extension Service Worker Security', () => {
  beforeEach(() => {
    for (const key of Object.keys(storageData)) {
      delete storageData[key];
    }
    vi.restoreAllMocks();
  });

  it('rejects messages from unauthorized or missing senders and non-Gmail tabs', async () => {
    const res = await handleExtensionMessage({ type: 'GET_PREFERENCES' }, {
      id: 'malicious-extension-id',
    } as chrome.runtime.MessageSender);
    expect(res).toEqual({ ok: false, error: 'Unauthorized message sender' });

    const missingIdRes = await handleExtensionMessage(
      { type: 'GET_PREFERENCES' },
      {} as chrome.runtime.MessageSender,
    );
    expect(missingIdRes).toEqual({ ok: false, error: 'Unauthorized message sender' });

    const badOriginRes = await handleExtensionMessage({ type: 'GET_PREFERENCES' }, {
      id: 'ext-mailtrack-id',
      tab: { id: 1 },
      url: 'https://evil.example.com/',
    } as chrome.runtime.MessageSender);
    expect(badOriginRes).toEqual({ ok: false, error: 'Unauthorized tab origin' });
  });

  it('blocks content scripts from invoking popup-only auth/preference actions', async () => {
    const contentSender = {
      id: 'ext-mailtrack-id',
      tab: { id: 1 },
      url: 'https://mail.google.com/mail/u/0/',
    } as chrome.runtime.MessageSender;

    const loginRes = await handleExtensionMessage(
      { type: 'LOGIN', email: 'a@b.com', password: 'password123' },
      contentSender,
    );
    expect(loginRes).toEqual({ ok: false, error: 'Action not permitted from content script' });

    const logoutRes = await handleExtensionMessage({ type: 'LOGOUT' }, contentSender);
    expect(logoutRes).toEqual({ ok: false, error: 'Action not permitted from content script' });
  });

  it('never exposes tokens in GET_PREFERENCES and deduplicates concurrent 401 refreshes', async () => {
    storageData.accessToken = 'expired-access-jwt';
    storageData.refreshToken = 'valid-refresh-token';
    storageData.userEmail = 'alex@mailtrack.dev';

    const gmailSender = {
      id: 'ext-mailtrack-id',
      tab: { id: 1 },
      url: 'https://mail.google.com/mail/u/0/',
    } as chrome.runtime.MessageSender;

    const prefsRes = await handleExtensionMessage({ type: 'GET_PREFERENCES' }, gmailSender);
    expect(prefsRes).toEqual({
      ok: true,
      data: {
        defaultTrackingEnabled: false,
        authenticated: true,
        userEmail: 'alex@mailtrack.dev',
      },
    });
    expect(JSON.stringify(prefsRes)).not.toContain('expired-access-jwt');
    expect(JSON.stringify(prefsRes)).not.toContain('valid-refresh-token');

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/api/auth/refresh')) {
        return new Response(
          JSON.stringify({
            accessToken: 'fresh-access-jwt',
            refreshToken: 'rotated-refresh-token',
            user: { email: 'alex@mailtrack.dev' },
          }),
          { status: 200 },
        );
      }
      const authHeader = (init?.headers as Record<string, string> | undefined)?.Authorization;
      if (authHeader === 'Bearer expired-access-jwt') {
        return new Response(JSON.stringify({ error: 'Expired' }), { status: 401 });
      }
      return new Response(
        JSON.stringify({
          trackingId: 'trk-99',
          pixelUrl: 'http://localhost:4000/api/track/token',
        }),
        { status: 201 },
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const [reg1, reg2] = await Promise.all([
      handleExtensionMessage(
        { type: 'REGISTER_TRACKING', recipientReference: 'lead1@example.com', subject: 'Hi' },
        gmailSender,
      ),
      handleExtensionMessage(
        { type: 'REGISTER_TRACKING', recipientReference: 'lead2@example.com', subject: 'Hi' },
        gmailSender,
      ),
    ]);

    expect(reg1.ok).toBe(true);
    expect(reg2.ok).toBe(true);
    const refreshCalls = fetchMock.mock.calls.filter(([u]) =>
      String(u).endsWith('/api/auth/refresh'),
    );
    expect(refreshCalls).toHaveLength(1);
    expect(storageData.accessToken).toBe('fresh-access-jwt');
    expect(storageData.refreshToken).toBe('rotated-refresh-token');
  });

  it('clears session without infinite retries when refresh fails with 401', async () => {
    storageData.accessToken = 'expired-access-jwt';
    storageData.refreshToken = 'revoked-refresh-token';
    storageData.userEmail = 'alex@mailtrack.dev';

    const gmailSender = {
      id: 'ext-mailtrack-id',
      tab: { id: 1 },
      url: 'https://mail.google.com/mail/u/0/',
    } as chrome.runtime.MessageSender;

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/api/auth/refresh')) {
        return new Response(JSON.stringify({ error: 'Reused' }), { status: 401 });
      }
      return new Response(JSON.stringify({ error: 'Expired' }), { status: 401 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const res = await handleExtensionMessage(
      { type: 'REGISTER_TRACKING', recipientReference: 'lead@example.com' },
      gmailSender,
    );

    expect(res.ok).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(storageData.accessToken).toBeNull();
    expect(storageData.refreshToken).toBeNull();
  });
});
