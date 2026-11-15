import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { CampaignStatus, PaginatedCampaignsResponse, TrackedEmail } from '@mailtrack/shared';
import { EmptyState } from '../components/EmptyState.js';
import { ErrorState } from '../components/ErrorState.js';
import { IconDownload, IconPlus, IconSearch } from '../components/Icons.js';
import { TableSkeleton } from '../components/Skeleton.js';
import { CampaignStatusBadge } from '../components/StatusBadge.js';
import { Button } from '../components/ui/Button.js';
import { INPUT_CLASS, SELECT_CLASS, SurfaceCard } from '../components/ui/Card.js';
import { ModalDialog } from '../components/ui/Dialog.js';
import { PaginationBar } from '../components/ui/Pagination.js';
import { ApiError, apiClient } from '../lib/api.js';
import { formatDateTime } from '../lib/format.js';

interface CampaignsPageProps {
  onSelectCampaign: (campaignId: string) => void;
  onNotify: (tone: 'info' | 'success' | 'error', text: string) => void;
}

const STATUS_OPTIONS: Array<{ value: CampaignStatus | ''; label: string }> = [
  { value: '', label: 'All statuses' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'ARCHIVED', label: 'Archived' },
];

export function CampaignsPage({ onSelectCampaign, onNotify }: CampaignsPageProps) {
  const [searchInput, setSearchInput] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [status, setStatus] = useState<CampaignStatus | ''>('');
  const [page, setPage] = useState(1);

  const [data, setData] = useState<PaginatedCampaignsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  // Create-campaign modal state
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [availableEmails, setAvailableEmails] = useState<TrackedEmail[]>([]);
  const [selectedEmailIds, setSelectedEmailIds] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setAppliedSearch(searchInput.trim());
      setPage(1);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const loadCampaigns = useCallback(
    (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      apiClient
        .listCampaigns(
          {
            page,
            limit: 12,
            search: appliedSearch || undefined,
            status: status || undefined,
          },
          signal,
        )
        .then((res) => setData(res))
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === 'AbortError') return;
          setError(err instanceof ApiError ? err.message : 'Unable to load campaigns.');
        })
        .finally(() => setLoading(false));
    },
    [page, appliedSearch, status],
  );

  useEffect(() => {
    const controller = new AbortController();
    loadCampaigns(controller.signal);
    return () => controller.abort();
  }, [loadCampaigns]);

  function openCreateModal() {
    setNewName('');
    setNewDescription('');
    setNameError(null);
    setSelectedEmailIds(new Set());
    setShowCreate(true);

    apiClient
      .listTrackedEmails({ page: 1, limit: 20 })
      .then((res) => setAvailableEmails(Array.isArray(res?.items) ? res.items : []))
      .catch(() => setAvailableEmails([]));
  }

  function toggleEmailSelection(id: string) {
    setSelectedEmailIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (!newName.trim()) {
      setNameError('Enter a campaign name.');
      return;
    }
    setNameError(null);
    setCreating(true);
    try {
      const created = await apiClient.createCampaign({
        name: newName.trim(),
        description: newDescription.trim() || undefined,
      });

      const emailIds = Array.from(selectedEmailIds);
      if (emailIds.length > 0) {
        await Promise.all(
          emailIds.map((emailId) => apiClient.assignEmailCampaign(emailId, created.id)),
        );
      }

      onNotify('success', `Campaign "${created.name}" created.`);
      setShowCreate(false);
      loadCampaigns();
    } catch (err: unknown) {
      onNotify('error', err instanceof ApiError ? err.message : 'Unable to create campaign.');
    } finally {
      setCreating(false);
    }
  }

  async function handleExportCsv() {
    setExporting(true);
    try {
      await apiClient.downloadCsv(
        '/api/exports/campaigns',
        { status: status || undefined },
        'campaigns.csv',
      );
      onNotify('success', 'Exported campaigns CSV.');
    } catch (err: unknown) {
      onNotify('error', err instanceof ApiError ? err.message : 'Unable to export campaigns.');
    } finally {
      setExporting(false);
    }
  }

  const hasFilters = Boolean(appliedSearch || status);

  return (
    <div className="space-y-4">
      <SurfaceCard className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2.5">
            <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
              <IconSearch className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                type="search"
                aria-label="Search campaigns"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search campaigns..."
                className={`${INPUT_CLASS} pl-8`}
              />
            </div>

            <select
              aria-label="Campaign status"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as CampaignStatus | '');
                setPage(1);
              }}
              className={SELECT_CLASS}
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value || 'all'} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="secondary" loading={exporting} onClick={handleExportCsv}>
              <IconDownload className="h-3.5 w-3.5" />
              Export CSV
            </Button>
            <Button variant="primary" onClick={openCreateModal}>
              <IconPlus className="h-3.5 w-3.5" />
              New Campaign
            </Button>
          </div>
        </div>
      </SurfaceCard>

      {loading ? (
        <TableSkeleton rows={5} />
      ) : error ? (
        <ErrorState
          title="Unable to load campaigns"
          message={error}
          onRetry={() => loadCampaigns()}
        />
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          title={hasFilters ? 'No matching campaigns' : 'No campaigns yet'}
          description={
            hasFilters
              ? 'No campaigns match your current search or status filter.'
              : 'Group related outreach emails into a campaign to track combined activity and follow-ups.'
          }
          action={
            hasFilters ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setSearchInput('');
                  setAppliedSearch('');
                  setStatus('');
                  setPage(1);
                }}
              >
                Clear filters
              </Button>
            ) : (
              <Button size="sm" variant="primary" onClick={openCreateModal}>
                <IconPlus className="h-3.5 w-3.5" />
                New Campaign
              </Button>
            )
          }
        />
      ) : (
        <SurfaceCard className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left text-[13px]">
              <thead className="border-b border-[var(--border-default)] bg-[var(--bg-subtle)] text-[12px] font-medium text-[var(--text-secondary)]">
                <tr>
                  <th className="px-4 py-2.5">Campaign</th>
                  <th className="px-4 py-2.5">Emails</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">Created</th>
                  <th className="px-4 py-2.5 text-right">
                    <span className="sr-only">Open</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-default)]">
                {data.items.map((campaign) => (
                  <tr
                    key={campaign.id}
                    onClick={() => onSelectCampaign(campaign.id)}
                    className="cursor-pointer transition-colors duration-150 hover:bg-[var(--bg-subtle)]"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-[var(--text-primary)]">{campaign.name}</div>
                      {campaign.description ? (
                        <div className="mt-0.5 line-clamp-1 text-[12px] text-[var(--text-muted)]">
                          {campaign.description}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-[var(--text-secondary)] tabular-nums">
                      {campaign.emailCount ?? 0}
                    </td>
                    <td className="px-4 py-3">
                      <CampaignStatusBadge status={campaign.status} />
                    </td>
                    <td className="px-4 py-3 text-[12px] text-[var(--text-muted)] tabular-nums">
                      {formatDateTime(campaign.createdAt)}
                    </td>
                    <td
                      className="px-4 py-3 text-right"
                      onClick={(e) => {
                        e.stopPropagation();
                      }}
                    >
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onSelectCampaign(campaign.id)}
                      >
                        Open
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <PaginationBar
            page={data.page}
            totalPages={data.totalPages}
            totalItems={data.total}
            itemLabel="campaigns"
            onPageChange={setPage}
          />
        </SurfaceCard>
      )}

      {/* Create Campaign Modal */}
      <ModalDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="New campaign"
        description="Group tracked emails together to monitor outreach performance."
        maxWidthClass="max-w-lg"
      >
        <form onSubmit={handleCreate} className="space-y-4" noValidate>
          <div>
            <label
              htmlFor="campaign-name-input"
              className="block text-[12px] font-medium text-[var(--text-secondary)]"
            >
              Name
            </label>
            <input
              id="campaign-name-input"
              type="text"
              value={newName}
              onChange={(e) => {
                setNewName(e.target.value);
                if (nameError) setNameError(null);
              }}
              placeholder="Q4 Enterprise Outreach"
              maxLength={120}
              className={`${INPUT_CLASS} mt-1.5`}
            />
            {nameError ? (
              <p className="mt-1 text-[12px] text-[var(--status-danger-text)]">{nameError}</p>
            ) : null}
          </div>

          <div>
            <label
              htmlFor="campaign-desc-input"
              className="block text-[12px] font-medium text-[var(--text-secondary)]"
            >
              Description (optional)
            </label>
            <textarea
              id="campaign-desc-input"
              rows={2}
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="Decision makers contacted in Q4"
              maxLength={500}
              className="mt-1.5 w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)] px-2.5 py-2 text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
            />
          </div>

          {availableEmails.length > 0 ? (
            <div>
              <div className="flex items-center justify-between text-[12px]">
                <span className="font-medium text-[var(--text-secondary)]">
                  Add existing emails (optional)
                </span>
                {selectedEmailIds.size > 0 ? (
                  <span className="text-[var(--text-muted)] tabular-nums">
                    {selectedEmailIds.size} selected
                  </span>
                ) : null}
              </div>
              <div className="mt-1.5 max-h-40 divide-y divide-[var(--border-default)] overflow-y-auto rounded-[var(--radius-md)] border border-[var(--border-default)]">
                {availableEmails.map((email) => (
                  <label
                    key={email.id}
                    className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-[12px] hover:bg-[var(--bg-subtle)]"
                  >
                    <input
                      type="checkbox"
                      checked={selectedEmailIds.has(email.id)}
                      onChange={() => toggleEmailSelection(email.id)}
                      className="h-3.5 w-3.5 rounded border-[var(--border-strong)] accent-[var(--accent)]"
                    />
                    <span className="min-w-0 flex-1 truncate text-[var(--text-primary)]">
                      {email.subject || 'No subject'}
                    </span>
                    <span className="max-w-[160px] truncate text-[var(--text-muted)]">
                      {email.recipientReference}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ) : null}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={creating}>
              {creating ? 'Creating...' : 'Create campaign'}
            </Button>
          </div>
        </form>
      </ModalDialog>
    </div>
  );
}
