import type { AuthResponse, RegisterTrackingResponse } from '@mailtrack/shared';
import type {
  ExtensionMessage,
  ExtensionPreferences,
  ExtensionResponse,
} from '../shared/messages.js';
import {
  clearAuthSession,
  DEFAULT_STORAGE_STATE,
  getStoredState,
  saveAuthSession,
  setDefaultTrackingEnabled,
} from '../shared/storage.js';

const EXTENSION_ONLY_MESSAGE_TYPES = new Set<ExtensionMessage['type']>([
  'LOGIN',
  'REGISTER',
  'LOGOUT',
  'SET_DEFAULT_TRACKING',
]);

let refreshPromise: Promise<string | null> | null = null;

chrome.runtime.onInstalled.addListener(() => {
  void (async () => {
    const existing = await chrome.storage.local.get(['defaultTrackingEnabled']);
    if (typeof existing.defaultTrackingEnabled !== 'boolean') {
      await chrome.storage.local.set({
        defaultTrackingEnabled: DEFAULT_STORAGE_STATE.defaultTrackingEnabled,
      });
    }
  })();
});

async function tryRefreshSession(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const state = await getStoredState();
        if (!state.refreshToken) {
          await clearAuthSession();
          return null;
        }
        const url = `${state.apiBaseUrl.replace(/\/+$/, '')}/api/auth/refresh`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: state.refreshToken }),
        });
        if (!res.ok) {
          await clearAuthSession();
          return null;
        }
        const auth = (await res.json()) as AuthResponse;
        await saveAuthSession(auth.accessToken, auth.user.email, auth.refreshToken ?? null);
        return auth.accessToken;
      } catch {
        return null;
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
}

async function apiRequest<T>(
  path: string,
  body: unknown,
  token?: string | null,
  method: 'POST' | 'PATCH' = 'POST',
  allowRefresh = true,
): Promise<T> {
  const state = await getStoredState();
  const url = `${state.apiBaseUrl.replace(/\/+$/, '')}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    method,
    headers,
    body: JSON.stringify(body),
  });

  if (res.status === 401 && token) {
    if (allowRefresh) {
      const nextToken = await tryRefreshSession();
      if (nextToken) {
        return apiRequest<T>(path, body, nextToken, method, false);
      }
    } else {
      await clearAuthSession();
    }
  }

  if (!res.ok) {
    const errBody = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(errBody.error || `Request failed (${res.status})`);
  }

  return (await res.json()) as T;
}

async function toPreferences(): Promise<ExtensionPreferences> {
  const state = await getStoredState();
  return {
    defaultTrackingEnabled: state.defaultTrackingEnabled,
    authenticated: Boolean(state.accessToken),
    userEmail: state.userEmail,
  };
}

function isValidMessage(value: unknown): value is ExtensionMessage {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { type?: unknown }).type === 'string'
  );
}

export async function handleExtensionMessage(
  message: unknown,
  sender: chrome.runtime.MessageSender,
): Promise<ExtensionResponse> {
  try {
    if (!sender.id || sender.id !== chrome.runtime.id) {
      return { ok: false, error: 'Unauthorized message sender' };
    }

    if (sender.tab) {
      if (!sender.url || !sender.url.startsWith('https://mail.google.com/')) {
        return { ok: false, error: 'Unauthorized tab origin' };
      }
    } else if (sender.url && !sender.url.startsWith(`chrome-extension://${chrome.runtime.id}/`)) {
      return { ok: false, error: 'Unauthorized extension origin' };
    }

    if (!isValidMessage(message)) {
      return { ok: false, error: 'Invalid extension message' };
    }

    // Prevent content scripts from invoking popup-only auth/settings mutations
    if (sender.tab && EXTENSION_ONLY_MESSAGE_TYPES.has(message.type)) {
      return { ok: false, error: 'Action not permitted from content script' };
    }

    switch (message.type) {
      case 'PING':
        return { ok: true, data: { service: 'mailtrack-extension' } };

      case 'GET_PREFERENCES': {
        return { ok: true, data: await toPreferences() };
      }

      case 'SET_DEFAULT_TRACKING': {
        await setDefaultTrackingEnabled(Boolean(message.enabled));
        return { ok: true, data: await toPreferences() };
      }

      case 'LOGIN': {
        if (typeof message.email !== 'string' || typeof message.password !== 'string') {
          return { ok: false, error: 'Email and password are required' };
        }
        const auth = await apiRequest<AuthResponse>('/api/auth/login', {
          email: message.email,
          password: message.password,
        });
        await saveAuthSession(auth.accessToken, auth.user.email, auth.refreshToken ?? null);
        return { ok: true, data: await toPreferences() };
      }

      case 'REGISTER': {
        if (typeof message.email !== 'string' || typeof message.password !== 'string') {
          return { ok: false, error: 'Email and password are required' };
        }
        const auth = await apiRequest<AuthResponse>('/api/auth/register', {
          email: message.email,
          password: message.password,
          name: typeof message.name === 'string' ? message.name : undefined,
        });
        await saveAuthSession(auth.accessToken, auth.user.email, auth.refreshToken ?? null);
        return { ok: true, data: await toPreferences() };
      }

      case 'LOGOUT': {
        const state = await getStoredState();
        await clearAuthSession();
        if (state.refreshToken) {
          void apiRequest('/api/auth/logout', { refreshToken: state.refreshToken }, null).catch(
            () => {
              // Best-effort server-side revocation
            },
          );
        }
        return { ok: true, data: await toPreferences() };
      }

      case 'REGISTER_TRACKING': {
        if (typeof message.recipientReference !== 'string' || !message.recipientReference.trim()) {
          return { ok: false, error: 'Recipient email address is required' };
        }
        const recipientParts = message.recipientReference
          .split(',')
          .map((part) => part.trim())
          .filter(Boolean);
        const emailPattern = /^[^\s@<>",;]+@[^\s@<>",;]+\.[^\s@<>",;]{2,}$/;
        if (
          recipientParts.length === 0 ||
          recipientParts.some((part) => !emailPattern.test(part))
        ) {
          return { ok: false, error: 'Invalid recipient email address' };
        }
        const state = await getStoredState();
        if (!state.accessToken) {
          return {
            ok: false,
            error: 'Sign in to MailTrack extension before sending tracked emails.',
          };
        }
        const registered = await apiRequest<RegisterTrackingResponse>(
          '/api/tracking/register',
          {
            recipientReference: message.recipientReference,
            subject: typeof message.subject === 'string' ? message.subject : undefined,
          },
          state.accessToken,
        );
        return { ok: true, data: registered };
      }

      case 'UPDATE_TRACKING_STATUS': {
        if (
          typeof message.trackingId !== 'string' ||
          !message.trackingId.trim() ||
          (message.status !== 'DISPATCHED' && message.status !== 'FAILED')
        ) {
          return { ok: false, error: 'Invalid tracking status update' };
        }
        const state = await getStoredState();
        if (!state.accessToken) {
          return { ok: false, error: 'Not authenticated' };
        }
        await apiRequest(
          `/api/tracking/emails/${encodeURIComponent(message.trackingId)}/status`,
          { status: message.status },
          state.accessToken,
          'PATCH',
        );
        return { ok: true, data: null };
      }

      default:
        return { ok: false, error: 'Unsupported extension message' };
    }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Unexpected extension error',
    };
  }
}

chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
  void handleExtensionMessage(message, sender).then(sendResponse);
  return true;
});
