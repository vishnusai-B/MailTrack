import { useCallback, useEffect, useState } from 'react';
import type { PaginatedTrackedEmailsResponse, TrackingStatus } from '@mailtrack/shared';
import { EmptyState } from '../components/EmptyState.js';
import { ErrorState } from '../components/ErrorState.js';
import {
  IconChevronLeft,
  IconChevronRight,
  IconDownload,
  IconSearch,
} from '../components/Icons.js';
import { TableSkeleton } from '../components/Skeleton.js';
import { TrackingStatusBadge } from '../components/StatusBadge.js';
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

  function clearFilters() {
    setSearchInput('');
    setAppliedSearch('');
    setStatus('');
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

  return (
    <div className="space-y-5">
      {/* Filters */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <label htmlFor="emails-search" className="block text-xs font-medium text-slate-600">
              Search recipient or subject
            </label>
            <div className="relative mt-1">
              <IconSearch className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-slate-400" />
              <input
                id="emails-search"
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search by recipient or subject..."
                className="block w-full rounded-lg border border-slate-300 bg-white py-2 pr-3 pl-9 text-sm text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label htmlFor="emails-status" className="block text-xs font-medium text-slate-600">
              Status
            </label>
            <select
              id="emails-status"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as TrackingStatus | '');
                setPage(1);
              }}
              className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.label} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="emails-from" className="block text-xs font-medium text-slate-600">
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
              className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="emails-to" className="block text-xs font-medium text-slate-600">
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
        <TableSkeleton rows={6} cols={6} />
      ) : error ? (
        <ErrorState
          title="Unable to load tracked emails"
          message={error}
          onRetry={() => loadEmails()}
        />
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          title="No tracked emails found"
          description={
            appliedSearch || status || fromDate || toDate
              ? 'No tracked emails match your current search or filter criteria.'
              : 'Tracked emails registered by the MailTrack extension will appear here.'
          }
          action={
            appliedSearch || status || fromDate || toDate ? (
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
                    Recipient
                  </th>
                  <th scope="col" className="px-5 py-3.5">
                    Subject
                  </th>
                  <th scope="col" className="px-5 py-3.5">
                    Tracking Status
                  </th>
                  <th scope="col" className="px-5 py-3.5">
                    Created Date
                  </th>
                  <th scope="col" className="px-5 py-3.5">
                    Last Recorded Activity
                  </th>
                  <th scope="col" className="px-5 py-3.5 text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {data.items.map((email) => {
                  const lastActivity = email.lastRecordedAt ?? email.firstRecordedAt;
                  return (
                    <tr key={email.id} className="transition hover:bg-slate-50/80">
                      <td className="max-w-[220px] truncate px-5 py-3.5 font-medium text-slate-900">
                        {email.recipientReference}
                      </td>
                      <td className="max-w-[260px] truncate px-5 py-3.5 text-slate-600">
                        {email.subject || <span className="text-slate-400 italic">No subject</span>}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <TrackingStatusBadge status={email.status} />
                      </td>
                      <td className="px-5 py-3.5 text-xs whitespace-nowrap text-slate-500">
                        {formatDateTime(email.createdAt)}
                      </td>
                      <td className="px-5 py-3.5 text-xs whitespace-nowrap text-slate-500">
                        {lastActivity ? formatDateTime(lastActivity) : '—'}
                      </td>
                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => onSelectEmail(email.id)}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                        >
                          View details
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Server-side Pagination */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/60 px-5 py-3 text-xs text-slate-600">
            <div>
              Showing page <span className="font-semibold text-slate-900">{data.page}</span> of{' '}
              <span className="font-semibold text-slate-900">{data.totalPages}</span> ({data.total}{' '}
              total)
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
