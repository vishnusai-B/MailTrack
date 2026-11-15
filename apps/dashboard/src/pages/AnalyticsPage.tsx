import { useCallback, useEffect, useState } from 'react';
import type { DashboardAnalyticsResponse } from '@mailtrack/shared';
import {
  ClassificationDistributionChart,
  DailyActivityChart,
  DailyTrendByClassificationChart,
  StatusDistributionChart,
} from '../components/Charts.js';
import { ErrorState } from '../components/ErrorState.js';
import { ChartSkeleton } from '../components/Skeleton.js';
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
        .then((res) => setData(res))
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-5 py-3.5 shadow-xs">
        <div className="text-xs text-slate-600">
          Metrics reflect recorded pixel HTTP requests and lifecycle statuses — never inferred human
          open rates.
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="analytics-range" className="text-xs font-medium text-slate-700">
            Date range
          </label>
          <select
            id="analytics-range"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
          >
            {RANGE_OPTIONS.map((opt) => (
              <option key={opt.days} value={opt.days}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <ChartSkeleton />
          <ChartSkeleton />
          <ChartSkeleton />
          <ChartSkeleton />
        </div>
      ) : error || !data ? (
        <ErrorState
          title="Unable to load analytics"
          message={error ?? 'No analytics data returned.'}
          onRetry={() => loadAnalytics()}
        />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <DailyActivityChart
            data={data.dailyActivity}
            title={`Recorded Pixel Requests Over Time (${days}d)`}
          />
          <StatusDistributionChart counts={data.statusCounts} />
          <ClassificationDistributionChart counts={data.classificationCounts} />
          <DailyTrendByClassificationChart data={data.dailyActivity} />
        </div>
      )}
    </div>
  );
}
