import { useCallback, useEffect, useState } from 'react';
import type { DashboardAnalyticsResponse } from '@mailtrack/shared';
import {
  ClassificationDistributionChart,
  DailyTrendByClassificationChart,
  SendTimeHeatmap,
} from '../components/Charts.js';
import { ErrorState } from '../components/ErrorState.js';
import { CardSkeleton, ChartSkeleton } from '../components/Skeleton.js';
import { SELECT_CLASS, SurfaceCard } from '../components/ui/Card.js';
import { ApiError, apiClient } from '../lib/api.js';

const RANGE_OPTIONS = [
  { days: 7, label: 'Last 7 days' },
  { days: 14, label: 'Last 14 days' },
  { days: 30, label: 'Last 30 days' },
  { days: 90, label: 'Last 90 days' },
];

export function AnalyticsPage() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<DashboardAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAnalytics = useCallback(
    (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);

      apiClient
        .getAnalytics({ days }, signal)
        .then((analyticsRes) => {
          setData(analyticsRes);
        })
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === 'AbortError') return;
          setError(err instanceof ApiError ? err.message : 'Unable to load analytics.');
        })
        .finally(() => setLoading(false));
    },
    [days],
  );

  useEffect(() => {
    const controller = new AbortController();
    loadAnalytics(controller.signal);
    return () => controller.abort();
  }, [loadAnalytics]);

  const sentCount = data
    ? (data.totalDispatchedEmails ?? data.statusCounts.DISPATCHED + data.statusCounts.SENT)
    : 0;
  const emailsWithActivity = data?.emailsWithPixelActivity ?? 0;
  const emailsWithRecorded = data?.emailsWithRecordedActivity ?? 0;
  const engagementRate = sentCount > 0 ? Math.round((emailsWithRecorded / sentCount) * 100) : 0;

  const classification = data
    ? (data.classificationBreakdown ?? data.classificationCounts)
    : undefined;
  const automatedCount = classification
    ? classification.LIKELY_PROXY + classification.SUSPECTED_SCANNER
    : 0;
  const automatedShare =
    classification && classification.totalEvents > 0
      ? Math.round((automatedCount / classification.totalEvents) * 100)
      : null;

  return (
    <div className="space-y-5">
      <SurfaceCard className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="text-[12px] text-[var(--text-secondary)]">
          Signal trends and automated traffic share for the selected date window.
        </div>

        <div className="flex items-center gap-2">
          <label
            htmlFor="analytics-range"
            className="text-[12px] font-medium text-[var(--text-secondary)]"
          >
            Range
          </label>
          <select
            id="analytics-range"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className={SELECT_CLASS}
          >
            {RANGE_OPTIONS.map((opt) => (
              <option key={opt.days} value={opt.days}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </SurfaceCard>

      {loading ? (
        <div className="space-y-5">
          <CardSkeleton count={4} />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <ChartSkeleton />
            <ChartSkeleton />
          </div>
        </div>
      ) : error || !data ? (
        <ErrorState
          title="Unable to load analytics"
          message={error ?? 'No analytics data returned.'}
          onRetry={() => loadAnalytics()}
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 shadow-[var(--shadow-sm)]">
              <div className="text-[12px] font-medium text-[var(--text-secondary)]">
                Emails sent
              </div>
              <div className="mt-1.5 text-[24px] font-semibold text-[var(--text-primary)] tabular-nums">
                {sentCount}
              </div>
              <div className="mt-1 text-[11px] text-[var(--text-muted)]">Last {days} days</div>
            </div>

            <div className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 shadow-[var(--shadow-sm)]">
              <div className="text-[12px] font-medium text-[var(--text-secondary)]">
                Emails with pixel activity
              </div>
              <div className="mt-1.5 text-[24px] font-semibold text-[var(--text-primary)] tabular-nums">
                {emailsWithActivity}
              </div>
              <div className="mt-1 text-[11px] text-[var(--text-muted)] tabular-nums">
                {emailsWithRecorded} with likely human signals
              </div>
            </div>

            <div className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 shadow-[var(--shadow-sm)]">
              <div className="text-[12px] font-medium text-[var(--text-secondary)]">
                Estimated engagement rate
              </div>
              <div className="mt-1.5 text-[24px] font-semibold text-[var(--text-primary)] tabular-nums">
                {`${engagementRate}%`}
              </div>
              <div className="mt-1 text-[11px] text-[var(--text-muted)]">
                Pixel requests can be generated by proxies, scanners, caching, or repeated loads; a
                recorded pixel event does not prove a person read the email.
              </div>
            </div>

            <div className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 shadow-[var(--shadow-sm)]">
              <div className="text-[12px] font-medium text-[var(--text-secondary)]">
                Automated traffic share
              </div>
              <div className="mt-1.5 text-[24px] font-semibold text-[var(--text-primary)] tabular-nums">
                {automatedShare !== null ? `${automatedShare}%` : '—'}
              </div>
              <div className="mt-1 text-[11px] text-[var(--text-muted)] tabular-nums">
                {automatedCount} proxy or scanner requests
              </div>
            </div>
          </div>

          <DailyTrendByClassificationChart
            data={data.dailyActivity}
            takeaway={
              data.classificationCounts.totalEvents > 0
                ? `${data.classificationCounts.RECORDED} likely human signals vs ${automatedCount} automated fetches over ${days} days (dates in UTC).`
                : undefined
            }
          />

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <ClassificationDistributionChart
              counts={data.classificationCounts}
              takeaway={
                automatedShare !== null
                  ? `${automatedShare}% of pixel requests matched proxy or scanner signatures.`
                  : undefined
              }
            />
            <SendTimeHeatmap
              events={data.recentEvents}
              heatmap={data.pixelActivityHeatmap}
              days={days}
            />
          </div>
        </>
      )}
    </div>
  );
}
