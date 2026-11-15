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
import { IconArrowLeft, IconArrowUpRight, IconDownload } from '../components/Icons.js';
import { ChartSkeleton, TableSkeleton } from '../components/Skeleton.js';
import {
  CampaignStatusBadge,
  OpenStatusBadge,
  ReminderStatusBadge,
  TrackingStatusBadge,
} from '../components/StatusBadge.js';
import { Button } from '../components/ui/Button.js';
import { INPUT_CLASS, SectionHeader, SELECT_CLASS, SurfaceCard } from '../components/ui/Card.js';
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
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="secondary" onClick={onBack}>
          <IconArrowLeft className="h-3.5 w-3.5" />
          Back to Campaigns
        </Button>

        {analytics ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={() => void handleExportAnalytics()}>
              <IconDownload className="h-3.5 w-3.5" />
              Export Analytics CSV
            </Button>
            {analytics.campaign.status !== 'ARCHIVED' ? (
              <>
                <Button variant="secondary" onClick={() => setEditing((v) => !v)}>
                  {editing ? 'Cancel Edit' : 'Edit'}
                </Button>
                <button
                  type="button"
                  onClick={() => setConfirmArchive(true)}
                  className="inline-flex h-8 items-center rounded-lg border border-rose-200 bg-rose-50 px-3 text-xs font-medium text-rose-700 transition hover:bg-rose-100"
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
          className="rounded-xl border border-rose-200 bg-rose-50/70 p-4 text-xs text-rose-950"
        >
          <div id="archive-dialog-title" className="font-semibold">
            Archive this campaign?
          </div>
          <p className="mt-1 text-rose-800">
            Archiving marks the campaign read-only. Existing tracked emails will be preserved.
          </p>
          <div className="mt-3 flex gap-2">
            <Button variant="danger" disabled={archiving} onClick={() => void handleArchive()}>
              {archiving ? 'Archiving...' : 'Confirm Archive'}
            </Button>
            <Button variant="secondary" onClick={() => setConfirmArchive(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className="space-y-5">
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
          <SurfaceCard className="p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-neutral-950">
                  {analytics.campaign.name}
                </h2>
                <p className="mt-1 text-xs text-neutral-600">
                  {analytics.campaign.description || 'No description provided.'}
                </p>
                <p className="mt-2 font-mono text-[11px] text-neutral-400">
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
                className="mt-5 grid grid-cols-1 gap-4 border-t border-neutral-100 pt-5 sm:grid-cols-3"
              >
                <div>
                  <label
                    htmlFor="edit-camp-name"
                    className="block text-xs font-medium text-neutral-700"
                  >
                    Name
                  </label>
                  <input
                    id="edit-camp-name"
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className={`${INPUT_CLASS} mt-1`}
                  />
                </div>
                <div>
                  <label
                    htmlFor="edit-camp-desc"
                    className="block text-xs font-medium text-neutral-700"
                  >
                    Description
                  </label>
                  <input
                    id="edit-camp-desc"
                    type="text"
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className={`${INPUT_CLASS} mt-1`}
                  />
                </div>
                <div>
                  <label
                    htmlFor="edit-camp-status"
                    className="block text-xs font-medium text-neutral-700"
                  >
                    Status
                  </label>
                  <select
                    id="edit-camp-status"
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as 'ACTIVE' | 'COMPLETED')}
                    className={`${SELECT_CLASS} mt-1`}
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="COMPLETED">COMPLETED</option>
                  </select>
                </div>
                <div className="flex justify-end sm:col-span-3">
                  <Button type="submit" variant="primary" disabled={saving}>
                    {saving ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </form>
            ) : null}
          </SurfaceCard>

          {/* Summary Strip */}
          <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-6">
            <div className="rounded-xl border border-neutral-200/80 bg-white p-4 shadow-2xs">
              <div className="text-[11px] font-medium text-neutral-500">Total Emails</div>
              <div className="mt-1.5 text-xl font-semibold text-neutral-950 tabular-nums">
                {analytics.statusCounts.totalEmails}
              </div>
            </div>
            <div className="rounded-xl border border-neutral-200/80 bg-white p-4 shadow-2xs">
              <div className="text-[11px] font-medium text-neutral-500">Pending / Dispatched</div>
              <div className="mt-1.5 text-xl font-semibold text-sky-700 tabular-nums">
                {analytics.statusCounts.PENDING + analytics.statusCounts.DISPATCHED}
              </div>
            </div>
            <div className="rounded-xl border border-neutral-200/80 bg-white p-4 shadow-2xs">
              <div className="text-[11px] font-medium text-neutral-500">Failed / Expired</div>
              <div className="mt-1.5 text-xl font-semibold text-rose-700 tabular-nums">
                {analytics.statusCounts.FAILED + analytics.statusCounts.EXPIRED}
              </div>
            </div>
            <div className="rounded-xl border border-neutral-200/80 bg-white p-4 shadow-2xs">
              <div className="text-[11px] font-medium text-neutral-500">Pixel Events (30d)</div>
              <div className="mt-1.5 text-xl font-semibold text-indigo-700 tabular-nums">
                {analytics.classificationCounts.totalEvents}
              </div>
              <div className="mt-0.5 text-[10px] text-neutral-400">Not unique opens</div>
            </div>
            <div className="rounded-xl border border-neutral-200/80 bg-white p-4 shadow-2xs">
              <div className="text-[11px] font-medium text-neutral-500">Upcoming Reminders</div>
              <div className="mt-1.5 text-xl font-semibold text-amber-700 tabular-nums">
                {analytics.reminderCounts.upcoming}
              </div>
            </div>
            <div className="rounded-xl border border-neutral-200/80 bg-white p-4 shadow-2xs">
              <div className="text-[11px] font-medium text-neutral-500">Completed Reminders</div>
              <div className="mt-1.5 text-xl font-semibold text-emerald-700 tabular-nums">
                {analytics.reminderCounts.completed}
              </div>
            </div>
          </div>

          <div
            role="note"
            className="rounded-xl border border-neutral-200/80 bg-white px-4 py-2.5 text-xs text-neutral-600 shadow-2xs"
          >
            Recorded pixel events may include image proxies, security scanners, or repeated fetches
            — they do not establish unique human opens.
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <DailyActivityChart data={analytics.dailyActivity} />
            <StatusDistributionChart counts={analytics.statusCounts} />
            <ClassificationDistributionChart counts={analytics.classificationCounts} />
            <SurfaceCard className="p-5">
              <h3 className="text-sm font-semibold tracking-tight text-neutral-900">
                Campaign Comparison
              </h3>
              <p className="mt-0.5 text-xs text-neutral-500">
                Tracked emails and pixel requests across recent campaigns.
              </p>
              {analytics.comparison.length === 0 ? (
                <p className="mt-6 text-xs text-neutral-500">No campaigns to compare.</p>
              ) : (
                <div className="mt-5 space-y-2.5">
                  {analytics.comparison.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between rounded-lg border border-neutral-100 bg-neutral-50/70 px-3.5 py-2.5 text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium text-neutral-900">{item.name}</div>
                        <div className="font-mono text-[10px] text-neutral-500">{item.status}</div>
                      </div>
                      <div className="text-right tabular-nums text-neutral-700">
                        <div className="font-medium">{item.totalEmails} emails</div>
                        <div className="text-[11px] text-neutral-500">
                          {item.totalEvents} pixel events
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SurfaceCard>
          </div>

          {/* Associated Emails */}
          <SurfaceCard className="overflow-hidden">
            <SectionHeader title="Associated Tracked Emails" />
            {!emails || emails.items.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  title="No emails in this campaign"
                  description="Assign tracked emails to this campaign from any Email Detail page."
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-neutral-200/80 text-left text-sm">
                  <thead className="bg-neutral-50/80 text-[11px] font-semibold tracking-wide text-neutral-500 uppercase">
                    <tr>
                      <th className="px-5 py-3">Recipient</th>
                      <th className="px-5 py-3">Subject</th>
                      <th className="px-5 py-3">Activity</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3">Created</th>
                      <th className="px-5 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 bg-white">
                    {emails.items.map((email) => (
                      <tr key={email.id} className="transition-colors hover:bg-neutral-50/80">
                        <td className="px-5 py-3 text-xs font-medium text-neutral-900">
                          {email.recipientReference}
                        </td>
                        <td className="px-5 py-3 text-xs text-neutral-600">
                          {email.subject || '(No subject)'}
                        </td>
                        <td className="px-5 py-3 whitespace-nowrap">
                          <OpenStatusBadge
                            firstRecordedAt={email.firstRecordedAt}
                            eventCount={email.eventCount}
                          />
                        </td>
                        <td className="px-5 py-3 whitespace-nowrap">
                          <TrackingStatusBadge status={email.status} />
                        </td>
                        <td className="px-5 py-3 text-xs whitespace-nowrap text-neutral-500 tabular-nums">
                          {formatDateTime(email.createdAt)}
                        </td>
                        <td className="px-5 py-3 text-right whitespace-nowrap">
                          <Button variant="secondary" onClick={() => onSelectEmail(email.id)}>
                            View details
                            <IconArrowUpRight className="h-3 w-3 text-neutral-400" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SurfaceCard>

          {/* Campaign Reminders */}
          <SurfaceCard className="overflow-hidden">
            <SectionHeader title="Campaign Follow-Up Reminders" />
            {!reminders || reminders.items.length === 0 ? (
              <div className="p-6 text-xs text-neutral-500">
                No follow-up reminders linked to emails in this campaign.
              </div>
            ) : (
              <ul className="divide-y divide-neutral-100">
                {reminders.items.map((rem) => (
                  <li
                    key={rem.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 text-xs"
                  >
                    <div>
                      <div className="font-medium text-neutral-900">
                        {rem.trackedEmail?.recipientReference ?? 'Tracked email'} —{' '}
                        {rem.note || 'Follow up'}
                      </div>
                      <div className="text-neutral-500 tabular-nums">
                        Due: {formatDateTime(rem.dueAt)}
                      </div>
                    </div>
                    <ReminderStatusBadge status={rem.status} />
                  </li>
                ))}
              </ul>
            )}
          </SurfaceCard>
        </>
      )}
    </div>
  );
}
