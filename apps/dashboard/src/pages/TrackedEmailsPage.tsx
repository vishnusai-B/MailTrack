import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import type { Campaign, PaginatedTrackedEmailsResponse, TrackingStatus } from '@mailtrack/shared';
import { EmptyState } from '../components/EmptyState.js';
import { ErrorState } from '../components/ErrorState.js';
import { IconDownload, IconMoreHorizontal, IconSearch, IconX } from '../components/Icons.js';
import { TableSkeleton } from '../components/Skeleton.js';
import { EngagementSignal, TrackingStatusBadge } from '../components/StatusBadge.js';
import { Button } from '../components/ui/Button.js';
import { INPUT_CLASS, SELECT_CLASS, SurfaceCard } from '../components/ui/Card.js';
import { ModalDialog } from '../components/ui/Dialog.js';
import { PaginationBar } from '../components/ui/Pagination.js';
import { ApiError, apiClient } from '../lib/api.js';
import { formatDateTime, formatRelativeTime, getInitialFromEmail } from '../lib/format.js';

interface TrackedEmailsPageProps {
  onSelectEmail: (emailId: string) => void;
  onNotify?: (tone: 'success' | 'error' | 'info', text: string) => void;
  refreshSignal?: number;
}

type SortField = 'recipient' | 'subject' | 'engagement' | 'status' | 'sent' | 'activity';

const STATUS_OPTIONS: Array<{ value: TrackingStatus | ''; label: string }> = [
  { value: '', label: 'All statuses' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'DISPATCHED', label: 'Dispatched' },
  { value: 'SENT', label: 'Sent' },
  { value: 'FAILED', label: 'Failed' },
  { value: 'EXPIRED', label: 'Expired' },
];

