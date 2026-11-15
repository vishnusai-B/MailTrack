// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  DashboardAnalyticsResponse,
  PaginatedTrackedEmailsResponse,
  PaginatedTrackingEventsResponse,
  TrackedEmailDetail,
  User,
} from '@mailtrack/shared';
import { App } from '../src/App.js';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const MOCK_USER: User = {
  id: 'user-1',
  email: 'alex@mailtrack.dev',
  name: 'Alex Rivera',
  defaultTrackingEnabled: true,
  createdAt: '2026-11-01T10:00:00.000Z',
  updatedAt: '2026-11-01T10:00:00.000Z',
};

const MOCK_ANALYTICS: DashboardAnalyticsResponse = {
  rangeDays: 30,
  from: '2026-10-16T00:00:00.000Z',
  to: '2026-11-14T10:00:00.000Z',
  statusCounts: {
    PENDING: 2,
    DISPATCHED: 4,
    SENT: 0,
    FAILED: 1,
    EXPIRED: 3,
    totalEmails: 10,
  },
  classificationCounts: {
    RECORDED: 5,
    LIKELY_PROXY: 2,
    SUSPECTED_SCANNER: 1,
    totalEvents: 8,
  },
  dailyActivity: [
    {
      date: '2026-11-13',
      totalEvents: 3,
      recorded: 2,
      likelyProxy: 1,
      suspectedScanner: 0,
    },
    {
      date: '2026-11-14',
      totalEvents: 5,
      recorded: 3,
      likelyProxy: 1,
      suspectedScanner: 1,
    },
  ],
  recentEvents: [
    {
      id: 'ev-1',
      trackedEmailId: 'trk-1',
      eventType: 'PIXEL_REQUEST',
      classification: 'RECORDED',
      occurredAt: '2026-11-14T09:30:00.000Z',
      createdAt: '2026-11-14T09:30:00.000Z',
      trackedEmail: {
        id: 'trk-1',
        subject: 'Q4 Partnership Deck',
        recipientReference: 'partner@acme.com',
        status: 'DISPATCHED',
      },
    },
  ],
};

const MOCK_EMAILS_PAGE_1: PaginatedTrackedEmailsResponse = {
  items: [
    {
      id: 'trk-1',
      userId: 'user-1',
      trackingTokenHash: 'sha256-hidden-hash-value',
      subject: 'Q4 Partnership Deck',
      recipientReference: 'partner@acme.com',
      status: 'DISPATCHED',
      sentAt: null,
      expiresAt: '2026-11-15T10:00:00.000Z',
      firstRecordedAt: '2026-11-14T09:30:00.000Z',
      createdAt: '2026-11-14T09:00:00.000Z',
      eventCount: 3,
      lastRecordedAt: '2026-11-14T09:45:00.000Z',
    },
  ],
  total: 2,
  page: 1,
  limit: 15,
  totalPages: 2,
};

const MOCK_EMAILS_PAGE_2: PaginatedTrackedEmailsResponse = {
  items: [
    {
      id: 'trk-2',
      userId: 'user-1',
      trackingTokenHash: 'sha256-hidden-hash-2',
      subject: 'Follow-up Notes',
      recipientReference: 'cto@example.org',
      status: 'EXPIRED',
      sentAt: null,
      expiresAt: '2026-11-10T10:00:00.000Z',
      firstRecordedAt: null,
      createdAt: '2026-11-09T10:00:00.000Z',
      eventCount: 0,
      lastRecordedAt: null,
    },
  ],
  total: 2,
  page: 2,
  limit: 15,
  totalPages: 2,
};

const MOCK_EMAIL_DETAIL: TrackedEmailDetail = {
  ...MOCK_EMAILS_PAGE_1.items[0]!,
  events: [
    {
      id: 'ev-1',
      trackedEmailId: 'trk-1',
      eventType: 'PIXEL_REQUEST',
      classification: 'RECORDED',
      occurredAt: '2026-11-14T09:30:00.000Z',
      createdAt: '2026-11-14T09:30:00.000Z',
    },
    {
      id: 'ev-2',
      trackedEmailId: 'trk-1',
      eventType: 'PIXEL_REQUEST',
      classification: 'LIKELY_PROXY',
      occurredAt: '2026-11-14T09:35:00.000Z',
      createdAt: '2026-11-14T09:35:00.000Z',
    },
    {
      id: 'ev-3',
      trackedEmailId: 'trk-1',
      eventType: 'PIXEL_REQUEST',
      classification: 'SUSPECTED_SCANNER',
      occurredAt: '2026-11-14T09:45:00.000Z',
      createdAt: '2026-11-14T09:45:00.000Z',
    },
  ],
};

