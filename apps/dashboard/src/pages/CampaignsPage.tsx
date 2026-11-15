
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { CampaignStatus, PaginatedCampaignsResponse } from '@mailtrack/shared';
import { EmptyState } from '../components/EmptyState.js';
import { ErrorState } from '../components/ErrorState.js';
import {
  IconArrowUpRight,
  IconDownload,
  IconFolder,
  IconPlus,
  IconSearch,
} from '../components/Icons.js';
import { TableSkeleton } from '../components/Skeleton.js';
import { CampaignStatusBadge } from '../components/StatusBadge.js';
import { Button } from '../components/ui/Button.js';
import { INPUT_CLASS, SELECT_CLASS, SurfaceCard } from '../components/ui/Card.js';
import { PaginationBar } from '../components/ui/Pagination.js';
import { ApiError, apiClient } from '../lib/api.js';
import { formatDateTime } from '../lib/format.js';

interface CampaignsPageProps {
  onSelectCampaign: (campaignId: string) => void;
  onNotify: (tone: 'info' | 'success' | 'error', text: string) => void;
}

const STATUS_OPTIONS: Array<{ value: CampaignStatus | ''; label: string }> = [
  { value: '', label: 'All statuses' },
  { value: 'ACTIVE', label: 'ACTIVE' },
  { value: 'COMPLETED', label: 'COMPLETED' },
  { value: 'ARCHIVED', label: 'ARCHIVED' },
];

export function CampaignsPage({ onSelectCampaign, onNotify }: CampaignsPageProps) {
  const [searchInput, setSearchInput] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [status, setStatus] = useState<CampaignStatus | ''>('');
  const [page, setPage] = useState(1);

  const [data, setData] = useState<PaginatedCampaignsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [exporting, setExporting] = useState(false);

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

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const created = await apiClient.createCampaign({
        name: newName.trim(),
        description: newDescription.trim() || undefined,
      });
      onNotify('success', `Campaign "${created.name}" created.`);
      setNewName('');
      setNewDescription('');
      setShowCreate(false);
      loadCampaigns();
    } catch (err) {
      onNotify('error', err instanceof ApiError ? err.message : 'Failed to create campaign.');
    } finally {
      setCreating(false);
    }
  }

  async function handleExportCsv() {
    setExporting(true);
    try {
      await apiClient.downloadCsv(
        '/api/exports/campaigns',
        { search: appliedSearch || undefined, status: status || undefined },
        'mailtrack-campaigns.csv',
      );
      onNotify('success', 'Campaigns CSV exported.');
    } catch (err) {
      onNotify('error', err instanceof ApiError ? err.message : 'Failed to export campaigns.');
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-neutral-500">
          Organize tracked emails into campaigns for grouped metrics and follow-ups.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" disabled={exporting} onClick={() => void handleExportCsv()}>
            <IconDownload className="h-3.5 w-3.5" />
            {exporting ? 'Exporting...' : 'Export CSV'}
          </Button>
          <Button variant="primary" onClick={() => setShowCreate((v) => !v)}>
            {!showCreate ? <IconPlus className="h-3.5 w-3.5" /> : null}
            {showCreate ? 'Cancel' : 'New Campaign'}
          </Button>
        </div>
      </div>

      {showCreate ? (
        <SurfaceCard className="border-blue-200/80 p-5">
          <form onSubmit={(e) => void handleCreate(e)}>
            <h2 className="text-sm font-semibold text-neutral-900">Create Campaign</h2>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="campaign-name"
                  className="block text-xs font-medium text-neutral-700"
                >
                  Campaign Name
                </label>
                <input
                  id="campaign-name"
                  type="text"
                  required
                  maxLength={120}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Q4 Enterprise Outreach"
                  className={`${INPUT_CLASS} mt-1`}
                />
              </div>
              <div>
                <label
                  htmlFor="campaign-desc"
                  className="block text-xs font-medium text-neutral-700"
                >
                  Description (optional)
                </label>
                <input
                  id="campaign-desc"
                  type="text"
                  maxLength={500}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Short note about this group"
                  className={`${INPUT_CLASS} mt-1`}
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={creating}>
                {creating ? 'Creating...' : 'Create Campaign'}
              </Button>
            </div>
          </form>
        </SurfaceCard>
      ) : null}

      <SurfaceCard className="p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <label
              htmlFor="campaigns-search"
              className="block text-xs font-medium text-neutral-600"
            >
              Search campaigns
            </label>
            <div className="relative mt-1">
              <IconSearch className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-neutral-400" />
              <input
                id="campaigns-search"
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search by name or description..."
                className={`${INPUT_CLASS} pl-9`}
              />
            </div>
          </div>
          <div>
            <label
              htmlFor="campaigns-status"
              className="block text-xs font-medium text-neutral-600"
            >
              Status
            </label>
            <select
              id="campaigns-status"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as CampaignStatus | '');
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
        </div>
      </SurfaceCard>

      {loading ? (
        <TableSkeleton rows={5} cols={4} />
      ) : error ? (
        <ErrorState
          title="Unable to load campaigns"
          message={error}
          onRetry={() => loadCampaigns()}
        />
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          title="No campaigns found"
          description={
            appliedSearch || status
              ? 'No campaigns match your current filters.'
              : 'Create a campaign to group tracked emails and monitor them together.'
          }
          action={
            !showCreate ? (
              <Button variant="primary" onClick={() => setShowCreate(true)}>
                <IconPlus className="h-3.5 w-3.5" />
                New Campaign
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {data.items.map((campaign) => (
              <article
                key={campaign.id}
                className="group flex flex-col justify-between rounded-xl border border-neutral-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition duration-150 hover:border-neutral-300"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-600">
                        <IconFolder className="h-3.5 w-3.5" />
                      </span>
                      <h3 className="truncate text-sm font-semibold text-neutral-900">
                        {campaign.name}
                      </h3>
                    </div>
                    <CampaignStatusBadge status={campaign.status} />
                  </div>
                  <p className="mt-2.5 line-clamp-2 text-xs leading-relaxed text-neutral-500">
                    {campaign.description || 'No description'}
                  </p>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-neutral-100 pt-3 text-xs text-neutral-500">
                  <div className="tabular-nums">
                    <span className="font-semibold text-neutral-900">
                      {campaign.emailCount ?? 0}
                    </span>{' '}
                    {campaign.emailCount === 1 ? 'email' : 'emails'} ·{' '}
                    {formatDateTime(campaign.createdAt)}
                  </div>
                  <button
                    type="button"
                    onClick={() => onSelectCampaign(campaign.id)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 transition hover:text-blue-700"
                  >
                    Open
                    <IconArrowUpRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </article>
            ))}
          </div>

          <SurfaceCard className="overflow-hidden">
            <PaginationBar
              page={data.page}
              totalPages={data.totalPages}
              total={data.total}
              onPageChange={setPage}
            />
          </SurfaceCard>
        </div>
      )}
    </div>
  );
}
