import { type FormEvent, useCallback, useEffect, useState } from 'react';
import type { Campaign, TrackedEmailDetail } from '@mailtrack/shared';
import { EmptyState } from '../components/EmptyState.js';
import { ErrorState } from '../components/ErrorState.js';
import { IconArrowLeft, IconCalendar, IconClock, IconFolder } from '../components/Icons.js';
import { TableSkeleton } from '../components/Skeleton.js';
import {
  ClassificationBadge,
  OpenStatusBadge,
  TrackingStatusBadge,
} from '../components/StatusBadge.js';
import { Button } from '../components/ui/Button.js';
import { INPUT_CLASS, SectionHeader, SELECT_CLASS, SurfaceCard } from '../components/ui/Card.js';
import { ApiError, apiClient } from '../lib/api.js';
import { formatDateTime } from '../lib/format.js';

interface EmailDetailPageProps {
  emailId: string;
  onBack: () => void;
  onNotify?: (tone: 'success' | 'error' | 'info', text: string) => void;
}

export function EmailDetailPage({ emailId, onBack, onNotify }: EmailDetailPageProps) {
  const [detail, setDetail] = useState<TrackedEmailDetail | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [assigningCampaign, setAssigningCampaign] = useState(false);
  const [dueAt, setDueAt] = useState('');
  const [reminderNote, setReminderNote] = useState('');
  const [creatingReminder, setCreatingReminder] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDetail = useCallback(
    (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      apiClient
        .getTrackedEmailDetail(emailId, signal)
        .then((res) => setDetail(res))
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === 'AbortError') return;
          setError(err instanceof ApiError ? err.message : 'Unable to load email details.');
        })
        .finally(() => setLoading(false));
    },
    [emailId],
  );

  useEffect(() => {
    const controller = new AbortController();
    loadDetail(controller.signal);
    apiClient
      .listCampaigns({ limit: 50 }, controller.signal)
      .then((res) => setCampaigns(res.items))
      .catch(() => {
        // Non-blocking: campaign selector keeps current assignment if list fails
      });
    return () => controller.abort();
  }, [loadDetail]);

  async function handleAssignCampaign(nextCampaignId: string) {
    if (!detail) return;
    setAssigningCampaign(true);
    try {
      const updated = await apiClient.assignEmailCampaign(detail.id, nextCampaignId || null);
      setDetail((prev) =>
        prev
          ? {
              ...prev,
              campaignId: updated.campaignId ?? null,
              campaignName: updated.campaignName ?? null,
            }
          : prev,
      );
      onNotify?.(
        'success',
        updated.campaignName ? `Assigned to "${updated.campaignName}".` : 'Removed from campaign.',
      );
    } catch (err: unknown) {
      onNotify?.(
        'error',
        err instanceof ApiError ? err.message : 'Unable to update campaign assignment.',
      );
    } finally {
      setAssigningCampaign(false);
    }
  }

  async function handleCreateReminder(e: FormEvent) {
    e.preventDefault();
    if (!detail || !dueAt) return;
    setCreatingReminder(true);
    try {
      await apiClient.createReminder({
        trackedEmailId: detail.id,
        dueAt: new Date(dueAt).toISOString(),
        note: reminderNote.trim() || undefined,
      });
      setDueAt('');
      setReminderNote('');
      onNotify?.('success', 'Follow-up reminder scheduled.');
    } catch (err: unknown) {
      onNotify?.(
        'error',
        err instanceof ApiError ? err.message : 'Unable to create follow-up reminder.',
      );
    } finally {
      setCreatingReminder(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <Button variant="secondary" onClick={onBack}>
          <IconArrowLeft className="h-3.5 w-3.5" />
          Back to Tracked Emails
        </Button>
      </div>

      {loading ? (
        <TableSkeleton rows={5} cols={3} />
      ) : error || !detail ? (
        <ErrorState
          title="Unable to load email details"
          message={error ?? 'Tracked email record not found.'}
          onRetry={() => loadDetail()}
        />
      ) : (
        <>
          <SurfaceCard className="p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-semibold tracking-tight text-neutral-950">
                  {detail.subject || '(No subject)'}
                </h2>
                <p className="mt-1 text-xs text-neutral-500">
                  Recipient:{' '}
                  <span className="font-medium text-neutral-900">{detail.recipientReference}</span>
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <OpenStatusBadge
                  firstRecordedAt={detail.firstRecordedAt}
                  eventCount={detail.events.length}
                />
                <TrackingStatusBadge status={detail.status} />
              </div>
            </div>

            <dl className="mt-6 grid grid-cols-1 gap-3 border-t border-neutral-100 pt-5 sm:grid-cols-2 lg:grid-cols-3">
              {[
                {
                  label: 'Created At',
                  value: formatDateTime(detail.createdAt),
                  icon: IconCalendar,
                },
                {
                  label: 'Sent At (Trusted Confirmation)',
                  value: formatDateTime(detail.sentAt),
                  icon: IconClock,
                },
                {
                  label: 'Expiration Timestamp',
                  value: formatDateTime(detail.expiresAt),
                  icon: IconClock,
                },
                {
                  label: 'First Recorded Event',
                  value: formatDateTime(detail.firstRecordedAt),
                  icon: IconClock,
                },
                {
                  label: 'Latest Recorded Event',
                  value:
                    detail.events.length > 0
                      ? formatDateTime(detail.events[detail.events.length - 1]!.occurredAt)
                      : '—',
                  icon: IconClock,
                },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.label}
                    className="rounded-lg border border-neutral-100 bg-neutral-50/70 px-3.5 py-2.5"
                  >
                    <dt className="flex items-center gap-1.5 text-[11px] font-medium text-neutral-500">
                      <Icon className="h-3 w-3 text-neutral-400" />
                      {item.label}
                    </dt>
                    <dd className="mt-1 text-xs font-medium text-neutral-900 tabular-nums">
                      {item.value}
                    </dd>
                  </div>
                );
              })}
              <div className="rounded-lg border border-neutral-100 bg-neutral-50/70 px-3.5 py-2.5">
                <dt className="text-[11px] font-medium text-neutral-500">
                  Total Recorded Pixel Events
                </dt>
                <dd className="mt-1 text-sm font-semibold text-neutral-950 tabular-nums">
                  {detail.events.length}
                </dd>
              </div>
            </dl>
          </SurfaceCard>

          <section className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <SurfaceCard className="p-5">
              <div className="flex items-center gap-2">
                <IconFolder className="h-4 w-4 text-neutral-400" />
                <h3 className="text-sm font-semibold text-neutral-900">Campaign</h3>
              </div>
              <p className="mt-1 text-xs text-neutral-500">
                Group this email under a campaign for combined metrics and exports.
              </p>
              <div className="mt-3.5">
                <label htmlFor="email-campaign-select" className="sr-only">
                  Campaign
                </label>
                <select
                  id="email-campaign-select"
                  value={detail.campaignId ?? ''}
                  disabled={assigningCampaign}
                  onChange={(e) => void handleAssignCampaign(e.target.value)}
                  className={SELECT_CLASS}
                >
                  <option value="">No campaign</option>
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.status === 'ARCHIVED' ? '(Archived)' : ''}
                    </option>
                  ))}
                  {detail.campaignId &&
                  !campaigns.some((c) => c.id === detail.campaignId) &&
                  detail.campaignName ? (
                    <option value={detail.campaignId}>{detail.campaignName}</option>
                  ) : null}
                </select>
              </div>
            </SurfaceCard>

            <SurfaceCard className="p-5">
              <form onSubmit={(e) => void handleCreateReminder(e)}>
                <div className="flex items-center gap-2">
                  <IconClock className="h-4 w-4 text-neutral-400" />
                  <h3 className="text-sm font-semibold text-neutral-900">Follow-up Reminder</h3>
                </div>
                <p className="mt-1 text-xs text-neutral-500">
                  Set a due date to follow up on this thread.
                </p>
                <div className="mt-3.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="reminder-due-at"
                      className="block text-xs font-medium text-neutral-600"
                    >
                      Due date &amp; time
                    </label>
                    <input
                      id="reminder-due-at"
                      type="datetime-local"
                      required
                      value={dueAt}
                      onChange={(e) => setDueAt(e.target.value)}
                      className={`${INPUT_CLASS} mt-1 text-xs`}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="reminder-note"
                      className="block text-xs font-medium text-neutral-600"
                    >
                      Note (optional)
                    </label>
                    <input
                      id="reminder-note"
                      type="text"
                      maxLength={300}
                      placeholder="Send second touchpoint"
                      value={reminderNote}
                      onChange={(e) => setReminderNote(e.target.value)}
                      className={`${INPUT_CLASS} mt-1 text-xs`}
                    />
                  </div>
                </div>
                <div className="mt-3.5 flex justify-end">
                  <Button type="submit" variant="primary" disabled={creatingReminder || !dueAt}>
                    {creatingReminder ? 'Scheduling...' : 'Schedule Reminder'}
                  </Button>
                </div>
              </form>
            </SurfaceCard>
          </section>

          <div
            role="note"
            className="rounded-xl border border-indigo-200/80 bg-indigo-50/50 px-4 py-3 text-xs text-indigo-950"
          >
            <strong>Classification note:</strong> Classifications (
            <code className="font-mono">RECORDED</code>,{' '}
            <code className="font-mono">LIKELY_PROXY</code>,{' '}
            <code className="font-mono">SUSPECTED_SCANNER</code>) reflect request metadata only and{' '}
            <strong>do not establish whether a human read the email</strong>. Raw tracking tokens
            and IP addresses are never exposed.
          </div>

          <SurfaceCard className="overflow-hidden">
            <SectionHeader
              title="Event History"
              description="Chronological pixel requests logged for this email."
            />

            {detail.events.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  title="No recorded events yet"
                  description="No pixel requests have been recorded for this tracked email."
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-neutral-200/80 text-left text-sm">
                  <thead className="bg-neutral-50/80 text-[11px] font-semibold tracking-wide text-neutral-500 uppercase">
                    <tr>
                      <th scope="col" className="px-5 py-3">
                        Occurred At
                      </th>
                      <th scope="col" className="px-5 py-3">
                        Event Type
                      </th>
                      <th scope="col" className="px-5 py-3">
                        Classification
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 bg-white">
                    {detail.events.map((ev) => (
                      <tr key={ev.id} className="transition-colors hover:bg-neutral-50/70">
                        <td className="px-5 py-3 text-xs whitespace-nowrap text-neutral-700 tabular-nums">
                          {formatDateTime(ev.occurredAt)}
                        </td>
                        <td className="px-5 py-3 font-mono text-xs text-neutral-600">
                          {ev.eventType}
                        </td>
                        <td className="px-5 py-3 whitespace-nowrap">
                          <ClassificationBadge classification={ev.classification} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SurfaceCard>
        </>
      )}
    </div>
  );
}
