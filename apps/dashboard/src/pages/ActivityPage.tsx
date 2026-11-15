import { useCallback, useEffect, useState } from 'react';
import type { EventClassification, PaginatedTrackingEventsResponse } from '@mailtrack/shared';
import { EmptyState } from '../components/EmptyState.js';
import { ErrorState } from '../components/ErrorState.js';
import { IconChevronLeft, IconChevronRight, IconDownload } from '../components/Icons.js';
import { TableSkeleton } from '../components/Skeleton.js';
import { ClassificationBadge, TrackingStatusBadge } from '../components/StatusBadge.js';
import { ApiError, apiClient } from '../lib/api.js';
import { formatDateTime } from '../lib/format.js';

interface ActivityPageProps {
  onSelectEmail: (emailId: string) => void;
  onNotify?: (tone: 'success' | 'error' | 'info', text: string) => void;
}

const CLASSIFICATION_OPTIONS: Array<{ value: EventClassification | ''; label: string }> = [
  { value: '', label: 'All classifications' },
  { value: 'RECORDED', label: 'RECORDED' },
  { value: 'LIKELY_PROXY', label: 'LIKELY_PROXY' },
  { value: 'SUSPECTED_SCANNER', label: 'SUSPECTED_SCANNER' },
];

export function ActivityPage({ onSelectEmail, onNotify }: ActivityPageProps) {
  const [classification, setClassification] = useState<EventClassification | ''>('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [exporting, setExporting] = useState(false);
  const [page, setPage] = useState(1);
  const limit = 20;

  const [data, setData] = useState<PaginatedTrackingEventsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadEvents = useCallback(
    (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);

      const fromIso = fromDate ? `${fromDate}T00:00:00.000Z` : undefined;
      const toIso = toDate ? `${toDate}T23:59:59.999Z` : undefined;

      apiClient
        .listTrackingEvents(
          {
            page,
            limit,
            classification: classification || undefined,
            from: fromIso,
            to: toIso,
          },
          signal,
        )
        .then((res) => setData(res))
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === 'AbortError') return;
          setError(err instanceof ApiError ? err.message : 'Unable to fetch tracking activity.');
        })
        .finally(() => setLoading(false));
    },
    [page, limit, classification, fromDate, toDate],
  );

  useEffect(() => {
    const controller = new AbortController();
    loadEvents(controller.signal);
    return () => controller.abort();
  }, [loadEvents]);

  function clearFilters() {
    setClassification('');
    setFromDate('');
    setToDate('');
    setPage(1);
  }

  async function handleExportCsv() {
    setExporting(true);
    try {
      const fromIso = fromDate ? `${fromDate}T00:00:00.000Z` : undefined;
      const toIso = toDate ? `${toDate}T23:59:59.999Z` : undefined;
      await apiClient.downloadCsv(
        '/api/exports/events',
        {
          classification: classification || undefined,
          from: fromIso,
          to: toIso,
        },
        'tracking-events.csv',
      );
      onNotify?.('success', 'Exported tracking events CSV.');
    } catch (err: unknown) {
      onNotify?.('error', err instanceof ApiError ? err.message : 'Unable to export CSV.');
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-5">
      <div
        role="note"
        className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600 shadow-xs"
      >
        Each row represents an individual pixel HTTP request. Duplicate pixel requests are listed as
        separate events and are <strong>not</strong> counted as unique human opens.
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label
              htmlFor="activity-classification"
              className="block text-xs font-medium text-slate-600"
            >
              Classification
            </label>
            <select
              id="activity-classification"
              value={classification}
              onChange={(e) => {
                setClassification(e.target.value as EventClassification | '');
                setPage(1);
              }}
              className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
            >
              {CLASSIFICATION_OPTIONS.map((opt) => (
                <option key={opt.label} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="activity-from" className="block text-xs font-medium text-slate-600">
              From date
            </label>
            <input
              id="activity-from"
              type="date"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                setPage(1);
              }}
              className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="activity-to" className="block text-xs font-medium text-slate-600">
              To date
            </label>
            <input
              id="activity-to"
              type="date"
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value);
                setPage(1);
              }}
              className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
            />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-3">
          <button
            type="button"
            onClick={() => void handleExportCsv()}
            disabled={exporting}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-xs transition hover:bg-slate-50 disabled:opacity-50"
          >
            <IconDownload className="h-3.5 w-3.5" />
            {exporting ? 'Exporting...' : 'Export CSV'}
          </button>
        </div>
      </section>

      {loading ? (
        <TableSkeleton rows={6} cols={5} />
      ) : error ? (
        <ErrorState title="Unable to load activity" message={error} onRetry={() => loadEvents()} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          title="No tracking events found"
          description={
            classification || fromDate || toDate
              ? 'No events match your current classification or date filters.'
              : 'Recorded pixel requests will appear here as emails are tracked.'
          }
          action={
            classification || fromDate || toDate ? (
              <button
                type="button"
                onClick={clearFilters}
                className="rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700"
              >
                Clear filters
              </button>
            ) : undefined
          }
        />
      ) : (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold tracking-wide text-slate-600 uppercase">
                <tr>
                  <th scope="col" className="px-5 py-3.5">
                    Timestamp
                  </th>
                  <th scope="col" className="px-5 py-3.5">
                    Associated Email
                  </th>
                  <th scope="col" className="px-5 py-3.5">
                    Email Status
                  </th>
                  <th scope="col" className="px-5 py-3.5">
                    Classification
                  </th>
                  <th scope="col" className="px-5 py-3.5">
                    Metadata
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {data.items.map((ev) => (
                  <tr key={ev.id} className="transition hover:bg-slate-50/80">
                    <td className="px-5 py-3.5 text-xs whitespace-nowrap text-slate-600">
                      {formatDateTime(ev.occurredAt)}
                    </td>
                    <td className="max-w-[260px] px-5 py-3.5">
                      <button
                        type="button"
                        onClick={() => onSelectEmail(ev.trackedEmail.id)}
                        className="block truncate text-left font-medium text-slate-900 hover:text-blue-600"
                      >
                        {ev.trackedEmail.subject || '(No subject)'}
                      </button>
                      <div className="truncate text-xs text-slate-500">
                        {ev.trackedEmail.recipientReference}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <TrackingStatusBadge status={ev.trackedEmail.status} />
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <ClassificationBadge classification={ev.classification} />
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs whitespace-nowrap text-slate-500">
                      {ev.eventType}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/60 px-5 py-3 text-xs text-slate-600">
            <div>
              Showing page <span className="font-semibold text-slate-900">{data.page}</span> of{' '}
              <span className="font-semibold text-slate-900">{data.totalPages}</span> ({data.total}{' '}
              total events)
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={data.page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <IconChevronLeft className="h-3.5 w-3.5" />
                Previous
              </button>
              <button
                type="button"
                disabled={data.page >= data.totalPages}
                onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
                <IconChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
