import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { CampaignStatus, PaginatedCampaignsResponse } from '@mailtrack/shared';
import { EmptyState } from '../components/EmptyState.js';
import { ErrorState } from '../components/ErrorState.js';
import {
  IconChevronLeft,
  IconChevronRight,
  IconDownload,
  IconSearch,
} from '../components/Icons.js';
import { TableSkeleton } from '../components/Skeleton.js';
import { CampaignStatusBadge } from '../components/StatusBadge.js';
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
        <p className="text-xs text-slate-500">
          Organize tracked emails into campaigns to view grouped analytics and follow-ups.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={exporting}
            onClick={() => void handleExportCsv()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-xs transition hover:bg-slate-50 disabled:opacity-60"
          >
            <IconDownload className="h-3.5 w-3.5" />
            {exporting ? 'Exporting...' : 'Export CSV'}
          </button>
          <button
            type="button"
            onClick={() => setShowCreate((v) => !v)}
            className="rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-blue-700"
          >
            {showCreate ? 'Cancel' : 'New Campaign'}
          </button>
        </div>
      </div>

      {showCreate ? (
        <form
          onSubmit={(e) => void handleCreate(e)}
          className="rounded-xl border border-blue-200 bg-white p-5 shadow-xs"
        >
          <h2 className="text-sm font-semibold text-slate-900">Create Campaign</h2>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="campaign-name" className="block text-xs font-medium text-slate-700">
                Campaign Name
              </label>
              <input
                id="campaign-name"
                type="text"
                required
                maxLength={120}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Q4 Enterprise Outreach"
                className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="campaign-desc" className="block text-xs font-medium text-slate-700">
                Description (optional)
              </label>
              <input
                id="campaign-desc"
                type="text"
                maxLength={500}
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Short note about this outreach group"
                className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              type="submit"
              disabled={creating}
              className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {creating ? 'Creating...' : 'Create Campaign'}
            </button>
          </div>
        </form>
      ) : null}

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <label htmlFor="campaigns-search" className="block text-xs font-medium text-slate-600">
              Search campaigns
            </label>
            <div className="relative mt-1">
              <IconSearch className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-slate-400" />
              <input
                id="campaigns-search"
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search by campaign name or description..."
                className="block w-full rounded-lg border border-slate-300 bg-white py-2 pr-3 pl-9 text-sm text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label htmlFor="campaigns-status" className="block text-xs font-medium text-slate-600">
              Status
            </label>
            <select
              id="campaigns-status"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as CampaignStatus | '');
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
        </div>
      </section>

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
              : 'Create your first campaign to group tracked emails and view campaign analytics.'
          }
          action={
            !showCreate ? (
              <button
                type="button"
                onClick={() => setShowCreate(true)}
                className="rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700"
              >
                New Campaign
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {data.items.map((campaign) => (
              <article
                key={campaign.id}
                className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-xs transition hover:border-slate-300"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold text-slate-900">{campaign.name}</h3>
                    <CampaignStatusBadge status={campaign.status} />
                  </div>
                  <p className="mt-1.5 line-clamp-2 text-xs text-slate-600">
                    {campaign.description || 'No description'}
                  </p>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
                  <div>
                    <span className="font-semibold text-slate-900 tabular-nums">
                      {campaign.emailCount ?? 0}
                    </span>{' '}
                    {campaign.emailCount === 1 ? 'email' : 'emails'} ·{' '}
                    {formatDateTime(campaign.createdAt)}
                  </div>
                  <button
                    type="button"
                    onClick={() => onSelectCampaign(campaign.id)}
                    className="font-semibold text-blue-600 hover:text-blue-700"
                  >
                    Open
                  </button>
                </div>
              </article>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-5 py-3 text-xs text-slate-600">
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
                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                <IconChevronLeft className="h-3.5 w-3.5" />
                Previous
              </button>
              <button
                type="button"
                disabled={data.page >= data.totalPages}
                onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Next
                <IconChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