export function TrackedEmailsPage({
  onSelectEmail,
  onNotify,
  refreshSignal = 0,
}: TrackedEmailsPageProps) {
  const [searchInput, setSearchInput] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [status, setStatus] = useState<TrackingStatus | ''>('');
  const [openFilter, setOpenFilter] = useState<'all' | 'opened' | 'unopened'>('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(15);

  const [sortField, setSortField] = useState<SortField>('sent');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const [data, setData] = useState<PaginatedTrackedEmailsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Bulk/Row Modals
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignModalIds, setCampaignModalIds] = useState<string[] | null>(null);
  const [targetCampaignId, setTargetCampaignId] = useState('');
  const [assigning, setAssigning] = useState(false);

  const [reminderModalIds, setReminderModalIds] = useState<string[] | null>(null);
  const [reminderDueAt, setReminderDueAt] = useState('');
  const [reminderNote, setReminderNote] = useState('');
  const [creatingReminder, setCreatingReminder] = useState(false);

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
        .then((res) => {
          setData(res);
          setSelectedIds(new Set());
        })
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
  }, [loadEmails, refreshSignal]);

  useEffect(() => {
    if (!openMenuId) return;
    const close = () => setOpenMenuId(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [openMenuId]);

  const filteredAndSortedItems = useMemo(() => {
    if (!data) return [];
    const filtered = data.items.filter((item) => {
      const opened = Boolean(item.firstRecordedAt) || (item.eventCount ?? 0) > 0;
      if (openFilter === 'opened') return opened;
      if (openFilter === 'unopened') return !opened;
      return true;
    });

    return [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'recipient':
          cmp = a.recipientReference.localeCompare(b.recipientReference);
          break;
        case 'subject':
          cmp = (a.subject ?? '').localeCompare(b.subject ?? '');
          break;
        case 'engagement':
          cmp = (a.eventCount ?? 0) - (b.eventCount ?? 0);
          break;
        case 'status':
          cmp = a.status.localeCompare(b.status);
          break;
        case 'activity': {
          const tA = a.lastRecordedAt ? new Date(a.lastRecordedAt).getTime() : 0;
          const tB = b.lastRecordedAt ? new Date(b.lastRecordedAt).getTime() : 0;
          cmp = tA - tB;
          break;
        }
        case 'sent':
        default: {
          const tA = new Date(a.sentAt ?? a.createdAt).getTime();
          const tB = new Date(b.sentAt ?? b.createdAt).getTime();
          cmp = tA - tB;
          break;
        }
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [data, openFilter, sortField, sortDir]);

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir(field === 'recipient' || field === 'subject' ? 'asc' : 'desc');
    }
  }

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

  function openCampaignModal(ids: string[]) {
    setCampaignModalIds(ids);
    setTargetCampaignId('');
    apiClient
      .listCampaigns({ limit: 50 })
      .then((res) => setCampaigns(res.items))
      .catch(() => setCampaigns([]));
  }

  async function handleBulkAssignCampaign(e: FormEvent) {
    e.preventDefault();
    if (!campaignModalIds || campaignModalIds.length === 0) return;
    setAssigning(true);
    try {
      await Promise.all(
        campaignModalIds.map((id) => apiClient.assignEmailCampaign(id, targetCampaignId || null)),
      );
      onNotify?.(
        'success',
        targetCampaignId
          ? `Updated campaign for ${campaignModalIds.length} ${campaignModalIds.length === 1 ? 'email' : 'emails'}.`
          : `Removed ${campaignModalIds.length} ${campaignModalIds.length === 1 ? 'email' : 'emails'} from campaign.`,
      );
      setCampaignModalIds(null);
      setSelectedIds(new Set());
      loadEmails();
    } catch (err: unknown) {
      onNotify?.('error', err instanceof ApiError ? err.message : 'Unable to update campaign.');
    } finally {
      setAssigning(false);
    }
  }

  async function handleBulkCreateReminder(e: FormEvent) {
    e.preventDefault();
    if (!reminderModalIds || !reminderDueAt) return;
    setCreatingReminder(true);
    try {
      const dueIso = new Date(reminderDueAt).toISOString();
      await Promise.all(
        reminderModalIds.map((id) =>
          apiClient.createReminder({
            trackedEmailId: id,
            dueAt: dueIso,
            note: reminderNote.trim() || undefined,
          }),
        ),
      );
      onNotify?.(
        'success',
        `Scheduled ${reminderModalIds.length} ${reminderModalIds.length === 1 ? 'reminder' : 'reminders'}.`,
      );
      setReminderModalIds(null);
      setReminderDueAt('');
      setReminderNote('');
      setSelectedIds(new Set());
    } catch (err: unknown) {
      onNotify?.('error', err instanceof ApiError ? err.message : 'Unable to create reminders.');
    } finally {
      setCreatingReminder(false);
    }
  }

  const allVisibleSelected =
    filteredAndSortedItems.length > 0 &&
    filteredAndSortedItems.every((item) => selectedIds.has(item.id));

  function toggleSelectAll() {
    if (allVisibleSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredAndSortedItems.map((i) => i.id)));
    }
  }

  function toggleSelectRow(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-4">
      {/* Filter Bar */}
      <SurfaceCard className="p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
          <div className="md:col-span-4">
            <label htmlFor="email-search" className="sr-only">
              Search recipient or subject
            </label>
            <div className="relative">
              <IconSearch className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                id="email-search"
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search recipient or subject..."
                className={`${INPUT_CLASS} pl-8`}
              />
            </div>
          </div>

          <div className="md:col-span-2">
            <label htmlFor="email-status-filter" className="sr-only">
              Status
            </label>
            <select
              id="email-status-filter"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as TrackingStatus | '');
                setPage(1);
              }}
              className={`${SELECT_CLASS} w-full`}
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value || 'all'} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2 md:col-span-3">
            <input
              type="date"
              aria-label="From date"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                setPage(1);
              }}
              className={INPUT_CLASS}
            />
            <input
              type="date"
              aria-label="To date"
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value);
                setPage(1);
              }}
              className={INPUT_CLASS}
            />
          </div>

          <div className="flex items-center justify-between gap-2 md:col-span-3 md:justify-end">
            <div
              role="group"
              aria-label="Activity filter"
              className="inline-flex rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-subtle)] p-0.5"
            >
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'opened', label: 'Opened' },
                  { id: 'unopened', label: 'Not opened' },
                ] as const
              ).map((seg) => (
                <button
                  key={seg.id}
                  type="button"
                  onClick={() => setOpenFilter(seg.id)}
                  aria-pressed={openFilter === seg.id}
                  className={`rounded-[var(--radius-sm)] px-2 py-1 text-[12px] font-medium whitespace-nowrap transition-colors duration-150 ${
                    openFilter === seg.id
                      ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-[var(--shadow-sm)]'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {seg.label}
                </button>
              ))}
            </div>

            <Button size="md" variant="secondary" loading={exporting} onClick={handleExportCsv}>
              <IconDownload className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Export CSV</span>
            </Button>
          </div>
        </div>

        {/* Active Filter Chips */}
        {hasActiveFilters ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[var(--border-default)] pt-3 text-[12px]">
            <span className="text-[var(--text-muted)]">Active filters:</span>
            {appliedSearch ? (
              <span className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] bg-[var(--bg-subtle)] px-2 py-0.5 text-[var(--text-primary)]">
                Search: {appliedSearch}
                <button
                  type="button"
                  aria-label="Clear search filter"
                  onClick={() => {
                    setSearchInput('');
                    setAppliedSearch('');
                  }}
                >
                  <IconX className="h-3 w-3" />
                </button>
              </span>
            ) : null}
            {status ? (
              <span className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] bg-[var(--bg-subtle)] px-2 py-0.5 text-[var(--text-primary)]">
                Status: {STATUS_OPTIONS.find((s) => s.value === status)?.label}
                <button
                  type="button"
                  aria-label="Clear status filter"
                  onClick={() => setStatus('')}
                >
                  <IconX className="h-3 w-3" />
                </button>
              </span>
            ) : null}
            {openFilter !== 'all' ? (
              <span className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] bg-[var(--bg-subtle)] px-2 py-0.5 text-[var(--text-primary)]">
                {openFilter === 'opened' ? 'Opened' : 'Not opened'}
                <button
                  type="button"
                  aria-label="Clear activity filter"
                  onClick={() => setOpenFilter('all')}
                >
                  <IconX className="h-3 w-3" />
                </button>
              </span>
            ) : null}
            {fromDate || toDate ? (
              <span className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] bg-[var(--bg-subtle)] px-2 py-0.5 text-[var(--text-primary)]">
                Dates: {fromDate || '…'} – {toDate || '…'}
                <button
                  type="button"
                  aria-label="Clear date filters"
                  onClick={() => {
                    setFromDate('');
                    setToDate('');
                  }}
                >
                  <IconX className="h-3 w-3" />
                </button>
              </span>
            ) : null}
            <button
              type="button"
              onClick={clearFilters}
              className="ml-auto text-[12px] font-medium text-[var(--accent-text)] hover:underline"
            >
              Clear filters
            </button>
          </div>
        ) : null}
      </SurfaceCard>

      {/* Bulk Action Bar */}
      {selectedIds.size > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-4 py-2.5 shadow-[var(--shadow-sm)]">
          <span className="text-[13px] font-medium text-[var(--text-primary)] tabular-nums">
            {selectedIds.size} selected
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => openCampaignModal(Array.from(selectedIds))}
            >
              Add to campaign
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setReminderModalIds(Array.from(selectedIds))}
            >
              Set reminder
            </Button>
            <Button size="sm" variant="secondary" onClick={handleExportCsv}>
              Export
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
              Clear
            </Button>
          </div>
        </div>
      ) : null}

      {/* Table / Loading / Empty / Error */}
      {loading ? (
        <TableSkeleton rows={6} />
      ) : error ? (
        <ErrorState
          title="Unable to load tracked emails"
          message={error}
          onRetry={() => loadEmails()}
        />
      ) : !data || filteredAndSortedItems.length === 0 ? (
        <EmptyState
          title={hasActiveFilters ? 'No matching emails' : 'No tracked emails yet'}
          description={
            hasActiveFilters
              ? 'No emails match your current search or filter criteria.'
              : 'Send an email with tracking enabled in Gmail to see it listed here.'
          }
          action={
            hasActiveFilters ? (
              <Button size="sm" variant="secondary" onClick={clearFilters}>
                Clear filters
              </Button>
            ) : undefined
          }
        />
      ) : (
        <SurfaceCard className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-left text-[13px]">
              <thead className="sticky top-0 z-10 border-b border-[var(--border-default)] bg-[var(--bg-subtle)] text-[12px] font-medium text-[var(--text-secondary)]">
                <tr>
                  <th className="w-10 px-3 py-2.5">
                    <input
                      type="checkbox"
                      aria-label="Select all emails on page"
                      checked={allVisibleSelected}
                      onChange={toggleSelectAll}
                      className="h-3.5 w-3.5 rounded border-[var(--border-strong)] accent-[var(--accent)]"
                    />
                  </th>
                  {(
                    [
                      { key: 'recipient', label: 'Recipient' },
                      { key: 'subject', label: 'Subject' },
                      { key: 'engagement', label: 'Engagement' },
                      { key: 'status', label: 'Status' },
                      { key: 'sent', label: 'Sent' },
                      { key: 'activity', label: 'Last activity' },
                    ] as const
                  ).map((col) => (
                    <th key={col.key} className="px-3 py-2.5">
                      <button
                        type="button"
                        onClick={() => toggleSort(col.key)}
                        className="inline-flex items-center gap-1 font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                      >
                        {col.label}
                        {sortField === col.key ? (
                          <span className="text-[10px]">{sortDir === 'asc' ? '↑' : '↓'}</span>
                        ) : null}
                      </button>
                    </th>
                  ))}
                  <th className="w-10 px-3 py-2.5 text-right">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-default)]">
                {filteredAndSortedItems.map((email) => {
                  const isSelected = selectedIds.has(email.id);
                  const sentTimestamp = email.sentAt ?? email.createdAt;
                  return (
                    <tr
                      key={email.id}
                      onClick={() => onSelectEmail(email.id)}
                      className={`cursor-pointer transition-colors duration-150 ${
                        isSelected ? 'bg-[var(--accent-soft)]' : 'hover:bg-[var(--bg-subtle)]'
                      }`}
                    >
                      <td
                        className="px-3 py-2.5"
                        onClick={(e) => {
                          e.stopPropagation();
                        }}
                      >
                        <input
                          type="checkbox"
                          aria-label={`Select ${email.recipientReference}`}
                          checked={isSelected}
                          onChange={() => toggleSelectRow(email.id)}
                          className="h-3.5 w-3.5 rounded border-[var(--border-strong)] accent-[var(--accent)]"
                        />
                      </td>

                      <td className="max-w-[220px] px-3 py-2.5">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--bg-hover)] text-[11px] font-semibold text-[var(--text-primary)]">
                            {getInitialFromEmail(email.recipientReference)}
                          </span>
                          <span
                            title={email.recipientReference}
                            className="truncate font-medium text-[var(--text-primary)]"
                          >
                            {email.recipientReference}
                          </span>
                        </div>
                      </td>

                      <td className="max-w-[220px] px-3 py-2.5">
                        <span
                          title={email.subject || 'No subject'}
                          className={`block truncate ${
                            email.subject
                              ? 'text-[var(--text-primary)]'
                              : 'italic text-[var(--text-muted)]'
                          }`}
                        >
                          {email.subject || 'No subject'}
                        </span>
                      </td>

                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <EngagementSignal
                          firstRecordedAt={email.firstRecordedAt}
                          eventCount={email.eventCount}
                        />
                      </td>

                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <TrackingStatusBadge status={email.status} />
                      </td>

                      <td className="px-3 py-2.5 text-[12px] whitespace-nowrap text-[var(--text-secondary)] tabular-nums">
                        {formatDateTime(sentTimestamp)}
                      </td>

                      <td
                        title={
                          email.lastRecordedAt ? formatDateTime(email.lastRecordedAt) : undefined
                        }
                        className="px-3 py-2.5 text-[12px] whitespace-nowrap text-[var(--text-muted)] tabular-nums"
                      >
                        {formatRelativeTime(email.lastRecordedAt)}
                      </td>

                      <td
                        className="relative px-3 py-2.5 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          aria-label={`Row actions for ${email.recipientReference}`}
                          aria-expanded={openMenuId === email.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuId((cur) => (cur === email.id ? null : email.id));
                          }}
                          className="rounded-[var(--radius-sm)] p-1 text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
                        >
                          <IconMoreHorizontal className="h-4 w-4" />
                        </button>

                        {openMenuId === email.id ? (
                          <div
                            role="menu"
                            className="absolute right-3 z-20 mt-1 w-44 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-elevated)] p-1 text-left shadow-[var(--shadow-md)]"
                          >
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => {
                                setOpenMenuId(null);
                                onSelectEmail(email.id);
                              }}
                              className="block w-full rounded-[var(--radius-sm)] px-2.5 py-1.5 text-[12px] text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
                            >
                              Open details
                            </button>
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => {
                                setOpenMenuId(null);
                                openCampaignModal([email.id]);
                              }}
                              className="block w-full rounded-[var(--radius-sm)] px-2.5 py-1.5 text-[12px] text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
                            >
                              Add to campaign
                            </button>
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => {
                                setOpenMenuId(null);
                                setReminderModalIds([email.id]);
                              }}
                              className="block w-full rounded-[var(--radius-sm)] px-2.5 py-1.5 text-[12px] text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
                            >
                              Set reminder
                            </button>
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => {
                                setOpenMenuId(null);
                                void navigator.clipboard
                                  ?.writeText(email.id)
                                  .then(() => onNotify?.('success', 'Tracking ID copied.'))
                                  .catch(() => onNotify?.('info', `Tracking ID: ${email.id}`));
                              }}
                              className="block w-full rounded-[var(--radius-sm)] px-2.5 py-1.5 text-[12px] text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
                            >
                              Copy tracking ID
                            </button>
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <PaginationBar
            page={data.page}
            totalPages={data.totalPages}
            totalItems={data.total}
            itemLabel="emails"
            pageSize={limit}
            onPageSizeChange={(nextLimit) => {
              setLimit(nextLimit);
              setPage(1);
            }}
            onPageChange={setPage}
          />
        </SurfaceCard>
      )}

      {/* Add to Campaign Modal */}
      <ModalDialog
        open={Boolean(campaignModalIds)}
        onClose={() => setCampaignModalIds(null)}
        title="Assign to campaign"
        description={`Choose a campaign for ${campaignModalIds?.length ?? 0} selected ${
          campaignModalIds?.length === 1 ? 'email' : 'emails'
        }.`}
        maxWidthClass="max-w-md"
      >
        <form onSubmit={handleBulkAssignCampaign} className="space-y-4">
          <div>
            <label
              htmlFor="bulk-campaign-select"
              className="block text-[12px] font-medium text-[var(--text-secondary)]"
            >
              Campaign
            </label>
            <select
              id="bulk-campaign-select"
              value={targetCampaignId}
              onChange={(e) => setTargetCampaignId(e.target.value)}
              className={`${SELECT_CLASS} mt-1.5 w-full`}
            >
              <option value="">No campaign (unassign)</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setCampaignModalIds(null)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={assigning}>
              Save
            </Button>
          </div>
        </form>
      </ModalDialog>

      {/* Set Reminder Modal */}
      <ModalDialog
        open={Boolean(reminderModalIds)}
        onClose={() => setReminderModalIds(null)}
        title="Set follow-up reminder"
        description={`Schedule a follow-up for ${reminderModalIds?.length ?? 0} selected ${
          reminderModalIds?.length === 1 ? 'email' : 'emails'
        }.`}
        maxWidthClass="max-w-md"
      >
        <form onSubmit={handleBulkCreateReminder} className="space-y-4">
          <div>
            <label
              htmlFor="bulk-reminder-due"
              className="block text-[12px] font-medium text-[var(--text-secondary)]"
            >
              Due date & time
            </label>
            <input
              id="bulk-reminder-due"
              type="datetime-local"
              required
              value={reminderDueAt}
              onChange={(e) => setReminderDueAt(e.target.value)}
              className={`${INPUT_CLASS} mt-1.5`}
            />
          </div>
          <div>
            <label
              htmlFor="bulk-reminder-note"
              className="block text-[12px] font-medium text-[var(--text-secondary)]"
            >
              Note (optional)
            </label>
            <input
              id="bulk-reminder-note"
              type="text"
              value={reminderNote}
              onChange={(e) => setReminderNote(e.target.value)}
              placeholder="Follow up if no reply"
              className={`${INPUT_CLASS} mt-1.5`}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setReminderModalIds(null)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={creatingReminder}>
              Set reminder
            </Button>
          </div>
        </form>
      </ModalDialog>
    </div>
  );
}
