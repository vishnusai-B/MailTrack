import { useCallback, useEffect, useState } from 'react';
import type { PaginatedTrackedEmailsResponse, TrackingStatus } from '@mailtrack/shared';
import { EmptyState } from '../components/EmptyState.js';
import { ErrorState } from '../components/ErrorState.js';
import { IconArrowUpRight, IconDownload, IconSearch } from '../components/Icons.js';
import { TableSkeleton } from '../components/Skeleton.js';
import { OpenStatusBadge, TrackingStatusBadge } from '../components/StatusBadge.js';
import { Button } from '../components/ui/Button.js';
import { INPUT_CLASS, SELECT_CLASS, SurfaceCard } from '../components/ui/Card.js';
import { PaginationBar } from '../components/ui/Pagination.js';
import { ApiError, apiClient } from '../lib/api.js';
import { formatDateTime } from '../lib/format.js';

interface TrackedEmailsPageProps {
  onSelectEmail: (emailId: string) => void;
  onNotify?: (tone: 'success' | 'error' | 'info', text: string) => void;
}

const STATUS_OPTIONS: Array<{ value: TrackingStatus | ''; label: string }> = [
  { value: '', label: 'All statuses' },
  { value: 'PENDING', label: 'PENDING' },
  { value: 'DISPATCHED', label: 'DISPATCHED' },
  { value: 'SENT', label: 'SENT' },
  { value: 'FAILED', label: 'FAILED' },
  { value: 'EXPIRED', label: 'EXPIRED' },
];

