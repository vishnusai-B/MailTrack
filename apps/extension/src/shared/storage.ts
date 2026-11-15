declare const __MAILTRACK_API_URL__: string | undefined;
declare const __MAILTRACK_PROD_BUILD__: boolean | undefined;

const LOCALHOST_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1', '[::1]', '0.0.0.0']);

export const DEFAULT_API_BASE_URL =
  typeof __MAILTRACK_API_URL__ === 'string' && __MAILTRACK_API_URL__
    ? __MAILTRACK_API_URL__.replace(/\/+$/, '')
    : 'http://localhost:4000';

export const IS_EXTENSION_PROD_BUILD =
  typeof __MAILTRACK_PROD_BUILD__ === 'boolean' ? __MAILTRACK_PROD_BUILD__ : false;

export interface StoredExtensionState {
  defaultTrackingEnabled: boolean;
  accessToken: string | null;
  refreshToken: string | null;
  userEmail: string | null;
  apiBaseUrl: string;
}

export const DEFAULT_STORAGE_STATE: StoredExtensionState = {
  // Explicit opt-in: tracking is OFF by default until user enables it
  defaultTrackingEnabled: false,
  accessToken: null,
  refreshToken: null,
  userEmail: null,
  apiBaseUrl: DEFAULT_API_BASE_URL,
};

export function resolveExtensionApiBaseUrl(
  storedApiBaseUrl: unknown,
  defaultApiBaseUrl: string = DEFAULT_API_BASE_URL,
  isProdBuild: boolean = IS_EXTENSION_PROD_BUILD,
): string {
  if (typeof storedApiBaseUrl !== 'string' || !storedApiBaseUrl.trim()) {
    return defaultApiBaseUrl;
  }

  const trimmed = storedApiBaseUrl.trim().replace(/\/+$/, '');
  if (!isProdBuild) {
    return trimmed;
  }

  // In production release builds, never allow stale localhost/HTTP stored URLs to override the build URL
  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.toLowerCase();
    if (
      parsed.protocol !== 'https:' ||
      LOCALHOST_HOSTNAMES.has(host) ||
      host.endsWith('.localhost')
    ) {
      return defaultApiBaseUrl;
    }
    return trimmed;
  } catch {
    return defaultApiBaseUrl;
  }
}

export async function getStoredState(): Promise<StoredExtensionState> {
  const stored = await chrome.storage.local.get(Object.keys(DEFAULT_STORAGE_STATE));
  return {
    defaultTrackingEnabled:
      typeof stored.defaultTrackingEnabled === 'boolean'
        ? stored.defaultTrackingEnabled
        : DEFAULT_STORAGE_STATE.defaultTrackingEnabled,
    accessToken: typeof stored.accessToken === 'string' ? stored.accessToken : null,
    refreshToken: typeof stored.refreshToken === 'string' ? stored.refreshToken : null,
    userEmail: typeof stored.userEmail === 'string' ? stored.userEmail : null,
    apiBaseUrl: resolveExtensionApiBaseUrl(stored.apiBaseUrl),
  };
}

export async function setDefaultTrackingEnabled(enabled: boolean): Promise<void> {
  await chrome.storage.local.set({ defaultTrackingEnabled: enabled });
}

export async function saveAuthSession(
  accessToken: string,
  userEmail: string,
  refreshToken?: string | null,
): Promise<void> {
  await chrome.storage.local.set({
    accessToken,
    userEmail,
    ...(refreshToken !== undefined ? { refreshToken } : {}),
  });
}

export async function clearAuthSession(): Promise<void> {
  await chrome.storage.local.set({ accessToken: null, refreshToken: null, userEmail: null });
}
