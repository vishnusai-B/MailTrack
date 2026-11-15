import type {
  ApiErrorResponse,
  AuthResponse,
  Campaign,
  CampaignAnalyticsResponse,
  CampaignStatus,
  CreateCampaignRequest,
  CreateReminderRequest,
  DashboardAnalyticsResponse,
  EventClassification,
  FollowUpReminder,
  HealthCheckResponse,
  PaginatedCampaignsResponse,
  PaginatedRemindersResponse,
  PaginatedTrackedEmailsResponse,
  PaginatedTrackingEventsResponse,
  ReminderFilter,
  TrackedEmail,
  TrackedEmailDetail,
  TrackingStatus,
  UpdateCampaignRequest,
  UpdateReminderRequest,
  User,
} from '@mailtrack/shared';

const TOKEN_STORAGE_KEY = 'mailtrack_access_token';
const REFRESH_TOKEN_STORAGE_KEY = 'mailtrack_refresh_token';

const LOCALHOST_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1', '[::1]', '0.0.0.0']);

export function resolveApiBaseUrl(rawUrl: string | undefined, isProd: boolean): string {
  const trimmed = rawUrl?.trim() ?? '';
  if (!isProd) {
    return (trimmed || 'http://localhost:4000').replace(/\/+$/, '');
  }

  if (!trimmed) {
    throw new Error('VITE_API_URL is required in production builds.');
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error(`VITE_API_URL is not a valid URL: ${trimmed}`);
  }

  const host = parsed.hostname.toLowerCase();
  if (
    parsed.protocol !== 'https:' ||
    LOCALHOST_HOSTNAMES.has(host) ||
    host.endsWith('.localhost')
  ) {
    throw new Error(
      `VITE_API_URL must be a valid non-localhost HTTPS URL in production builds (received: ${trimmed}).`,
    );
  }

  return trimmed.replace(/\/+$/, '');
}

export function getApiBaseUrl(): string {
  return resolveApiBaseUrl(import.meta.env.VITE_API_URL, import.meta.env.PROD);
}

