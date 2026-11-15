import { Fragment, useCallback, useEffect, useState } from 'react';
import type { EventClassification, PaginatedTrackingEventsResponse } from '@mailtrack/shared';
import { EmptyState } from '../components/EmptyState.js';
import { ErrorState } from '../components/ErrorState.js';
import {
  IconChevronDown,
  IconChevronRight,
  IconDownload,
  IconInfo,
  IconX,
} from '../components/Icons.js';
import { TableSkeleton } from '../components/Skeleton.js';
import { ClassificationBadge, TrackingStatusBadge } from '../components/StatusBadge.js';
import { Button } from '../components/ui/Button.js';
import { INPUT_CLASS, SELECT_CLASS, SurfaceCard } from '../components/ui/Card.js';
import { PaginationBar } from '../components/ui/Pagination.js';
import { ApiError, apiClient } from '../lib/api.js';
import { formatDateTime, formatRelativeTime } from '../lib/format.js';

interface ActivityPageProps {
  onSelectEmail: (emailId: string) => void;
  onNotify?: (tone: 'success' | 'error' | 'info', text: string) => void;
}

const CLASSIFICATION_OPTIONS: Array<{ value: EventClassification | ''; label: string }> = [
  { value: '', label: 'All signal types' },
  { value: 'RECORDED', label: 'Opened (likely human)' },
  { value: 'LIKELY_PROXY', label: 'Email client prefetch' },
  { value: 'SUSPECTED_SCANNER', label: 'Security scanner' },
];

const DISCLAIMER_STORAGE_KEY = 'mailtrack.activity.disclaimerDismissed';

