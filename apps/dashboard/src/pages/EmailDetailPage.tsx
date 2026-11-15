import { type FormEvent, useCallback, useEffect, useState } from 'react';
import type { Campaign, TrackedEmailDetail } from '@mailtrack/shared';
import { EmptyState } from '../components/EmptyState.js';
import { ErrorState } from '../components/ErrorState.js';
import { IconArrowLeft } from '../components/Icons.js';
import { TableSkeleton } from '../components/Skeleton.js';
import { ClassificationBadge, TrackingStatusBadge } from '../components/StatusBadge.js';
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
        // Non-blocking: campaign selector will only show current assignment if list fails
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
    <div className="space-y-6">
      <div>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-xs transition hover:bg-slate-50"
        >
          <IconArrowLeft className="h-3.5 w-3.5" />
          Back to Tracked Emails
        </button>
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
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {detail.subject || '(No subject)'}
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Recipient: <span className="font-medium">{detail.recipientReference}</span>
                </p>
              </div>
              <TrackingStatusBadge status={detail.status} />
            </div>

            <dl className="mt-6 grid grid-cols-1 gap-4 border-t border-slate-100 pt-5 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <dt className="text-xs font-medium text-slate-500">Created At</dt>
                <dd className="mt-1 text-slate-900">{formatDateTime(detail.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500">
                  Sent At (Trusted Confirmation)
                </dt>
                <dd className="mt-1 text-slate-900">{formatDateTime(detail.sentAt)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500">Expiration Timestamp</dt>
                <dd className="mt-1 text-slate-900">{formatDateTime(detail.expiresAt)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500">First Recorded Event</dt>
                <dd className="mt-1 text-slate-900">{formatDateTime(detail.firstRecordedAt)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500">Latest Recorded Event</dt>
                <dd className="mt-1 text-slate-900">
                  {detail.events.length > 0
                    ? formatDateTime(detail.events[detail.events.length - 1]!.occurredAt)
                    : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500">Total Recorded Pixel Events</dt>
                <dd className="mt-1 font-semibold text-slate-900 tabular-nums">
                  {detail.events.length}
                </dd>
              </div>
            </dl>
          </section>

          <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
              <h3 className="text-sm font-semibold text-slate-900">Campaign Assignment</h3>
              <p className="mt-0.5 text-xs text-slate-500">
                Group this email into an outreach campaign for combined analytics and exports.
              </p>
              <div className="mt-3">
                <label htmlFor="email-campaign-select" className="sr-only">
                  Campaign
                </label>
                <select
                  id="email-campaign-select"
                  value={detail.campaignId ?? ''}
                  disabled={assigningCampaign}
                  onChange={(e) => void handleAssignCampaign(e.target.value)}
                  className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none disabled:opacity-50"
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
            </div>

            <form
              onSubmit={(e) => void handleCreateReminder(e)}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs"
            >
              <h3 className="text-sm font-semibold text-slate-900">Schedule Follow-up Reminder</h3>
              <p className="mt-0.5 text-xs text-slate-500">
                Set a UTC-normalized due date to follow up on this tracked email.
              </p>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="reminder-due-at"
                    className="block text-xs font-medium text-slate-600"
                  >
                    Due date &amp; time
                  </label>
                  <input
                    id="reminder-due-at"
                    type="datetime-local"
                    required
                    value={dueAt}
                    onChange={(e) => setDueAt(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                  />
                </div>
                <div>
                  <label
                    htmlFor="reminder-note"
                    className="block text-xs font-medium text-slate-600"
                  >
                    Note (optional)
                  </label>
                  <input
                    id="reminder-note"
                    type="text"
                    maxLength={300}
                    placeholder="e.g. Send second touchpoint"
                    value={reminderNote}
                    onChange={(e) => setReminderNote(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                  />
                </div>
              </div>
              <div className="mt-3 flex justify-end">
                <button
                  type="submit"
                  disabled={creatingReminder || !dueAt}
                  className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white shadow-xs transition hover:bg-slate-800 disabled:opacity-50"
                >
                  {creatingReminder ? 'Scheduling...' : 'Schedule Reminder'}
                </button>
              </div>
            </form>
          </section>

          <div
            role="note"
            className="rounded-xl border border-indigo-200 bg-indigo-50/70 px-4 py-3 text-xs text-indigo-950"
          >
            <strong>Classification Disclaimer:</strong> Event classifications (<code>RECORDED</code>
            , <code>LIKELY_PROXY</code>, <code>SUSPECTED_SCANNER</code>) describe HTTP request
            characteristics only and{' '}
            <strong>do not establish whether a human read the email</strong>. Raw tracking tokens
            and raw IP addresses are never exposed.
          </div>

          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
            <div className="border-b border-slate-200 px-6 py-4">
              <h3 className="text-sm font-semibold text-slate-900">Event History</h3>
              <p className="mt-0.5 text-xs text-slate-500">
                Chronological pixel request events recorded for this email.
              </p>
            </div>

            {detail.events.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  title="No recorded events yet"
                  description="No pixel requests have been recorded for this tracked email."
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-semibold tracking-wide text-slate-600 uppercase">
                    <tr>
                      <th scope="col" className="px-6 py-3">
                        Occurred At
                      </th>
                      <th scope="col" className="px-6 py-3">
                        Event Type
                      </th>
                      <th scope="col" className="px-6 py-3">
                        Classification
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {detail.events.map((ev) => (
                      <tr key={ev.id}>
                        <td className="px-6 py-3.5 text-xs whitespace-nowrap text-slate-700">
                          {formatDateTime(ev.occurredAt)}
                        </td>
                        <td className="px-6 py-3.5 font-mono text-xs text-slate-600">
                          {ev.eventType}
                        </td>
                        <td className="px-6 py-3.5 whitespace-nowrap">
                          <ClassificationBadge classification={ev.classification} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