export function getStoredToken(): string | null {
  try {
    return window.localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function getStoredRefreshToken(): string | null {
  try {
    return window.localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string, refreshToken?: string): void {
  try {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
    if (refreshToken) {
      window.localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, refreshToken);
    }
  } catch {
    // Ignore storage errors in restricted environments
  }
}

export function clearStoredToken(): void {
  try {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    window.localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
}

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

let unauthorizedHandler: (() => void) | null = null;
let refreshInFlight: Promise<string | null> | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler;
}

async function tryRefreshAccessToken(): Promise<string | null> {
  const refreshToken = getStoredRefreshToken();
  if (!refreshToken) return null;

  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const res = await fetch(`${getApiBaseUrl()}/api/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
        if (!res.ok) return null;
        const data = (await res.json()) as AuthResponse;
        setStoredToken(data.accessToken, data.refreshToken);
        return data.accessToken;
      } catch {
        return null;
      } finally {
        refreshInFlight = null;
      }
    })();
  }

  return refreshInFlight;
}

async function requestJson<T>(
  path: string,
  options: RequestInit & { auth?: boolean; signal?: AbortSignal; _retried?: boolean } = {},
): Promise<T> {
  const { auth = true, headers, _retried = false, ...rest } = options;
  const requestHeaders = new Headers(headers);
  if (!requestHeaders.has('Content-Type') && rest.body) {
    requestHeaders.set('Content-Type', 'application/json');
  }

  if (auth) {
    const token = getStoredToken();
    if (token) {
      requestHeaders.set('Authorization', `Bearer ${token}`);
    }
  }

  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...rest,
    headers: requestHeaders,
  });

  if (!response.ok) {
    if (response.status === 401 && auth && !_retried) {
      const nextToken = await tryRefreshAccessToken();
      if (nextToken) {
        return requestJson<T>(path, { ...options, _retried: true });
      }
    }

    let message =
      response.status === 429
        ? 'Too many requests. Please wait a moment and try again.'
        : `Request failed (${response.status})`;
    let code: string | undefined;
    try {
      const errBody = (await response.json()) as Partial<ApiErrorResponse>;
      if (typeof errBody.error === 'string' && errBody.error.trim()) {
        message = errBody.error;
      }
      if (typeof errBody.code === 'string') {
        code = errBody.code;
      }
    } catch {
      // Ignore non-JSON error body
    }

    if (response.status === 401 && auth) {
      clearStoredToken();
      unauthorizedHandler?.();
    }

    throw new ApiError(response.status, message, code);
  }

  return (await response.json()) as T;
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      search.set(key, String(value));
    }
  }
  const serialized = search.toString();
  return serialized ? `?${serialized}` : '';
}

export const apiClient = {
  getHealth(signal?: AbortSignal): Promise<HealthCheckResponse> {
    return requestJson<HealthCheckResponse>('/health', { auth: false, signal });
  },

  login(email: string, password: string): Promise<AuthResponse> {
    return requestJson<AuthResponse>('/api/auth/login', {
      auth: false,
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  register(email: string, password: string, name?: string): Promise<AuthResponse> {
    return requestJson<AuthResponse>('/api/auth/register', {
      auth: false,
      method: 'POST',
      body: JSON.stringify({ email, password, ...(name ? { name } : {}) }),
    });
  },

  getMe(signal?: AbortSignal): Promise<{ user: User }> {
    return requestJson<{ user: User }>('/api/auth/me', { signal });
  },

  async logout(): Promise<void> {
    const refreshToken = getStoredRefreshToken();
    clearStoredToken();
    if (!refreshToken) return;
    try {
      await fetch(`${getApiBaseUrl()}/api/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
    } catch {
      // Best-effort revocation on sign-out
    }
  },

  getAnalytics(
    params: { days?: number; from?: string; to?: string } = {},
    signal?: AbortSignal,
  ): Promise<DashboardAnalyticsResponse> {
    const query = buildQuery({
      days: params.days,
      from: params.from,
      to: params.to,
    });
    return requestJson<DashboardAnalyticsResponse>(`/api/tracking/analytics${query}`, { signal });
  },

  listTrackedEmails(
    params: {
      page?: number;
      limit?: number;
      search?: string;
      status?: TrackingStatus | '';
      from?: string;
      to?: string;
    } = {},
    signal?: AbortSignal,
  ): Promise<PaginatedTrackedEmailsResponse> {
    const query = buildQuery({
      page: params.page ?? 1,
      limit: params.limit ?? 15,
      search: params.search?.trim() || undefined,
      status: params.status || undefined,
      from: params.from || undefined,
      to: params.to || undefined,
    });
    return requestJson<PaginatedTrackedEmailsResponse>(`/api/tracking/emails${query}`, { signal });
  },

  getTrackedEmailDetail(id: string, signal?: AbortSignal): Promise<TrackedEmailDetail> {
    return requestJson<TrackedEmailDetail>(`/api/tracking/emails/${encodeURIComponent(id)}`, {
      signal,
    });
  },

  listTrackingEvents(
    params: {
      page?: number;
      limit?: number;
      classification?: EventClassification | '';
      from?: string;
      to?: string;
    } = {},
    signal?: AbortSignal,
  ): Promise<PaginatedTrackingEventsResponse> {
    const query = buildQuery({
      page: params.page ?? 1,
      limit: params.limit ?? 20,
      classification: params.classification || undefined,
      from: params.from || undefined,
      to: params.to || undefined,
    });
    return requestJson<PaginatedTrackingEventsResponse>(`/api/tracking/events${query}`, { signal });
  },

  assignEmailCampaign(emailId: string, campaignId: string | null): Promise<TrackedEmail> {
    return requestJson<TrackedEmail>(
      `/api/tracking/emails/${encodeURIComponent(emailId)}/campaign`,
      {
        method: 'PATCH',
        body: JSON.stringify({ campaignId }),
      },
    );
  },

  listCampaigns(
    params: {
      page?: number;
      limit?: number;
      search?: string;
      status?: CampaignStatus | '';
    } = {},
    signal?: AbortSignal,
  ): Promise<PaginatedCampaignsResponse> {
    const query = buildQuery({
      page: params.page ?? 1,
      limit: params.limit ?? 20,
      search: params.search?.trim() || undefined,
      status: params.status || undefined,
    });
    return requestJson<PaginatedCampaignsResponse>(`/api/campaigns${query}`, { signal });
  },

  createCampaign(input: CreateCampaignRequest): Promise<Campaign> {
    return requestJson<Campaign>('/api/campaigns', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  getCampaign(id: string, signal?: AbortSignal): Promise<Campaign> {
    return requestJson<Campaign>(`/api/campaigns/${encodeURIComponent(id)}`, { signal });
  },

  updateCampaign(id: string, input: UpdateCampaignRequest): Promise<Campaign> {
    return requestJson<Campaign>(`/api/campaigns/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  },

  archiveCampaign(id: string): Promise<Campaign> {
    return requestJson<Campaign>(`/api/campaigns/${encodeURIComponent(id)}/archive`, {
      method: 'POST',
    });
  },

  listCampaignEmails(
    campaignId: string,
    params: { page?: number; limit?: number; search?: string; status?: TrackingStatus | '' } = {},
    signal?: AbortSignal,
  ): Promise<PaginatedTrackedEmailsResponse> {
    const query = buildQuery({
      page: params.page ?? 1,
      limit: params.limit ?? 15,
      search: params.search?.trim() || undefined,
      status: params.status || undefined,
    });
    return requestJson<PaginatedTrackedEmailsResponse>(
      `/api/campaigns/${encodeURIComponent(campaignId)}/emails${query}`,
      { signal },
    );
  },

  getCampaignAnalytics(
    campaignId: string,
    params: { days?: number } = {},
    signal?: AbortSignal,
  ): Promise<CampaignAnalyticsResponse> {
    const query = buildQuery({ days: params.days ?? 30 });
    return requestJson<CampaignAnalyticsResponse>(
      `/api/campaigns/${encodeURIComponent(campaignId)}/analytics${query}`,
      { signal },
    );
  },

  listReminders(
    params: {
      page?: number;
      limit?: number;
      filter?: ReminderFilter;
      campaignId?: string;
      trackedEmailId?: string;
    } = {},
    signal?: AbortSignal,
  ): Promise<PaginatedRemindersResponse> {
    const query = buildQuery({
      page: params.page ?? 1,
      limit: params.limit ?? 20,
      filter: params.filter ?? 'upcoming',
      campaignId: params.campaignId,
      trackedEmailId: params.trackedEmailId,
    });
    return requestJson<PaginatedRemindersResponse>(`/api/reminders${query}`, { signal });
  },

  createReminder(input: CreateReminderRequest): Promise<FollowUpReminder> {
    return requestJson<FollowUpReminder>('/api/reminders', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  updateReminder(id: string, input: UpdateReminderRequest): Promise<FollowUpReminder> {
    return requestJson<FollowUpReminder>(`/api/reminders/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  },

  completeReminder(id: string): Promise<FollowUpReminder> {
    return requestJson<FollowUpReminder>(`/api/reminders/${encodeURIComponent(id)}/complete`, {
      method: 'POST',
    });
  },

  cancelReminder(id: string): Promise<FollowUpReminder> {
    return requestJson<FollowUpReminder>(`/api/reminders/${encodeURIComponent(id)}/cancel`, {
      method: 'POST',
    });
  },

  async downloadCsv(
    path: string,
    params: Record<string, string | number | undefined>,
    filename: string,
  ): Promise<void> {
    const query = buildQuery(params);
    const token = getStoredToken();
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;

    let response = await fetch(`${getApiBaseUrl()}${path}${query}`, { headers });
    if (response.status === 401) {
      const nextToken = await tryRefreshAccessToken();
      if (nextToken) {
        response = await fetch(`${getApiBaseUrl()}${path}${query}`, {
          headers: { Authorization: `Bearer ${nextToken}` },
        });
      }
    }

    if (!response.ok) {
      if (response.status === 401) {
        clearStoredToken();
        unauthorizedHandler?.();
      }
      throw new ApiError(response.status, `Export failed (${response.status})`);
    }

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
  },
};
