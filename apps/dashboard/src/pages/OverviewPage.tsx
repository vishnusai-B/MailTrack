import { useCallback, useEffect, useState } from 'react';
import type { DashboardAnalyticsResponse } from '@mailtrack/shared';
import { DailyActivityChart, StatusDistributionChart } from '../components/Charts.js';
import { EmptyState } from '../components/EmptyState.js';
import { ErrorState } from '../components/ErrorState.js';
import { IconActivity, IconArrowUpRight, IconMail, IconSend } from '../components/Icons.js';
import { CardSkeleton, ChartSkeleton } from '../components/Skeleton.js';
import { ClassificationBadge, TrackingStatusBadge } from '../components/StatusBadge.js';
import { Button } from '../components/ui/Button.js';
import { SectionHeader, SurfaceCard } from '../components/ui/Card.js';
import { ApiError, apiClient } from '../lib/api.js';
import { formatDateTime, formatRelativeTime } from '../lib/format.js';

interface OverviewPageProps {
  onSelectEmail: (emailId: string) => void;
  onNavigateEmails: () => void;
  onNavigateActivity: () => void;
}

const OVERVIEW_RANGES = [7, 14, 30] as const;

export function OverviewPage({
  onSelectEmail,
  onNavigateEmails,
  onNavigateActivity,
}: OverviewPageProps) {
  const [days, setDays] = useState<number>(30);
  const [data, setData] = useState<DashboardAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadOverview = useCallback(
    (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      apiClient
        .getAnalytics({ days }, signal)
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
    },
    [days],
  );

  useEffect(() => {
    const controller = new AbortController();
    loadOverview(controller.signal);
    return () => controller.abort();
  }, [loadOverview]);

  if (loading) {
    return (
      <div className="space-y-6">
        <CardSkeleton count={3} />
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
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

  const primaryMetrics = [
    {
      label: 'Total Tracked Emails',
      value: statusCounts.totalEmails,
      sublabel:
        statusCounts.SENT > 0 ? `${statusCounts.SENT} confirmed SENT` : 'Registered in workspace',
      icon: IconMail,
      iconBg: 'bg-neutral-100 text-neutral-700',
    },
    {
      label: 'Dispatched',
      value: statusCounts.DISPATCHED,
      sublabel: 'Sent from Gmail compose',
      icon: IconSend,
      iconBg: 'bg-sky-50 text-sky-600',
    },
    {
      label: `Recorded Events (${days}d)`,
      value: classificationCounts.totalEvents,
      sublabel: 'Pixel requests, not unique opens',
      icon: IconActivity,
      iconBg: 'bg-indigo-50 text-indigo-600',
    },
  ];

  const secondaryStatuses = [
    {
      label: 'Pending',
      value: statusCounts.PENDING,
      hint: 'Waiting to send',
      dot: 'bg-amber-500',
      valueTone: 'text-amber-700',
    },
    {
      label: 'Failed',
      value: statusCounts.FAILED,
      hint: 'Send did not complete',
      dot: 'bg-rose-500',
      valueTone: 'text-rose-700',
    },
    {
      label: 'Expired',
      value: statusCounts.EXPIRED,
      hint: 'Retention window ended',
      dot: 'bg-neutral-400',
      valueTone: 'text-neutral-700',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Context Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-neutral-500">
          Review your tracking activity across the last {days} days.
        </p>

        <div className="flex items-center gap-2">
          <div
            role="group"
            aria-label="Overview date range"
            className="inline-flex rounded-lg border border-neutral-200/90 bg-white p-0.5 shadow-2xs"
          >
            {OVERVIEW_RANGES.map((range) => {
              const active = days === range;
              return (
                <button
                  key={range}
                  type="button"
                  onClick={() => setDays(range)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                    active ? 'bg-neutral-900 text-white' : 'text-neutral-600 hover:text-neutral-950'
                  }`}
                >
                  {range}d
                </button>
              );
            })}
          </div>
          <Button variant="secondary" onClick={onNavigateEmails}>
            Tracked Emails
            <IconArrowUpRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Primary KPI Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {primaryMetrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <div
              key={metric.label}
              className="rounded-xl border border-neutral-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition duration-150 hover:border-neutral-300/90"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-neutral-500">{metric.label}</span>
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-lg ${metric.iconBg}`}
                >
                  <Icon className="h-3.5 w-3.5" />
                </span>
              </div>
              <div className="mt-3 text-3xl font-semibold tracking-tight text-neutral-950 tabular-nums">
                {metric.value}
              </div>
              <div className="mt-1 text-xs text-neutral-500">{metric.sublabel}</div>
            </div>
          );
        })}
      </div>

      {/* Secondary Lifecycle Strip */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {secondaryStatuses.map((item) => (
          <div
            key={item.label}
            className="flex items-center justify-between rounded-xl border border-neutral-200/80 bg-white px-4 py-3 shadow-[0_1px_2px_rgba(16,24,40,0.03)]"
          >
            <div>
              <div className="flex items-center gap-2 text-xs font-medium text-neutral-700">
                <span className={`h-2 w-2 rounded-full ${item.dot}`} />
                {item.label}
              </div>
              <div className="mt-0.5 text-[11px] text-neutral-400">{item.hint}</div>
            </div>
            <div className={`text-lg font-semibold tabular-nums ${item.valueTone}`}>
              {item.value}
            </div>
          </div>
        ))}
      </div>

      {statusCounts.SENT > 0 ? (
        <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/70 px-4 py-2.5 text-xs text-emerald-900">
          <strong className="font-semibold">Trusted SENT confirmations:</strong> {statusCounts.SENT}{' '}
          {statusCounts.SENT === 1 ? 'record has' : 'records have'} server-side confirmation.
        </div>
      ) : null}

      {/* Charts */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <DailyActivityChart
          data={dailyActivity}
          title={`Daily Recorded Pixel Requests (${days}d)`}
        />
        <StatusDistributionChart counts={statusCounts} />
      </div>

      {/* Recent Tracking Activity */}
      <SurfaceCard className="overflow-hidden">
        <SectionHeader
          title="Recent Tracking Activity"
          description="Latest pixel requests recorded across your emails."
          actions={
            <>
              <Button variant="ghost" onClick={onNavigateActivity}>
                View all activity
              </Button>
              <Button variant="secondary" onClick={onNavigateEmails}>
                Browse emails
              </Button>
            </>
          }
        />

        {recentEvents.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="No tracking activity yet"
              description="Send an email with tracking enabled in Gmail to start logging pixel activity."
              action={
                <Button variant="secondary" onClick={onNavigateEmails}>
                  Go to Tracked Emails
                </Button>
              }
            />
          </div>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {recentEvents.map((event) => (
              <li
                key={event.id}
                className="flex flex-col gap-2 px-5 py-3.5 transition duration-150 hover:bg-neutral-50/80 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <span
                    className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-500"
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onSelectEmail(event.trackedEmail.id)}
                        className="truncate text-left text-sm font-medium text-neutral-900 transition hover:text-blue-600"
                      >
                        {event.trackedEmail.subject || '(No subject)'}
                      </button>
                      <TrackingStatusBadge status={event.trackedEmail.status} />
                    </div>
                    <div className="mt-0.5 truncate text-xs text-neutral-500">
                      To {event.trackedEmail.recipientReference}
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-2.5 pl-5 sm:pl-0">
                  <ClassificationBadge classification={event.classification} />
                  <span
                    title={formatDateTime(event.occurredAt)}
                    className="min-w-[4.5rem] text-right font-mono text-[11px] text-neutral-400 tabular-nums"
                  >
                    {formatRelativeTime(event.occurredAt)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SurfaceCard>
    </div>
  );
}