const MOCK_EVENTS_PAGE: PaginatedTrackingEventsResponse = {
  items: [
    {
      id: 'ev-3',
      trackedEmailId: 'trk-1',
      eventType: 'PIXEL_REQUEST',
      classification: 'SUSPECTED_SCANNER',
      occurredAt: '2026-11-14T09:45:00.000Z',
      createdAt: '2026-11-14T09:45:00.000Z',
      trackedEmail: {
        id: 'trk-1',
        subject: 'Q4 Partnership Deck',
        recipientReference: 'partner@acme.com',
        status: 'DISPATCHED',
      },
    },
  ],
  total: 1,
  page: 1,
  limit: 20,
  totalPages: 1,
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function flush() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 10));
  });
}

describe('MailTrack Dashboard UI (Mocked API)', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    window.localStorage.clear();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    vi.restoreAllMocks();
  });

  it('renders sign-in screen when unauthenticated and logs in to show overview counts without human-open claims', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/health')) {
        return jsonResponse({
          status: 'ok',
          service: 'mailtrack-server',
          timestamp: '2026-11-14T10:00:00.000Z',
          uptimeSeconds: 100,
          database: 'connected',
        });
      }
      if (url.endsWith('/api/auth/login')) {
        return jsonResponse({ accessToken: 'jwt-123', user: MOCK_USER });
      }
      if (url.includes('/api/tracking/analytics')) {
        return jsonResponse(MOCK_ANALYTICS);
      }
      return jsonResponse({ error: 'Not found' }, 404);
    });
    vi.stubGlobal('fetch', fetchMock);

    await act(async () => {
      root.render(<App />);
    });
    await flush();

    expect(container.textContent).toContain('Sign in to your dashboard');

    const emailInput = container.querySelector('#auth-email') as HTMLInputElement;
    const passInput = container.querySelector('#auth-password') as HTMLInputElement;
    const form = container.querySelector('form')!;

    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      setter.call(emailInput, 'alex@mailtrack.dev');
      emailInput.dispatchEvent(new Event('input', { bubbles: true }));
      setter.call(passInput, 'password123');
      passInput.dispatchEvent(new Event('input', { bubbles: true }));
    });

    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    await flush();

    const text = container.textContent ?? '';
    expect(text).toContain('Total Tracked Emails');
    expect(text).toContain('10');
    expect(text).toContain('Pending');
    expect(text).toContain('Dispatched');
    expect(text).toContain('Failed');
    expect(text).toContain('Expired');
    expect(text).toContain('Pixel requests, not unique opens');
    expect(text).not.toContain('confirmed SENT');
    expect(text).toContain('Q4 Partnership Deck');
  });

  it('shows loading skeleton, empty state, and API error state on overview', async () => {
    window.localStorage.setItem('mailtrack_access_token', 'jwt-valid');

    let resolveAnalytics!: (res: Response) => void;
    const pendingAnalytics = new Promise<Response>((resolve) => {
      resolveAnalytics = resolve;
    });

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          status: 'ok',
          service: 'mailtrack-server',
          timestamp: '2026-11-14T10:00:00.000Z',
          uptimeSeconds: 10,
          database: 'connected',
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ user: MOCK_USER }))
      .mockReturnValueOnce(pendingAnalytics)
      .mockResolvedValueOnce(jsonResponse({ error: 'Database timeout' }, 500));

    vi.stubGlobal('fetch', fetchMock);

    await act(async () => {
      root.render(<App />);
    });
    await flush();

    // Loading skeleton visible while analytics promise is pending
    expect(container.querySelector('[aria-label="Loading summary metrics"]')).not.toBeNull();

    // Resolve with empty analytics
    await act(async () => {
      resolveAnalytics(
        jsonResponse({
          ...MOCK_ANALYTICS,
          statusCounts: {
            PENDING: 0,
            DISPATCHED: 0,
            SENT: 0,
            FAILED: 0,
            EXPIRED: 0,
            totalEmails: 0,
          },
          classificationCounts: {
            RECORDED: 0,
            LIKELY_PROXY: 0,
            SUSPECTED_SCANNER: 0,
            totalEvents: 0,
          },
          dailyActivity: [
            {
              date: '2026-11-14',
              totalEvents: 0,
              recorded: 0,
              likelyProxy: 0,
              suspectedScanner: 0,
            },
          ],
          recentEvents: [],
        }),
      );
    });
    await flush();

    expect(container.textContent).toContain('No tracking activity yet');

    // Navigate to Analytics and trigger 500 error state
    const analyticsNav = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Analytics'),
    )!;
    await act(async () => {
      analyticsNav.click();
    });
    await flush();

    expect(container.textContent).toContain('Unable to load analytics');
    expect(container.textContent).toContain('Database timeout');
  });

  it('handles 401 authentication failure by clearing session and returning to sign-in', async () => {
    window.localStorage.setItem('mailtrack_access_token', 'jwt-expired');

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/health')) {
        return jsonResponse({
          status: 'ok',
          service: 'mailtrack-server',
          timestamp: '',
          uptimeSeconds: 1,
          database: 'connected',
        });
      }
      if (url.endsWith('/api/auth/me')) {
        return jsonResponse(
          { error: 'Invalid or expired authentication token', code: 'UNAUTHORIZED' },
          401,
        );
      }
      return jsonResponse({}, 404);
    });
    vi.stubGlobal('fetch', fetchMock);

    await act(async () => {
      root.render(<App />);
    });
    await flush();

    expect(window.localStorage.getItem('mailtrack_access_token')).toBeNull();
    expect(container.textContent).toContain('Sign in to your dashboard');
    expect(container.textContent).toContain('session has expired');
  });

  it('supports server-side pagination, search, status filter, and email detail inspection without exposing tokens', async () => {
    window.localStorage.setItem('mailtrack_access_token', 'jwt-valid');

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/health')) {
        return jsonResponse({
          status: 'ok',
          service: 'mailtrack-server',
          timestamp: '',
          uptimeSeconds: 1,
          database: 'connected',
        });
      }
      if (url.endsWith('/api/auth/me')) {
        return jsonResponse({ user: MOCK_USER });
      }
      if (url.includes('/api/tracking/analytics')) {
        return jsonResponse(MOCK_ANALYTICS);
      }
      if (url.includes('/api/tracking/emails/trk-1')) {
        return jsonResponse(MOCK_EMAIL_DETAIL);
      }
      if (url.includes('/api/tracking/emails')) {
        if (url.includes('page=2')) {
          return jsonResponse(MOCK_EMAILS_PAGE_2);
        }
        return jsonResponse(MOCK_EMAILS_PAGE_1);
      }
      if (url.includes('/api/tracking/events')) {
        return jsonResponse(MOCK_EVENTS_PAGE);
      }
      return jsonResponse({}, 404);
    });
    vi.stubGlobal('fetch', fetchMock);

    await act(async () => {
      root.render(<App />);
    });
    await flush();

    // Navigate to Tracked Emails
    const emailsNav = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Tracked Emails',
    )!;
    await act(async () => {
      emailsNav.click();
    });
    await flush();

    expect(container.textContent).toContain('partner@acme.com');
    expect(container.textContent).toContain('Opened');
    expect(container.textContent).toContain('Showing page 1 of 2');

    // Click Next page
    const nextBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Next'),
    )!;
    await act(async () => {
      nextBtn.click();
    });
    await flush();

    expect(container.textContent).toContain('cto@example.org');
    expect(container.textContent).toContain('Showing page 2 of 2');

    // Filter by status
    const statusSelect = container.querySelector('#emails-status') as HTMLSelectElement;
    await act(async () => {
      statusSelect.value = 'DISPATCHED';
      statusSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await flush();

    expect(fetchMock.mock.calls.some(([u]) => String(u).includes('status=DISPATCHED'))).toBe(true);

    // Open Email Detail
    const viewDetailsBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('View details'),
    )!;
    await act(async () => {
      viewDetailsBtn.click();
    });
    await flush();

    const detailText = container.textContent ?? '';
    expect(detailText).toContain('Q4 Partnership Deck');
    expect(detailText).toContain('Opened');
    expect(detailText).toContain('RECORDED');
    expect(detailText).toContain('LIKELY_PROXY');
    expect(detailText).toContain('SUSPECTED_SCANNER');
    expect(detailText).toContain('do not establish whether a human read the email');
    expect(detailText).not.toContain('sha256-hidden-hash-value');

    // Navigate to Activity page
    const activityNav = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Activity',
    )!;
    await act(async () => {
      activityNav.click();
    });
    await flush();

    expect(container.textContent).toContain('SUSPECTED_SCANNER');
    expect(container.textContent).toContain('not counted as unique human opens');
  });

  it('renders Analytics charts, supports date range filtering, renders Settings, and handles search/date filters and cross-user 404', async () => {
    window.localStorage.setItem('mailtrack_access_token', 'jwt-valid');

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/health')) {
        return jsonResponse({
          status: 'ok',
          service: 'mailtrack-server',
          timestamp: '2026-11-14T10:00:00.000Z',
          uptimeSeconds: 42,
          database: 'connected',
        });
      }
      if (url.endsWith('/api/auth/me')) {
        return jsonResponse({ user: MOCK_USER });
      }
      if (url.includes('/api/tracking/analytics')) {
        if (url.includes('days=7')) {
          return jsonResponse({
            ...MOCK_ANALYTICS,
            rangeDays: 7,
            classificationCounts: {
              RECORDED: 3,
              LIKELY_PROXY: 1,
              SUSPECTED_SCANNER: 0,
              totalEvents: 4,
            },
          });
        }
        return jsonResponse(MOCK_ANALYTICS);
      }
      if (url.includes('/api/tracking/emails/trk-other-user')) {
        return jsonResponse({ error: 'Tracked email not found', code: 'NOT_FOUND' }, 404);
      }
      if (url.includes('/api/tracking/emails/trk-1')) {
        return jsonResponse(MOCK_EMAIL_DETAIL);
      }
      if (url.includes('/api/tracking/emails')) {
        return jsonResponse(MOCK_EMAILS_PAGE_1);
      }
      if (url.includes('/api/tracking/events')) {
        return jsonResponse(MOCK_EVENTS_PAGE);
      }
      return jsonResponse({}, 404);
    });
    vi.stubGlobal('fetch', fetchMock);

    await act(async () => {
      root.render(<App />);
    });
    await flush();

    // 1. Analytics page: charts + classification distribution + date range filter
    const analyticsNav = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Analytics',
    )!;
    await act(async () => {
      analyticsNav.click();
    });
    await flush();

    const analyticsText = container.textContent ?? '';
    expect(analyticsText).toContain('Recorded Pixel Requests Over Time (30d)');
    expect(analyticsText).toContain('Tracking Status Distribution');
    expect(analyticsText).toContain('Event Classification Distribution');
    expect(analyticsText).toContain('Daily Activity Trend by Classification');
    expect(analyticsText).toContain('5 (63%)'); // 5/8 RECORDED

    const rangeSelect = container.querySelector('#analytics-range') as HTMLSelectElement;
    await act(async () => {
      rangeSelect.value = '7';
      rangeSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await flush();

    expect(
      fetchMock.mock.calls.some(([u]) => String(u).includes('/api/tracking/analytics?days=7')),
    ).toBe(true);
    expect(container.textContent).toContain('Recorded Pixel Requests Over Time (7d)');

    // 2. Settings page
    const settingsNav = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Settings',
    )!;
    await act(async () => {
      settingsNav.click();
    });
    await flush();

    const settingsText = container.textContent ?? '';
    expect(settingsText).toContain('Account Profile');
    expect(settingsText).toContain('alex@mailtrack.dev');
    expect(settingsText).toContain('Enabled by default');
    expect(settingsText).toContain('Backend Connectivity');
    expect(settingsText).toContain('mailtrack-server');

    // 3. Tracked Emails search + date filter
    const emailsNav = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Tracked Emails',
    )!;
    await act(async () => {
      emailsNav.click();
    });
    await flush();

    const searchInput = container.querySelector('#emails-search') as HTMLInputElement;
    const fromInput = container.querySelector('#emails-from') as HTMLInputElement;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      setter.call(searchInput, 'partner');
      searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      setter.call(fromInput, '2026-11-01');
      fromInput.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise((r) => setTimeout(r, 300));
    });
    await flush();

    expect(
      fetchMock.mock.calls.some(([u]) => {
        const s = String(u);
        return s.includes('search=partner') && s.includes('from=2026-11-01T00%3A00%3A00.000Z');
      }),
    ).toBe(true);

    // 4. Activity date filter
    const activityNav = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Activity',
    )!;
    await act(async () => {
      activityNav.click();
    });
    await flush();

    const activityFrom = container.querySelector('#activity-from') as HTMLInputElement;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      setter.call(activityFrom, '2026-11-10');
      activityFrom.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await flush();

    expect(
      fetchMock.mock.calls.some(([u]) =>
        String(u).includes(
          '/api/tracking/events?page=1&limit=20&from=2026-11-10T00%3A00%3A00.000Z',
        ),
      ),
    ).toBe(true);
  });

  it('displays error state when accessing another user email (404 ownership enforcement)', async () => {
    window.localStorage.setItem('mailtrack_access_token', 'jwt-valid');

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/health')) {
        return jsonResponse({
          status: 'ok',
          service: 'mailtrack-server',
          timestamp: '',
          uptimeSeconds: 1,
          database: 'connected',
        });
      }
      if (url.endsWith('/api/auth/me')) {
        return jsonResponse({ user: MOCK_USER });
      }
      if (url.includes('/api/tracking/analytics')) {
        return jsonResponse({
          ...MOCK_ANALYTICS,
          recentEvents: [
            {
              ...MOCK_ANALYTICS.recentEvents[0]!,
              trackedEmail: {
                id: 'trk-forbidden',
                subject: 'Restricted',
                recipientReference: 'other@example.com',
                status: 'DISPATCHED',
              },
            },
          ],
        });
      }
      if (url.includes('/api/tracking/emails/trk-forbidden')) {
        return jsonResponse({ error: 'Tracked email not found', code: 'NOT_FOUND' }, 404);
      }
      return jsonResponse({}, 404);
    });
    vi.stubGlobal('fetch', fetchMock);

    await act(async () => {
      root.render(<App />);
    });
    await flush();

    const emailBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Restricted'),
    )!;
    await act(async () => {
      emailBtn.click();
    });
    await flush();

    expect(container.textContent).toContain('Unable to load email details');
    expect(container.textContent).toContain('Tracked email not found');
  });

  it('rotates expired access token using refresh token and handles 429 rate-limit responses', async () => {
    window.localStorage.setItem('mailtrack_access_token', 'expired-jwt');
    window.localStorage.setItem('mailtrack_refresh_token', 'valid-refresh-1');

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/health')) {
        return jsonResponse({
          status: 'ok',
          service: 'mailtrack-server',
          timestamp: '',
          uptimeSeconds: 1,
          database: 'connected',
        });
      }
      if (url.endsWith('/api/auth/me')) {
        // First call fails 401, retried call succeeds after refresh
        const authCalls = fetchMock.mock.calls.filter(([u]) =>
          String(u).endsWith('/api/auth/me'),
        ).length;
        if (authCalls === 1) {
          return jsonResponse({ error: 'Expired' }, 401);
        }
        return jsonResponse({ user: MOCK_USER });
      }
      if (url.endsWith('/api/auth/refresh')) {
        return jsonResponse({
          accessToken: 'fresh-jwt',
          refreshToken: 'rotated-refresh-2',
          user: MOCK_USER,
        });
      }
      if (url.includes('/api/tracking/analytics')) {
        return jsonResponse(MOCK_ANALYTICS);
      }
      if (url.endsWith('/api/auth/login')) {
        return jsonResponse({ error: 'Too many failed login attempts', code: 'RATE_LIMITED' }, 429);
      }
      return jsonResponse({}, 404);
    });
    vi.stubGlobal('fetch', fetchMock);

    await act(async () => {
      root.render(<App />);
    });
    await flush();

    expect(window.localStorage.getItem('mailtrack_access_token')).toBe('fresh-jwt');
    expect(window.localStorage.getItem('mailtrack_refresh_token')).toBe('rotated-refresh-2');
    expect(container.textContent).toContain('Total Tracked Emails');

    // Sign out and test 429 on login
    const signOutBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Sign out'),
    )!;
    await act(async () => {
      signOutBtn.click();
    });
    await flush();

    const emailInput = container.querySelector('#auth-email') as HTMLInputElement;
    const passInput = container.querySelector('#auth-password') as HTMLInputElement;
    const form = container.querySelector('form')!;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      setter.call(emailInput, 'alex@mailtrack.dev');
      emailInput.dispatchEvent(new Event('input', { bubbles: true }));
      setter.call(passInput, 'wrongpass');
      passInput.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    await flush();

    expect(container.textContent).toContain('Too many failed login attempts');
  });

  it('deduplicates concurrent 401 refreshes and stops without infinite loops when refresh fails', async () => {
    const { apiClient } = await import('../src/lib/api.js');
    window.localStorage.setItem('mailtrack_access_token', 'expired-jwt');
    window.localStorage.setItem('mailtrack_refresh_token', 'valid-refresh');

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/api/auth/refresh')) {
        return jsonResponse({
          accessToken: 'fresh-jwt',
          refreshToken: 'rotated-refresh',
          user: MOCK_USER,
        });
      }
      const headers = init?.headers as Headers | undefined;
      if (headers?.get('Authorization') === 'Bearer expired-jwt') {
        return jsonResponse({ error: 'Expired' }, 401);
      }
      return jsonResponse(MOCK_ANALYTICS);
    });
    vi.stubGlobal('fetch', fetchMock);

    const [a1, a2] = await Promise.all([
      apiClient.getAnalytics({ days: 7 }),
      apiClient.getAnalytics({ days: 30 }),
    ]);

    expect(a1.statusCounts.totalEmails).toBe(10);
    expect(a2.statusCounts.totalEmails).toBe(10);
    const refreshCalls = fetchMock.mock.calls.filter(([u]) =>
      String(u).endsWith('/api/auth/refresh'),
    );
    expect(refreshCalls).toHaveLength(1);

    // Now simulate refresh returning 401 -> clears tokens and rejects without infinite retry
    window.localStorage.setItem('mailtrack_access_token', 'expired-jwt-2');
    window.localStorage.setItem('mailtrack_refresh_token', 'revoked-refresh');
    const failingFetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/api/auth/refresh')) {
        return jsonResponse({ error: 'Revoked' }, 401);
      }
      return jsonResponse({ error: 'Expired' }, 401);
    });
    vi.stubGlobal('fetch', failingFetch);

    await expect(apiClient.getMe()).rejects.toThrow();
    expect(failingFetch).toHaveBeenCalledTimes(2); // 1 /me + 1 /refresh
    expect(window.localStorage.getItem('mailtrack_access_token')).toBeNull();
    expect(window.localStorage.getItem('mailtrack_refresh_token')).toBeNull();
  });

  it('creates, views details, and archives campaigns in the Campaigns section', async () => {
    window.localStorage.setItem('mailtrack_access_token', 'valid-jwt');
    let created = false;
    let archived = false;

    const baseCampaign = {
      id: 'cmp-1',
      userId: 'user-1',
      name: 'Q4 Enterprise Outreach',
      description: 'Outbound sequence for enterprise leads',
      status: 'ACTIVE' as const,
      archivedAt: null,
      createdAt: '2026-11-10T10:00:00.000Z',
      updatedAt: '2026-11-10T10:00:00.000Z',
      emailCount: 2,
      eventCount: 4,
      pendingReminderCount: 1,
    };

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method ?? 'GET';
        if (url.endsWith('/api/health')) {
          return jsonResponse({
            status: 'ok',
            service: 'mailtrack',
            timestamp: '2026-11-14T10:00:00Z',
          });
        }
        if (url.endsWith('/api/auth/me')) {
          return jsonResponse({ user: MOCK_USER });
        }
        if (url.includes('/api/tracking/analytics')) {
          return jsonResponse(MOCK_ANALYTICS);
        }
        if (url.includes('/api/campaigns/cmp-1/analytics')) {
          return jsonResponse({
            campaign: { ...baseCampaign, status: archived ? 'ARCHIVED' : 'ACTIVE' },
            rangeDays: 30,
            from: '2026-10-16T00:00:00.000Z',
            to: '2026-11-14T10:00:00.000Z',
            statusCounts: {
              PENDING: 0,
              DISPATCHED: 2,
              SENT: 0,
              FAILED: 0,
              EXPIRED: 0,
              totalEmails: 2,
            },
            classificationCounts: {
              RECORDED: 3,
              LIKELY_PROXY: 1,
              SUSPECTED_SCANNER: 0,
              totalEvents: 4,
            },
            reminderCounts: {
              PENDING: 1,
              COMPLETED: 0,
              CANCELLED: 0,
              totalReminders: 1,
            },
            dailyActivity: [],
            comparison: [],
          });
        }
        if (url.includes('/api/campaigns/cmp-1/emails')) {
          return jsonResponse({
            ...MOCK_EMAILS_PAGE_1,
            total: 1,
            totalPages: 1,
          });
        }
        if (url.includes('/api/reminders')) {
          return jsonResponse({
            items: [],
            total: 0,
            page: 1,
            limit: 10,
            totalPages: 1,
          });
        }
        if (url.endsWith('/api/campaigns/cmp-1/archive') && method === 'POST') {
          archived = true;
          return jsonResponse({
            ...baseCampaign,
            status: 'ARCHIVED',
            archivedAt: '2026-11-14T11:00:00.000Z',
          });
        }
        if (url.endsWith('/api/campaigns/cmp-1')) {
          return jsonResponse({ ...baseCampaign, status: archived ? 'ARCHIVED' : 'ACTIVE' });
        }
        if (url.includes('/api/campaigns') && method === 'POST') {
          created = true;
          return jsonResponse(baseCampaign, 201);
        }
        if (url.includes('/api/campaigns')) {
          return jsonResponse({
            items: created ? [{ ...baseCampaign, status: archived ? 'ARCHIVED' : 'ACTIVE' }] : [],
            total: created ? 1 : 0,
            page: 1,
            limit: 12,
            totalPages: 1,
          });
        }
        return jsonResponse({});
      }),
    );

    await act(async () => {
      root.render(<App />);
    });
    await flush();

    const campaignsBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Campaigns'),
    );
    expect(campaignsBtn).toBeTruthy();

    await act(async () => {
      campaignsBtn!.click();
    });
    await flush();

    const newCampaignBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('New Campaign'),
    );
    expect(newCampaignBtn).toBeTruthy();

    await act(async () => {
      newCampaignBtn!.click();
    });
    await flush();

    const nameInput = container.querySelector('#campaign-name') as HTMLInputElement;
    expect(nameInput).toBeTruthy();

    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setter?.call(nameInput, 'Q4 Enterprise Outreach');
      nameInput.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const createForm = nameInput.closest('form')!;
    await act(async () => {
      createForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    await flush();

    expect(container.textContent).toContain('Q4 Enterprise Outreach');

    const openCampaignBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Open',
    );
    expect(openCampaignBtn).toBeTruthy();
    await act(async () => {
      openCampaignBtn!.click();
    });
    await flush();

    expect(container.textContent).toContain('Campaign Details');
    expect(container.textContent).toContain('they do not establish unique human opens');

    const archiveBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Archive',
    );
    expect(archiveBtn).toBeTruthy();
    await act(async () => {
      archiveBtn!.click();
    });
    await flush();

    const confirmArchiveBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Confirm Archive',
    );
    expect(confirmArchiveBtn).toBeTruthy();
    await act(async () => {
      confirmArchiveBtn!.click();
    });
    await flush();

    expect(archived).toBe(true);
    expect(container.textContent).toContain('ARCHIVED');
  });

  it('lists and completes follow-up reminders in the Reminders section', async () => {
    window.localStorage.setItem('mailtrack_access_token', 'valid-jwt');
    let completed = false;

    const baseReminder = {
      id: 'rem-1',
      userId: 'user-1',
      trackedEmailId: 'trk-1',
      dueAt: '2026-11-16T09:00:00.000Z',
      note: 'Send pricing follow-up',
      status: 'PENDING' as const,
      completedAt: null,
      cancelledAt: null,
      createdAt: '2026-11-14T09:00:00.000Z',
      updatedAt: '2026-11-14T09:00:00.000Z',
      trackedEmail: {
        id: 'trk-1',
        subject: 'Q4 Partnership Deck',
        recipientReference: 'partner@acme.com',
        status: 'DISPATCHED' as const,
        campaignId: null,
        campaignName: null,
      },
    };

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method ?? 'GET';
        if (url.endsWith('/api/health')) {
          return jsonResponse({
            status: 'ok',
            service: 'mailtrack',
            timestamp: '2026-11-14T10:00:00Z',
          });
        }
        if (url.endsWith('/api/auth/me')) {
          return jsonResponse({ user: MOCK_USER });
        }
        if (url.includes('/api/tracking/analytics')) {
          return jsonResponse(MOCK_ANALYTICS);
        }
        if (url.endsWith('/api/reminders/rem-1/complete') && method === 'POST') {
          completed = true;
          return jsonResponse({
            ...baseReminder,
            status: 'COMPLETED',
            completedAt: '2026-11-14T12:00:00.000Z',
          });
        }
        if (url.includes('/api/reminders')) {
          return jsonResponse({
            items: [{ ...baseReminder, status: completed ? 'COMPLETED' : 'PENDING' }],
            total: 1,
            page: 1,
            limit: 15,
            totalPages: 1,
          });
        }
        return jsonResponse({});
      }),
    );

    await act(async () => {
      root.render(<App />);
    });
    await flush();

    const remindersBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Reminders'),
    );
    await act(async () => {
      remindersBtn!.click();
    });
    await flush();

    expect(container.textContent).toContain('Send pricing follow-up');
    expect(container.textContent).toContain('Q4 Partnership Deck');

    const completeBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Complete',
    );
    expect(completeBtn).toBeTruthy();

    await act(async () => {
      completeBtn!.click();
    });
    await flush();

    expect(completed).toBe(true);
    expect(container.textContent).toContain('COMPLETED');
  });

  it('triggers CSV export download from Tracked Emails page', async () => {
    window.localStorage.setItem('mailtrack_access_token', 'valid-jwt');
    const createObjectUrlSpy = vi.fn(() => 'blob:mock-csv');
    const revokeObjectUrlSpy = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', {
      value: createObjectUrlSpy,
      configurable: true,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      value: revokeObjectUrlSpy,
      configurable: true,
    });

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/api/health')) {
        return jsonResponse({
          status: 'ok',
          service: 'mailtrack',
          timestamp: '2026-11-14T10:00:00Z',
        });
      }
      if (url.endsWith('/api/auth/me')) {
        return jsonResponse({ user: MOCK_USER });
      }
      if (url.includes('/api/tracking/analytics')) {
        return jsonResponse(MOCK_ANALYTICS);
      }
      if (url.includes('/api/tracking/emails')) {
        return jsonResponse(MOCK_EMAILS_PAGE_1);
      }
      if (url.includes('/api/exports/emails')) {
        return new Response('id,subject\r\ntrk-1,Q4 Partnership Deck\r\n', {
          status: 200,
          headers: { 'Content-Type': 'text/csv; charset=utf-8' },
        });
      }
      return jsonResponse({});
    });
    vi.stubGlobal('fetch', fetchMock);

    await act(async () => {
      root.render(<App />);
    });
    await flush();

    const emailsBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Tracked Emails'),
    );
    await act(async () => {
      emailsBtn!.click();
    });
    await flush();

    const exportBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Export CSV'),
    );
    expect(exportBtn).toBeTruthy();

    await act(async () => {
      exportBtn!.click();
    });
    await flush();

    const exportCalls = fetchMock.mock.calls.filter(([u]) =>
      String(u).includes('/api/exports/emails'),
    );
    expect(exportCalls).toHaveLength(1);
    expect(createObjectUrlSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectUrlSpy).toHaveBeenCalledWith('blob:mock-csv');
  });

  it('validates VITE_API_URL in production builds and rejects missing or localhost URLs', async () => {
    const { resolveApiBaseUrl } = await import('../src/lib/api.js');

    expect(resolveApiBaseUrl(undefined, false)).toBe('http://localhost:4000');
    expect(resolveApiBaseUrl('https://api.example.com/', true)).toBe('https://api.example.com');
    expect(() => resolveApiBaseUrl(undefined, true)).toThrow(/VITE_API_URL is required/);
    expect(() => resolveApiBaseUrl('http://localhost:4000', true)).toThrow(/non-localhost HTTPS/);
    expect(() => resolveApiBaseUrl('http://api.example.com', true)).toThrow(/non-localhost HTTPS/);
  });
});