export function TrackedEmailsPage({ onSelectEmail, onNotify }: TrackedEmailsPageProps) {
  const [searchInput, setSearchInput] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [status, setStatus] = useState<TrackingStatus | ''>('');
  const [openFilter, setOpenFilter] = useState<'all' | 'opened' | 'unopened'>('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [exporting, setExporting] = useState(false);
  const [page, setPage] = useState(1);
  const limit = 15;

  const [data, setData] = useState<PaginatedTrackedEmailsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setAppliedSearch(searchInput.trim());
      setPage(1);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const loadEmails = useCallback(
    (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);

      const fromIso = fromDate ? `${fromDate}T00:00:00.000Z` : undefined;
      const toIso = toDate ? `${toDate}T23:59:59.999Z` : undefined;

      apiClient
        .listTrackedEmails(
          {
            page,
            limit,
            search: appliedSearch || undefined,
            status: status || undefined,
            from: fromIso,
            to: toIso,
          },
          signal,
        )
        .then((res) => setData(res))
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === 'AbortError') return;
          setError(err instanceof ApiError ? err.message : 'Unable to fetch tracked emails.');
        })
        .finally(() => setLoading(false));
    },
    [page, limit, appliedSearch, status, fromDate, toDate],
  );

  useEffect(() => {
    const controller = new AbortController();
    loadEmails(controller.signal);
    return () => controller.abort();
  }, [loadEmails]);

  const hasActiveFilters = Boolean(
    appliedSearch || status || fromDate || toDate || openFilter !== 'all',
  );

  function clearFilters() {
    setSearchInput('');
    setAppliedSearch('');
    setStatus('');
    setOpenFilter('all');
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
        '/api/exports/emails',
        {
          search: appliedSearch || undefined,
          status: status || undefined,
          from: fromIso,
          to: toIso,
        },
        'tracked-emails.csv',
      );
      onNotify?.('success', 'Exported tracked emails CSV.');
    } catch (err: unknown) {
      onNotify?.('error', err instanceof ApiError ? err.message : 'Unable to export CSV.');
    } finally {
      setExporting(false);
    }
  }

  const filteredItems =
    data?.items.filter((email) => {
      const isOpened = Boolean(email.firstRecordedAt) || (email.eventCount ?? 0) > 0;
      if (openFilter === 'opened') return isOpened;
      if (openFilter === 'unopened') return !isOpened;
      return true;
    }) ?? [];

  return (
    <div className="space-y-5">
      {/* Filter Toolbar */}
      <SurfaceCard className="p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <label htmlFor="emails-search" className="block text-xs font-medium text-neutral-600">
              Search recipient or subject
            </label>
            <div className="relative mt-1">
              <IconSearch className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-neutral-400" />
              <input
                id="emails-search"
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search recipient or subject..."
                className={`${INPUT_CLASS} pl-9`}
              />
            </div>
          </div>

          <div>
            <label htmlFor="emails-status" className="block text-xs font-medium text-neutral-600">
              Status
            </label>
            <select
              id="emails-status"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as TrackingStatus | '');
                setPage(1);
              }}
              className={`${SELECT_CLASS} mt-1`}
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.label} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="emails-from" className="block text-xs font-medium text-neutral-600">
              Created from
            </label>
            <input
              id="emails-from"
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
            <label htmlFor="emails-to" className="block text-xs font-medium text-neutral-600">
              Created to
            </label>
            <input
              id="emails-to"
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
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center rounded-lg border border-neutral-200 bg-neutral-50/80 p-0.5 text-xs">
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'opened', label: 'Opened' },
                  { id: 'unopened', label: 'Not opened' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setOpenFilter(opt.id)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                    openFilter === opt.id
                      ? 'bg-white text-neutral-950 shadow-2xs ring-1 ring-neutral-200/70'
                      : 'text-neutral-600 hover:text-neutral-950'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {hasActiveFilters ? (
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
        <TableSkeleton rows={6} cols={6} />
      ) : error ? (
        <ErrorState
          title="Unable to load tracked emails"
          message={error}
          onRetry={() => loadEmails()}
        />
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          title="No tracked emails yet"
          description={
            hasActiveFilters
              ? 'No tracked emails match your current search or filter criteria.'
              : 'Send a tracked email from Gmail using the Chrome extension to see it listed here.'
          }
          action={
            hasActiveFilters ? (
              <Button variant="primary" onClick={clearFilters}>
                Clear filters
              </Button>
            ) : undefined
          }
        />
      ) : (
        <SurfaceCard className="overflow-hidden">
          {filteredItems.length === 0 ? (
            <div className="p-8 text-center text-xs text-neutral-500">
              No emails on this page match the selected activity filter.{' '}
              <button
                type="button"
                onClick={() => setOpenFilter('all')}
                className="font-medium text-blue-600 hover:underline"
              >
                Show all
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-neutral-200/80 text-left text-sm">
                <thead className="bg-neutral-50/80 text-[11px] font-semibold tracking-wide text-neutral-500 uppercase">
                  <tr>
                    <th scope="col" className="px-5 py-3">
                      Recipient
                    </th>
                    <th scope="col" className="px-5 py-3">
                      Subject
                    </th>
                    <th scope="col" className="px-5 py-3">
                      Activity
                    </th>
                    <th scope="col" className="px-5 py-3">
                      Status
                    </th>
                    <th scope="col" className="px-5 py-3">
                      Created
                    </th>
                    <th scope="col" className="px-5 py-3">
                      Last Activity
                    </th>
                    <th scope="col" className="px-5 py-3 text-right">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 bg-white">
                  {filteredItems.map((email) => {
                    const lastActivity = email.lastRecordedAt ?? email.firstRecordedAt;
                    const initial = (email.recipientReference[0] ?? '?').toUpperCase();
                    return (
                      <tr key={email.id} className="group transition-colors hover:bg-neutral-50/80">
                        <td className="max-w-[230px] px-5 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-[11px] font-semibold text-neutral-700">
                              {initial}
                            </span>
                            <span className="truncate text-xs font-medium text-neutral-900">
                              {email.recipientReference}
                            </span>
                          </div>
                        </td>
                        <td className="max-w-[260px] truncate px-5 py-3.5 text-xs text-neutral-700">
                          {email.subject || (
                            <span className="text-neutral-400 italic">No subject</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <OpenStatusBadge
                            firstRecordedAt={email.firstRecordedAt}
                            eventCount={email.eventCount}
                          />
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <TrackingStatusBadge status={email.status} />
                        </td>
                        <td className="px-5 py-3.5 text-xs whitespace-nowrap text-neutral-500 tabular-nums">
                          {formatDateTime(email.createdAt)}
                        </td>
                        <td className="px-5 py-3.5 text-xs whitespace-nowrap text-neutral-500 tabular-nums">
                          {lastActivity ? formatDateTime(lastActivity) : '—'}
                        </td>
                        <td className="px-5 py-3.5 text-right whitespace-nowrap">
                          <Button variant="secondary" onClick={() => onSelectEmail(email.id)}>
                            View details
                            <IconArrowUpRight className="h-3 w-3 text-neutral-400" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <PaginationBar
            page={data.page}
            totalPages={data.totalPages}
            total={data.total}
            onPageChange={setPage}
          />
        </SurfaceCard>
      )}
    </div>
  );
}
