import { useCallback, useEffect, useState } from 'react';
import type { EventClassification, PaginatedTrackingEventsResponse } from '@mailtrack/shared';
import { EmptyState } from '../components/EmptyState.js';
import { ErrorState } from '../components/ErrorState.js';
import { IconDownload } from '../components/Icons.js';
import { TableSkeleton } from '../components/Skeleton.js';
import { ClassificationBadge, TrackingStatusBadge } from '../components/StatusBadge.js';
import { Button } from '../components/ui/Button.js';
import { INPUT_CLASS, SELECT_CLASS, SurfaceCard } from '../components/ui/Card.js';
import { PaginationBar } from '../components/ui/Pagination.js';
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

  const hasFilters = Boolean(classification || fromDate || toDate);

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
        className="rounded-xl border border-neutral-200/80 bg-white px-4 py-2.5 text-xs text-neutral-600 shadow-2xs"
      >
        Each row logs an individual pixel request. Repeated requests are listed separately and are{' '}
        <strong className="font-semibold text-neutral-900">not</strong> counted as unique human
        opens.
      </div>

      <SurfaceCard className="p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label
              htmlFor="activity-classification"
              className="block text-xs font-medium text-neutral-600"
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
              className={`${SELECT_CLASS} mt-1`}
            >
              {CLASSIFICATION_OPTIONS.map((opt) => (
                <option key={opt.label} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="activity-from" className="block text-xs font-medium text-neutral-600">
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
              className={`${INPUT_CLASS} mt-1 text-xs`}
            />
          </div>

          <div>
            <label htmlFor="activity-to" className="block text-xs font-medium text-neutral-600">
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
              className={`${INPUT_CLASS} mt-1 text-xs`}
            />
          </div>
        </div>

        <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 border-t border-neutral-100 pt-3">
          <div>
            {hasFilters ? (
              <Button variant="ghost" onClick={clearFilters}>
                Clear filters
              </Button>
            ) : null}
          </div>
          <Button variant="secondary" onClick={() => void handleExportCsv()} disabled={exporting}>
            <IconDownload className="h-3.5 w-3.5" />
            {exporting ? 'Exporting...' : 'Export CSV'}
          </Button>
        </div>
      </SurfaceCard>

      {loading ? (
        <TableSkeleton rows={6} cols={5} />
      ) : error ? (
        <ErrorState title="Unable to load activity" message={error} onRetry={() => loadEvents()} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          title="No tracking events found"
          description={
            hasFilters
              ? 'No events match your current classification or date filters.'
              : 'Pixel requests will appear here as tracked emails receive traffic.'
          }
          action={
            hasFilters ? (
              <Button variant="primary" onClick={clearFilters}>
                Clear filters
              </Button>
            ) : undefined
          }
        />
      ) : (
        <SurfaceCard className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-neutral-200/80 text-left text-sm">
              <thead className="bg-neutral-50/80 text-[11px] font-semibold tracking-wide text-neutral-500 uppercase">
                <tr>
                  <th scope="col" className="px-5 py-3">
                    Timestamp
                  </th>
                  <th scope="col" className="px-5 py-3">
                    Associated Email
                  </th>
                  <th scope="col" className="px-5 py-3">
                    Email Status
                  </th>
                  <th scope="col" className="px-5 py-3">
                    Classification
                  </th>
                  <th scope="col" className="px-5 py-3">
                    Metadata
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 bg-white">
                {data.items.map((ev) => (
                  <tr key={ev.id} className="transition-colors hover:bg-neutral-50/80">
                    <td className="px-5 py-3.5 text-xs whitespace-nowrap text-neutral-600 tabular-nums">
                      {formatDateTime(ev.occurredAt)}
                    </td>
                    <td className="max-w-[260px] px-5 py-3.5">
                      <button
                        type="button"
                        onClick={() => onSelectEmail(ev.trackedEmail.id)}
                        className="block truncate text-left text-xs font-medium text-neutral-900 transition hover:text-blue-600"
                      >
                        {ev.trackedEmail.subject || '(No subject)'}
                      </button>
                      <div className="truncate text-[11px] text-neutral-500">
                        {ev.trackedEmail.recipientReference}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <TrackingStatusBadge status={ev.trackedEmail.status} />
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <ClassificationBadge classification={ev.classification} />
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs whitespace-nowrap text-neutral-500">
                      {ev.eventType}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <PaginationBar
            page={data.page}
            totalPages={data.totalPages}
            total={data.total}
            unitLabel="total events"
            onPageChange={setPage}
          />
        </SurfaceCard>
      )}
    </div>
  );
}
