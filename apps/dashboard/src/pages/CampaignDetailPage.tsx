import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type {
  CampaignAnalyticsResponse,
  PaginatedRemindersResponse,
  PaginatedTrackedEmailsResponse,
} from '@mailtrack/shared';
import { ClassificationDistributionChart, DailyActivityChart } from '../components/Charts.js';
import { EmptyState } from '../components/EmptyState.js';
import { ErrorState } from '../components/ErrorState.js';
import { IconArrowLeft, IconDownload } from '../components/Icons.js';
import { ChartSkeleton, TableSkeleton } from '../components/Skeleton.js';
import {
  CampaignStatusBadge,
  EngagementSignal,
  ReminderStatusBadge,
  TrackingStatusBadge,
} from '../components/StatusBadge.js';
import { Button } from '../components/ui/Button.js';
import { INPUT_CLASS, SectionHeader, SELECT_CLASS, SurfaceCard } from '../components/ui/Card.js';
import { ModalDialog } from '../components/ui/Dialog.js';
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
  const [exporting, setExporting] = useState(false);

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
    if (!editName.trim()) return;
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
    } catch (err: unknown) {
      onNotify('error', err instanceof ApiError ? err.message : 'Unable to update campaign.');
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
    } catch (err: unknown) {
      onNotify('error', err instanceof ApiError ? err.message : 'Unable to archive campaign.');
    } finally {
      setArchiving(false);
    }
  }

  async function handleExportCsv() {
    setExporting(true);
    try {
      await apiClient.downloadCsv(
        '/api/exports/emails',
        { campaignId },
        `campaign-${campaignId}-emails.csv`,
      );
      onNotify('success', 'Exported campaign emails CSV.');
    } catch (err: unknown) {
      onNotify('error', err instanceof ApiError ? err.message : 'Unable to export CSV.');
    } finally {
      setExporting(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-5">
        <ChartSkeleton />
        <TableSkeleton rows={4} />
      </div>
    );
  }

  if (error || !analytics) {
    return (
      <div className="space-y-4">
        <Button variant="secondary" size="sm" onClick={onBack}>
          <IconArrowLeft className="h-3.5 w-3.5" />
          Back to Campaigns
        </Button>
        <ErrorState
          title="Unable to load campaign"
          message={error ?? 'Campaign not found.'}
          onRetry={() => loadAll()}
        />
      </div>
    );
  }

  const { campaign, statusCounts, classificationCounts, dailyActivity } = analytics;
  const emailsWithActivity = emails
    ? emails.items.filter((e) => Boolean(e.firstRecordedAt) || (e.eventCount ?? 0) > 0).length
    : 0;
  const openRate =
    statusCounts.totalEmails > 0
      ? Math.round((emailsWithActivity / statusCounts.totalEmails) * 100)
      : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="secondary" size="sm" onClick={onBack}>
          <IconArrowLeft className="h-3.5 w-3.5" />
          Back to Campaigns
        </Button>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" loading={exporting} onClick={handleExportCsv}>
            <IconDownload className="h-3.5 w-3.5" />
            Export CSV
          </Button>
          {campaign.status !== 'ARCHIVED' ? (
            <>
              <Button variant="secondary" size="sm" onClick={() => setEditing((v) => !v)}>
                {editing ? 'Cancel edit' : 'Edit'}
              </Button>
              <Button variant="danger" size="sm" onClick={() => setConfirmArchive(true)}>
                Archive
              </Button>
            </>
          ) : null}
        </div>
      </div>

      {/* Campaign Header */}
      <SurfaceCard className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-[18px] font-semibold text-[var(--text-primary)]">
                {campaign.name}
              </h2>
              <CampaignStatusBadge status={campaign.status} />
            </div>
            {campaign.description ? (
              <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
                {campaign.description}
              </p>
            ) : null}
            <p className="mt-2 text-[12px] text-[var(--text-muted)] tabular-nums">
              Created {formatDateTime(campaign.createdAt)} · Pixel counts indicate image fetches,
              not guaranteed unique human opens.
            </p>
          </div>
        </div>

        {editing ? (
          <form
            onSubmit={handleSaveEdit}
            className="mt-4 grid grid-cols-1 gap-3 border-t border-[var(--border-default)] pt-4 sm:grid-cols-3"
          >
            <input
              type="text"
              required
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Campaign name"
              className={INPUT_CLASS}
            />
            <input
              type="text"
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              placeholder="Description"
              className={INPUT_CLASS}
            />
            <div className="flex items-center gap-2">
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value as 'ACTIVE' | 'COMPLETED')}
                className={`${SELECT_CLASS} flex-1`}
              >
                <option value="ACTIVE">Active</option>
                <option value="COMPLETED">Completed</option>
              </select>
              <Button type="submit" variant="primary" size="sm" loading={saving}>
                Save
              </Button>
            </div>
          </form>
        ) : null}
      </SurfaceCard>

      {/* Metrics */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
          <div className="text-[12px] text-[var(--text-secondary)]">Campaign emails</div>
          <div className="mt-1 text-[24px] font-semibold text-[var(--text-primary)] tabular-nums">
            {statusCounts.totalEmails}
          </div>
        </div>
        <div className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
          <div className="text-[12px] text-[var(--text-secondary)]">Pixel requests (30d)</div>
          <div className="mt-1 text-[24px] font-semibold text-[var(--text-primary)] tabular-nums">
            {classificationCounts.totalEvents}
          </div>
        </div>
        <div className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
          <div className="text-[12px] text-[var(--text-secondary)]">Estimated open rate</div>
          <div className="mt-1 text-[24px] font-semibold text-[var(--text-primary)] tabular-nums">
            {openRate !== null ? `${openRate}%` : '—'}
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <DailyActivityChart data={dailyActivity} title="Campaign pixel activity (30d)" />
        <ClassificationDistributionChart counts={classificationCounts} />
      </div>

      {/* Member Emails */}
      <SurfaceCard className="overflow-hidden">
        <SectionHeader
          title="Member emails"
          description="Click any email to inspect its pixel timeline or set a reminder."
        />
        {!emails || emails.items.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="No emails in this campaign"
              description="Assign tracked emails to this campaign from Tracked Emails or the email detail drawer."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[580px] border-collapse text-left text-[13px]">
              <thead className="border-b border-[var(--border-default)] bg-[var(--bg-subtle)] text-[12px] font-medium text-[var(--text-secondary)]">
                <tr>
                  <th className="px-4 py-2.5">Recipient</th>
                  <th className="px-4 py-2.5">Subject</th>
                  <th className="px-4 py-2.5">Engagement</th>
                  <th className="px-4 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-default)]">
                {emails.items.map((email) => (
                  <tr
                    key={email.id}
                    onClick={() => onSelectEmail(email.id)}
                    className="cursor-pointer transition-colors duration-150 hover:bg-[var(--bg-subtle)]"
                  >
                    <td className="px-4 py-2.5 font-medium text-[var(--text-primary)]">
                      {email.recipientReference}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={
                          email.subject
                            ? 'text-[var(--text-primary)]'
                            : 'italic text-[var(--text-muted)]'
                        }
                      >
                        {email.subject || 'No subject'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <EngagementSignal
                        firstRecordedAt={email.firstRecordedAt}
                        eventCount={email.eventCount}
                      />
                    </td>
                    <td className="px-4 py-2.5">
                      <TrackingStatusBadge status={email.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SurfaceCard>

      {/* Campaign Reminders */}
      {reminders && reminders.items.length > 0 ? (
        <SurfaceCard className="overflow-hidden">
          <SectionHeader title="Campaign reminders" />
          <ul className="divide-y divide-[var(--border-default)]">
            {reminders.items.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-3 px-4 py-3 text-[13px]"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium text-[var(--text-primary)]">
                    {r.note || r.trackedEmail?.subject || 'Follow-up reminder'}
                  </div>
                  <div className="text-[12px] text-[var(--text-muted)] tabular-nums">
                    Due {formatDateTime(r.dueAt)}
                  </div>
                </div>
                <ReminderStatusBadge status={r.status} />
              </li>
            ))}
          </ul>
        </SurfaceCard>
      ) : null}

      {/* Archive Confirmation Modal */}
      <ModalDialog
        open={confirmArchive}
        onClose={() => setConfirmArchive(false)}
        title="Archive campaign?"
        description="Archived campaigns are read-only and hidden from active campaign lists. Tracked emails remain intact."
        maxWidthClass="max-w-md"
      >
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirmArchive(false)}>
            Cancel
          </Button>
          <Button variant="danger" loading={archiving} onClick={handleArchive}>
            Confirm Archive
          </Button>
        </div>
      </ModalDialog>
    </div>
  );
}
