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
        statusCounts.SENT > 0 ? `${statusCounts.SENT} confirmed sent` : 'Tracked in workspace',
      tone: 'text-slate-900',
      dot: 'bg-slate-900',
    },
    {
      label: 'Pending',
      value: statusCounts.PENDING,
      sublabel: 'Waiting to send',
      tone: 'text-amber-700',
      dot: 'bg-amber-500',
    },
    {
      label: 'Dispatched',
      value: statusCounts.DISPATCHED,
      sublabel: 'Sent from compose',
      tone: 'text-sky-700',
      dot: 'bg-sky-500',
    },
    {
      label: 'Failed',
      value: statusCounts.FAILED,
      sublabel: 'Delivery failed',
      tone: 'text-rose-700',
      dot: 'bg-rose-500',
    },
    {
      label: 'Expired',
      value: statusCounts.EXPIRED,
      sublabel: 'Window closed',
      tone: 'text-slate-600',
      dot: 'bg-slate-400',
    },
    {
      label: 'Recorded Events (30d)',
      value: classificationCounts.totalEvents,
      sublabel: 'Pixel requests, not unique opens',
      tone: 'text-indigo-700',
      dot: 'bg-indigo-500',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 xl:grid-cols-6">
        {summaryCards.map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs transition duration-150 hover:border-slate-300/90 hover:shadow-sm"
          >
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${card.dot}`} />
              <span className="truncate">{card.label}</span>
            </div>
            <div
              className={`mt-2.5 text-2xl font-semibold tracking-tight tabular-nums ${card.tone}`}
            >
              {card.value}
            </div>
            <div className="mt-1 text-[11px] text-slate-400">{card.sublabel}</div>
          </div>
        ))}
      </div>

      {statusCounts.SENT > 0 ? (
        <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/60 px-4 py-2.5 text-xs text-emerald-900">
          <strong className="font-semibold">Verified sent:</strong> {statusCounts.SENT}{' '}
          {statusCounts.SENT === 1 ? 'email has' : 'emails have'} server-side confirmation.
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <DailyActivityChart data={dailyActivity} />
        <StatusDistributionChart counts={statusCounts} />
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Recent Tracking Activity</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Latest pixel activity across your tracked emails.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onNavigateActivity}
              className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-blue-600 transition hover:bg-blue-50 hover:text-blue-700"
            >
              View all activity
            </button>
            <button
              type="button"
              onClick={onNavigateEmails}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 hover:text-slate-900"
            >
              Browse emails
            </button>
          </div>
        </div>

        {recentEvents.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="No tracking activity yet"
              description="Pixel activity will show up here as soon as your tracked emails are opened."
            />
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {recentEvents.map((event) => (
              <li
                key={event.id}
                className="flex flex-col gap-2 px-6 py-3.5 transition duration-150 hover:bg-slate-50/80 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onSelectEmail(event.trackedEmail.id)}
                      className="truncate text-left text-sm font-medium text-slate-900 transition hover:text-blue-600"
                    >
                      {event.trackedEmail.subject || '(No subject)'}
                    </button>
                    <TrackingStatusBadge status={event.trackedEmail.status} />
                  </div>
                  <div className="mt-0.5 truncate text-xs text-slate-500">
                    To: {event.trackedEmail.recipientReference}
                  </div>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-2.5">
                  <ClassificationBadge classification={event.classification} />
                  <span
                    title={formatDateTime(event.occurredAt)}
                    className="min-w-[4.5rem] text-right text-xs text-slate-400 tabular-nums"
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
