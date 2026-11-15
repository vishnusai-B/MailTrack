import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type {
  CampaignAnalyticsResponse,
  PaginatedRemindersResponse,
  PaginatedTrackedEmailsResponse,
} from '@mailtrack/shared';
import {
  ClassificationDistributionChart,
  DailyActivityChart,
  StatusDistributionChart,
} from '../components/Charts.js';
import { EmptyState } from '../components/EmptyState.js';
import { ErrorState } from '../components/ErrorState.js';
import { IconArrowLeft, IconDownload } from '../components/Icons.js';
import { ChartSkeleton, TableSkeleton } from '../components/Skeleton.js';
import {
  CampaignStatusBadge,
  ReminderStatusBadge,
  TrackingStatusBadge,
} from '../components/StatusBadge.js';
import { ApiError, apiClient } from '../lib/api.js';
import { formatDateTime } from '../lib/format.js';

interface CampaignDetailPageProps {
  campaignId: string;
  onBack: () => void;
  onSelectEmail: (emailId: string) => void;
  onNotify: (tone: 'info' | 'success' | 'error', text: string) => void;
}

export function CampaignDetailPage({
  campaignId,
  onBack,
  onSelectEmail,
  onNotify,
}: CampaignDetailPageProps) {
  const [analytics, setAnalytics] = useState<CampaignAnalyticsResponse | null>(null);
  const [emails, setEmails] = useState<PaginatedTrackedEmailsResponse | null>(null);
  const [reminders, setReminders] = useState<PaginatedRemindersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editStatus, setEditStatus] = useState<'ACTIVE' | 'COMPLETED'>('ACTIVE');
  const [saving, setSaving] = useState(false);

  const [confirmArchive, setConfirmArchive] = useState(false);
  const [archiving, setArchiving] = useState(false);

  const loadAll = useCallback(
    (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      Promise.all([
        apiClient.getCampaignAnalytics(campaignId, { days: 30 }, signal),
        apiClient.listCampaignEmails(campaignId, { page: 1, limit: 15 }, signal),
        apiClient.listReminders({ campaignId, filter: 'all', page: 1, limit: 10 }, signal),
      ])
        .then(([analyticsRes, emailsRes, remindersRes]) => {
          setAnalytics(analyticsRes);
          setEmails(emailsRes);
          setReminders(remindersRes);
          setEditName(analyticsRes.campaign.name);
          setEditDescription(analyticsRes.campaign.description ?? '');
          if (
            analyticsRes.campaign.status === 'ACTIVE' ||
            analyticsRes.campaign.status === 'COMPLETED'
          ) {
            setEditStatus(analyticsRes.campaign.status);
          }
        })
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === 'AbortError') return;
          setError(err instanceof ApiError ? err.message : 'Unable to load campaign details.');
        })
        .finally(() => setLoading(false));
    },
    [campaignId],
  );

  useEffect(() => {
    const controller = new AbortController();
    loadAll(controller.signal);
    return () => controller.abort();
  }, [loadAll]);

  async function handleSaveEdit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await apiClient.updateCampaign(campaignId, {
        name: editName.trim(),
        description: editDescription.trim() || null,
        status: editStatus,
      });
      onNotify('success', 'Campaign updated.');
      setEditing(false);
      loadAll();
    } catch (err) {
      onNotify('error', err instanceof ApiError ? err.message : 'Failed to update campaign.');
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive() {
    setArchiving(true);
    try {
      await apiClient.archiveCampaign(campaignId);
      onNotify('info', 'Campaign archived.');
      setConfirmArchive(false);
      loadAll();
    } catch (err) {
      onNotify('error', err instanceof ApiError ? err.message : 'Failed to archive campaign.');
    } finally {
      setArchiving(false);
    }
  }

  async function handleExportAnalytics() {
    try {
      await apiClient.downloadCsv(
        `/api/exports/campaigns/${encodeURIComponent(campaignId)}/analytics`,
        { days: 30 },
        `mailtrack-campaign-${campaignId}-analytics.csv`,
      );
      onNotify('success', 'Campaign analytics CSV exported.');
    } catch (err) {
      onNotify('error', err instanceof ApiError ? err.message : 'Export failed.');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-xs hover:bg-slate-50"
        >
          <IconArrowLeft className="h-3.5 w-3.5" />
          Back to Campaigns
        </button>

        {analytics ? (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void handleExportAnalytics()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <IconDownload className="h-3.5 w-3.5" />
              Export Analytics CSV
            </button>
            {analytics.campaign.status !== 'ARCHIVED' ? (
              <>
                <button
                  type="button"
                  onClick={() => setEditing((v) => !v)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  {editing ? 'Cancel Edit' : 'Edit'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmArchive(true)}
                  className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-100"
                >
                  Archive
                </button>
              </>
            ) : null}
          </div>
        ) : null}
      </div>

      {confirmArchive ? (
        <div
          role="alertdialog"
          aria-labelledby="archive-dialog-title"
          className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-900"
        >
          <div id="archive-dialog-title" className="font-semibold">
            Archive this campaign?
          </div>
          <p className="mt-1">
            Archiving marks the campaign read-only. Existing tracked emails will be preserved.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={archiving}
              onClick={() => void handleArchive()}
              className="rounded-lg bg-rose-600 px-3 py-1.5 font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
            >
              {archiving ? 'Archiving...' : 'Confirm Archive'}
            </button>
            <button
              type="button"
              onClick={() => setConfirmArchive(false)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className="space-y-6">
          <ChartSkeleton />
          <TableSkeleton rows={4} cols={4} />
        </div>
      ) : error || !analytics ? (
        <ErrorState
          title="Unable to load campaign"
          message={error ?? 'Campaign not found.'}
          onRetry={() => loadAll()}
        />
      ) : (
        <>
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">{analytics.campaign.name}</h2>
                <p className="mt-1 text-sm text-slate-600">
                  {analytics.campaign.description || 'No description provided.'}
                </p>
                <p className="mt-2 text-xs text-slate-400">
                  Created {formatDateTime(analytics.campaign.createdAt)}
                  {analytics.campaign.archivedAt
                    ? ` · Archived ${formatDateTime(analytics.campaign.archivedAt)}`
                    : ''}
                </p>
              </div>
              <CampaignStatusBadge status={analytics.campaign.status} />
            </div>

            {editing ? (
              <form
                onSubmit={(e) => void handleSaveEdit(e)}
                className="mt-5 grid grid-cols-1 gap-4 border-t border-slate-100 pt-5 sm:grid-cols-3"
              >
                <div>
                  <label
                    htmlFor="edit-camp-name"
                    className="block text-xs font-medium text-slate-700"
                  >
                    Name
                  </label>
                  <input
                    id="edit-camp-name"
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label
                    htmlFor="edit-camp-desc"
                    className="block text-xs font-medium text-slate-700"
                  >
                    Description
                  </label>
                  <input
                    id="edit-camp-desc"
                    type="text"
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label
                    htmlFor="edit-camp-status"
                    className="block text-xs font-medium text-slate-700"
                  >
                    Status
                  </label>
                  <select
                    id="edit-camp-status"
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as 'ACTIVE' | 'COMPLETED')}
                    className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="COMPLETED">COMPLETED</option>
                  </select>
                </div>
                <div className="sm:col-span-3 flex justify-end">
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            ) : null}
          </section>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
              <div className="text-xs text-slate-500">Total Emails</div>
              <div className="mt-1.5 text-xl font-bold text-slate-900 tabular-nums">
                {analytics.statusCounts.totalEmails}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
              <div className="text-xs text-slate-500">Pending / Dispatched</div>
              <div className="mt-1.5 text-xl font-bold text-sky-700 tabular-nums">
                {analytics.statusCounts.PENDING + analytics.statusCounts.DISPATCHED}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
              <div className="text-xs text-slate-500">Failed / Expired</div>
              <div className="mt-1.5 text-xl font-bold text-rose-700 tabular-nums">
                {analytics.statusCounts.FAILED + analytics.statusCounts.EXPIRED}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
              <div className="text-xs text-slate-500">Pixel Events (30d)</div>
              <div className="mt-1.5 text-xl font-bold text-indigo-700 tabular-nums">
                {analytics.classificationCounts.totalEvents}
              </div>
              <div className="mt-0.5 text-[10px] text-slate-500">Not unique opens</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
              <div className="text-xs text-slate-500">Upcoming Reminders</div>
              <div className="mt-1.5 text-xl font-bold text-amber-700 tabular-nums">
                {analytics.reminderCounts.upcoming}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
              <div className="text-xs text-slate-500">Completed Reminders</div>
              <div className="mt-1.5 text-xl font-bold text-emerald-700 tabular-nums">
                {analytics.reminderCounts.completed}
              </div>
            </div>
          </div>

          <div
            role="note"
            className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600 shadow-xs"
          >
            Recorded pixel events may include email image proxies, security scanners, repeated
            requests, and other automated fetches — they do not establish unique human opens.
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <DailyActivityChart data={analytics.dailyActivity} />
            <StatusDistributionChart counts={analytics.statusCounts} />
            <ClassificationDistributionChart counts={analytics.classificationCounts} />
            <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
              <h3 className="text-sm font-semibold text-slate-900">Campaign Comparison</h3>
              <p className="mt-0.5 text-xs text-slate-500">
                Tracked emails and recorded pixel requests across recent campaigns.
              </p>
              {analytics.comparison.length === 0 ? (
                <p className="mt-6 text-xs text-slate-500">No campaigns to compare.</p>
              ) : (
                <div className="mt-5 space-y-3">
                  {analytics.comparison.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/60 px-3.5 py-2.5 text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium text-slate-900">{item.name}</div>
                        <div className="text-[11px] text-slate-500">{item.status}</div>
                      </div>
                      <div className="text-right tabular-nums text-slate-700">
                        <div>{item.totalEmails} emails</div>
                        <div className="text-[11px] text-slate-500">
                          {item.totalEvents} pixel events
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* Associated Emails */}
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
            <div className="border-b border-slate-200 px-6 py-4">
              <h3 className="text-sm font-semibold text-slate-900">Associated Tracked Emails</h3>
            </div>
            {!emails || emails.items.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  title="No emails in this campaign"
                  description="Assign tracked emails to this campaign from any Email Detail page."
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-semibold text-slate-600 uppercase">
                    <tr>
                      <th className="px-5 py-3">Recipient</th>
                      <th className="px-5 py-3">Subject</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3">Created</th>
                      <th className="px-5 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {emails.items.map((email) => (
                      <tr key={email.id}>
                        <td className="px-5 py-3 font-medium text-slate-900">
                          {email.recipientReference}
                        </td>
                        <td className="px-5 py-3 text-slate-600">
                          {email.subject || '(No subject)'}
                        </td>
                        <td className="px-5 py-3">
                          <TrackingStatusBadge status={email.status} />
                        </td>
                        <td className="px-5 py-3 text-xs text-slate-500">
                          {formatDateTime(email.createdAt)}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => onSelectEmail(email.id)}
                            className="text-xs font-medium text-blue-600 hover:text-blue-700"
                          >
                            View details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Campaign Reminders */}
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
            <div className="border-b border-slate-200 px-6 py-4">
              <h3 className="text-sm font-semibold text-slate-900">Campaign Follow-Up Reminders</h3>
            </div>
            {!reminders || reminders.items.length === 0 ? (
              <div className="p-6 text-xs text-slate-500">
                No follow-up reminders linked to emails in this campaign.
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {reminders.items.map((rem) => (
                  <li
                    key={rem.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-6 py-3.5 text-xs"
                  >
                    <div>
                      <div className="font-medium text-slate-900">
                        {rem.trackedEmail?.recipientReference ?? 'Tracked email'} —{' '}
                        {rem.note || 'Follow up'}
                      </div>
                      <div className="text-slate-500">Due: {formatDateTime(rem.dueAt)}</div>
                    </div>
                    <ReminderStatusBadge status={rem.status} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