export function ActivityPage({ onSelectEmail, onNotify }: ActivityPageProps) {
  const [classification, setClassification] = useState<EventClassification | ''>('');
  const [hideAutomated, setHideAutomated] = useState(true);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [exporting, setExporting] = useState(false);
  const [page, setPage] = useState(1);
  const limit = 20;

  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [disclaimerDismissed, setDisclaimerDismissed] = useState(() => {
    try {
      return window.localStorage.getItem(DISCLAIMER_STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  });

  const [data, setData] = useState<PaginatedTrackingEventsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const effectiveClassification: EventClassification | undefined =
    classification || (hideAutomated ? 'RECORDED' : undefined);

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
            classification: effectiveClassification,
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
    [page, limit, effectiveClassification, fromDate, toDate],
  );

  useEffect(() => {
    const controller = new AbortController();
    loadEvents(controller.signal);
    return () => controller.abort();
  }, [loadEvents]);

  function dismissDisclaimer() {
    setDisclaimerDismissed(true);
    try {
      window.localStorage.setItem(DISCLAIMER_STORAGE_KEY, '1');
    } catch {
      // Ignore storage errors
    }
  }

  async function handleExportCsv() {
    setExporting(true);
    try {
      const fromIso = fromDate ? `${fromDate}T00:00:00.000Z` : undefined;
      const toIso = toDate ? `${toDate}T23:59:59.999Z` : undefined;
      await apiClient.downloadCsv(
        '/api/exports/events',
        {
          classification: effectiveClassification,
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

  const hasFilters = Boolean(classification || fromDate || toDate || !hideAutomated);

  return (
    <div className="space-y-4">
      {!disclaimerDismissed ? (
        <div
          role="note"
          className="flex items-start justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-subtle)] px-3.5 py-2.5 text-[12px] text-[var(--text-secondary)]"
        >
          <div className="flex items-start gap-2">
            <IconInfo className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" />
            <span>
              Each row logs an individual pixel request. Repeated requests are listed separately and
              are not counted as unique human opens.
            </span>
          </div>
          <button
            type="button"
            onClick={dismissDisclaimer}
            aria-label="Dismiss note"
            className="shrink-0 rounded p-0.5 text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
          >
            <IconX className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}

      <SurfaceCard className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <select
              id="activity-classification"
              aria-label="Signal classification"
              value={classification}
              onChange={(e) => {
                const next = e.target.value as EventClassification | '';
                setClassification(next);
                if (next && next !== 'RECORDED') {
                  setHideAutomated(false);
                }
                setPage(1);
              }}
              className={SELECT_CLASS}
            >
              {CLASSIFICATION_OPTIONS.map((opt) => (
                <option key={opt.value || 'all'} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            <input
              type="date"
              aria-label="From date"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                setPage(1);
              }}
              className={`${INPUT_CLASS} w-auto`}
            />

            <input
              type="date"
              aria-label="To date"
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value);
                setPage(1);
              }}
              className={`${INPUT_CLASS} w-auto`}
            />

            <label className="inline-flex cursor-pointer items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-subtle)] px-2.5 py-1.5 text-[12px] font-medium text-[var(--text-primary)]">
              <input
                type="checkbox"
                checked={hideAutomated}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setHideAutomated(checked);
                  if (checked && classification && classification !== 'RECORDED') {
                    setClassification('');
                  }
                  setPage(1);
                }}
                className="h-3.5 w-3.5 rounded border-[var(--border-strong)] accent-[var(--accent)]"
              />
              Hide automated
            </label>
          </div>

          <div className="flex items-center gap-2">
            {hasFilters ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setClassification('');
                  setHideAutomated(true);
                  setFromDate('');
                  setToDate('');
                  setPage(1);
                }}
              >
                Reset
              </Button>
            ) : null}
            <Button variant="secondary" loading={exporting} onClick={handleExportCsv}>
              <IconDownload className="h-3.5 w-3.5" />
              Export CSV
            </Button>
          </div>
        </div>
      </SurfaceCard>

      {loading ? (
        <TableSkeleton rows={6} />
      ) : error ? (
        <ErrorState title="Unable to load activity" message={error} onRetry={() => loadEvents()} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          title="No matching activity"
          description={
            hideAutomated
              ? 'No likely-human pixel requests found for these filters. Turn off "Hide automated" to inspect proxy and scanner fetches.'
              : 'No pixel requests match your current filter selection.'
          }
          action={
            hideAutomated ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setHideAutomated(false);
                  setPage(1);
                }}
              >
                Show automated traffic
              </Button>
            ) : undefined
          }
        />
      ) : (
        <SurfaceCard className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] border-collapse text-left text-[13px]">
              <thead className="border-b border-[var(--border-default)] bg-[var(--bg-subtle)] text-[12px] font-medium text-[var(--text-secondary)]">
                <tr>
                  <th className="w-9 px-3 py-2.5">
                    <span className="sr-only">Expand</span>
                  </th>
                  <th className="px-3 py-2.5">Email</th>
                  <th className="px-3 py-2.5">Signal</th>
                  <th className="px-3 py-2.5">Email status</th>
                  <th className="px-3 py-2.5 text-right">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-default)]">
                {data.items.map((ev) => {
                  const isExpanded = expandedRowId === ev.id;
                  return (
                    <Fragment key={ev.id}>
                      <tr className="transition-colors duration-150 hover:bg-[var(--bg-subtle)]">
                        <td className="px-3 py-2.5">
                          <button
                            type="button"
                            aria-expanded={isExpanded}
                            aria-label={
                              isExpanded ? 'Collapse technical details' : 'Expand technical details'
                            }
                            onClick={() =>
                              setExpandedRowId((cur) => (cur === ev.id ? null : ev.id))
                            }
                            className="rounded p-1 text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
                          >
                            {isExpanded ? (
                              <IconChevronDown className="h-3.5 w-3.5" />
                            ) : (
                              <IconChevronRight className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </td>
                        <td className="max-w-[280px] px-3 py-2.5">
                          <button
                            type="button"
                            onClick={() => onSelectEmail(ev.trackedEmailId)}
                            className="block max-w-full truncate text-left font-medium text-[var(--text-primary)] hover:text-[var(--accent-text)] hover:underline"
                          >
                            {ev.trackedEmail.subject || 'No subject'}
                          </button>
                          <div className="truncate text-[12px] text-[var(--text-secondary)]">
                            {ev.trackedEmail.recipientReference}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <ClassificationBadge classification={ev.classification} />
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <TrackingStatusBadge status={ev.trackedEmail.status} />
                        </td>
                        <td
                          title={formatDateTime(ev.occurredAt)}
                          className="px-3 py-2.5 text-right text-[12px] whitespace-nowrap text-[var(--text-muted)] tabular-nums"
                        >
                          {formatRelativeTime(ev.occurredAt)}
                        </td>
                      </tr>

                      {isExpanded ? (
                        <tr className="bg-[var(--bg-subtle)]/70">
                          <td colSpan={5} className="px-4 py-3">
                            <dl className="grid grid-cols-1 gap-3 text-[12px] sm:grid-cols-4">
                              <div>
                                <dt className="text-[var(--text-muted)]">Request ID</dt>
                                <dd className="mt-0.5 font-mono text-[var(--text-primary)]">
                                  {ev.id}
                                </dd>
                              </div>
                              <div>
                                <dt className="text-[var(--text-muted)]">Tracking ID</dt>
                                <dd className="mt-0.5 font-mono text-[var(--text-primary)]">
                                  {ev.trackedEmailId}
                                </dd>
                              </div>
                              <div>
                                <dt className="text-[var(--text-muted)]">Raw signal</dt>
                                <dd className="mt-0.5 font-mono text-[var(--text-primary)]">
                                  {ev.eventType} · {ev.classification}
                                </dd>
                              </div>
                              <div>
                                <dt className="text-[var(--text-muted)]">Exact timestamp</dt>
                                <dd className="mt-0.5 font-mono text-[var(--text-primary)] tabular-nums">
                                  {formatDateTime(ev.occurredAt)}
                                </dd>
                              </div>
                            </dl>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          <PaginationBar
            page={data.page}
            totalPages={data.totalPages}
            totalItems={data.total}
            itemLabel="events"
            onPageChange={setPage}
          />
        </SurfaceCard>
      )}
    </div>
  );
}
