import { useCallback, useEffect, useState } from 'react';
import type { DashboardAnalyticsResponse } from '@mailtrack/shared';
import { DailyActivityChart, StatusDistributionChart } from '../components/Charts.js';
import { EmptyState } from '../components/EmptyState.js';
import { ErrorState } from '../components/ErrorState.js';
import { CardSkeleton, ChartSkeleton } from '../components/Skeleton.js';
import { ClassificationBadge, TrackingStatusBadge } from '../components/StatusBadge.js';
import { ApiError, apiClient } from '../lib/api.js';
import { formatDateTime, formatRelativeTime } from '../lib/format.js';

interface OverviewPageProps {
  onSelectEmail: (emailId: string) => void;
  onNavigateEmails: () => void;
  onNavigateActivity: () => void;
}

export function OverviewPage({
  onSelectEmail,
  onNavigateEmails,
  onNavigateActivity,
}: OverviewPageProps) {
  const [data, setData] = useState<DashboardAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadOverview = useCallback((signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    apiClient
      .getAnalytics({ days: 30 }, signal)
      .then((res) => {
        setData(res);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setError(err instanceof ApiError ? err.message : 'Unable to load dashboard overview.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadOverview(controller.signal);
    return () => controller.abort();
  }, [loadOverview]);

  if (loading) {
    return (
      <div className="space-y-6">
        <CardSkeleton count={6} />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <ChartSkeleton />
          <ChartSkeleton />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <ErrorState
        title="Failed to load overview"
        message={error ?? 'No analytics data returned.'}
        onRetry={() => loadOverview()}
      />
    );
  }

  const { statusCounts, classificationCounts, dailyActivity, recentEvents } = data;

  const summaryCards = [
    {
      label: 'Total Tracked Emails',
      value: statusCounts.totalEmails,
      sublabel:
        statusCounts.SENT > 0 ? `${statusCounts.SENT} confirmed SENT` : 'All registered records',
      tone: 'text-slate-900',
    },
    {
      label: 'Pending',
      value: statusCounts.PENDING,
      sublabel: 'Awaiting send dispatch',
      tone: 'text-amber-700',
    },
    {
      label: 'Dispatched',
      value: statusCounts.DISPATCHED,
      sublabel: 'Send action triggered',
      tone: 'text-sky-700',
    },
    {
      label: 'Failed',
      value: statusCounts.FAILED,
      sublabel: 'Send did not complete',
      tone: 'text-rose-700',
    },
    {
      label: 'Expired',
      value: statusCounts.EXPIRED,
      sublabel: 'Past retention window',
      tone: 'text-slate-600',
    },
    {
      label: 'Recorded Events (30d)',
      value: classificationCounts.totalEvents,
      sublabel: 'Pixel requests, not unique opens',
      tone: 'text-indigo-700',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {summaryCards.map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs"
          >
            <div className="text-xs font-medium text-slate-500">{card.label}</div>
            <div className={`mt-2 text-2xl font-bold tabular-nums ${card.tone}`}>{card.value}</div>
            <div className="mt-1 text-[11px] text-slate-500">{card.sublabel}</div>
          </div>
        ))}
      </div>

      {statusCounts.SENT > 0 ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-3 text-xs text-emerald-900">
          <strong>Trusted SENT confirmations:</strong> {statusCounts.SENT}{' '}
          {statusCounts.SENT === 1 ? 'record has' : 'records have'} verified server-side submission
          evidence.
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <DailyActivityChart data={dailyActivity} />
        <StatusDistributionChart counts={statusCounts} />
      </div>

      <section className="rounded-xl border border-slate-200 bg-white shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Recent Tracking Activity</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Latest recorded pixel requests. Classifications indicate request characteristics, not
              confirmed human reads.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onNavigateActivity}
              className="text-xs font-medium text-blue-600 hover:text-blue-700"
            >
              View all activity
            </button>
            <button
              type="button"
              onClick={onNavigateEmails}
              className="text-xs font-medium text-slate-600 hover:text-slate-900"
            >
              Browse emails
            </button>
          </div>
        </div>

        {recentEvents.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="No tracking activity yet"
              description="When recipients or mail proxies request a tracking pixel, recent events will appear here."
            />
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {recentEvents.map((event) => (
              <li
                key={event.id}
                className="flex flex-col gap-2 px-6 py-3.5 transition hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onSelectEmail(event.trackedEmail.id)}
                      className="truncate text-left text-sm font-medium text-slate-900 hover:text-blue-600"
                    >
                      {event.trackedEmail.subject || '(No subject)'}
                    </button>
                    <TrackingStatusBadge status={event.trackedEmail.status} />
                  </div>
                  <div className="mt-0.5 truncate text-xs text-slate-500">
                    Recipient: {event.trackedEmail.recipientReference}
                  </div>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-3">
                  <ClassificationBadge classification={event.classification} />
                  <span
                    title={formatDateTime(event.occurredAt)}
                    className="text-xs text-slate-500 tabular-nums"
                  >
                    {formatRelativeTime(event.occurredAt)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
