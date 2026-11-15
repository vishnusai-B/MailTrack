import { type FormEvent, useCallback, useEffect, useState } from 'react';
import type { Campaign, TrackedEmailDetail } from '@mailtrack/shared';
import { ApiError, apiClient } from '../lib/api.js';
import { formatDateTime } from '../lib/format.js';
import { ErrorState } from './ErrorState.js';
import { IconCalendar, IconChevronDown, IconClock, IconCopy, IconFolder, IconX } from './Icons.js';
import { ClassificationBadge, EngagementSignal, TrackingStatusBadge } from './StatusBadge.js';
import { Button } from './ui/Button.js';
import { INPUT_CLASS, SELECT_CLASS } from './ui/Card.js';

interface EmailDetailDrawerProps {
  emailId: string | null;
  onClose: () => void;
  onNotify: (tone: 'info' | 'success' | 'error', text: string) => void;
  onUpdated?: () => void;
}

export function EmailDetailDrawer({
  emailId,
  onClose,
  onNotify,
  onUpdated,
}: EmailDetailDrawerProps) {
  const [detail, setDetail] = useState<TrackedEmailDetail | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [assigningCampaign, setAssigningCampaign] = useState(false);
  const [dueAt, setDueAt] = useState('');
  const [reminderNote, setReminderNote] = useState('');
  const [reminderError, setReminderError] = useState<string | null>(null);
  const [creatingReminder, setCreatingReminder] = useState(false);
  const [showClassifierHelp, setShowClassifierHelp] = useState(false);

  const loadDetail = useCallback((id: string, signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    apiClient
      .getTrackedEmailDetail(id, signal)
      .then((res) => setDetail(res))
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setError(err instanceof ApiError ? err.message : 'Unable to load email details.');
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!emailId) {
      setDetail(null);
      setError(null);
      return;
    }
    const controller = new AbortController();
    loadDetail(emailId, controller.signal);
    apiClient
      .listCampaigns({ limit: 50 }, controller.signal)
      .then((res) => setCampaigns(res.items))
      .catch(() => {
        // Non-blocking: campaign selector keeps current assignment
      });
    return () => controller.abort();
  }, [emailId, loadDetail]);

  useEffect(() => {
    if (!emailId) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [emailId, onClose]);

  if (!emailId) return null;

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
      onNotify(
        'success',
        updated.campaignName ? `Added to "${updated.campaignName}".` : 'Removed from campaign.',
      );
      onUpdated?.();
    } catch (err: unknown) {
      onNotify(
        'error',
        err instanceof ApiError ? err.message : 'Unable to update campaign assignment.',
      );
    } finally {
      setAssigningCampaign(false);
    }
  }

  async function handleCreateReminder(e: FormEvent) {
    e.preventDefault();
    if (!detail) return;
    if (!dueAt) {
      setReminderError('Choose a due date and time.');
      return;
    }
    setReminderError(null);
    setCreatingReminder(true);
    try {
      await apiClient.createReminder({
        trackedEmailId: detail.id,
        dueAt: new Date(dueAt).toISOString(),
        note: reminderNote.trim() || undefined,
      });
      setDueAt('');
      setReminderNote('');
      onNotify('success', 'Follow-up reminder scheduled.');
      onUpdated?.();
    } catch (err: unknown) {
      onNotify(
        'error',
        err instanceof ApiError ? err.message : 'Unable to create follow-up reminder.',
      );
    } finally {
      setCreatingReminder(false);
    }
  }

  async function handleCopyTrackingId() {
    if (!detail) return;
    try {
      await navigator.clipboard.writeText(detail.id);
      onNotify('success', 'Tracking ID copied.');
    } catch {
      onNotify('info', `Tracking ID: ${detail.id}`);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[var(--z-drawer)] flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-labelledby="email-drawer-title"
    >
      <div
        className="fixed inset-0 bg-black/40 transition-opacity duration-150"
        onClick={onClose}
        aria-hidden="true"
      />

      <aside className="relative z-10 flex h-full w-full max-w-xl flex-col border-l border-[var(--border-default)] bg-[var(--bg-surface)] shadow-[var(--shadow-md)] transition-transform duration-150 ease-out">
        {/* Drawer Header */}
        <div className="flex items-start justify-between gap-3 border-b border-[var(--border-default)] px-5 py-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              {detail ? <TrackingStatusBadge status={detail.status} /> : null}
              {detail ? (
                <EngagementSignal
                  firstRecordedAt={detail.firstRecordedAt}
                  eventCount={detail.events.length}
                />
              ) : null}
            </div>
            <h2
              id="email-drawer-title"
              className={`mt-2 text-[16px] font-semibold ${
                detail?.subject ? 'text-[var(--text-primary)]' : 'italic text-[var(--text-muted)]'
              }`}
            >
              {loading ? 'Loading email...' : detail?.subject || 'No subject'}
            </h2>
            {detail ? (
              <p className="mt-1 truncate text-[13px] text-[var(--text-secondary)]">
                To:{' '}
                <span className="font-medium text-[var(--text-primary)]">
                  {detail.recipientReference}
                </span>{' '}
                ·{' '}
                <span className="tabular-nums">
                  {formatDateTime(detail.sentAt ?? detail.createdAt)}
                </span>
              </p>
            ) : null}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close email details"
            className="rounded-[var(--radius-sm)] p-1.5 text-[var(--text-muted)] transition-colors duration-150 hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
          >
            <IconX className="h-4 w-4" />
          </button>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          {loading ? (
            <div className="space-y-3" aria-busy="true">
              <div className="h-20 animate-pulse rounded-[var(--radius-md)] bg-[var(--bg-subtle)]" />
              <div className="h-36 animate-pulse rounded-[var(--radius-md)] bg-[var(--bg-subtle)]" />
            </div>
          ) : error || !detail ? (
            <ErrorState
              title="Unable to load email details"
              message={error ?? 'Tracked email not found.'}
              onRetry={() => loadDetail(emailId)}
            />
          ) : (
            <>
              {/* Quick Actions Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-subtle)] px-3.5 py-2.5">
                <div className="flex min-w-0 items-center gap-2 text-[12px] text-[var(--text-muted)]">
                  <span>Tracking ID</span>
                  <code className="truncate font-mono text-[11px] text-[var(--text-primary)]">
                    {detail.id}
                  </code>
                </div>
                <Button size="sm" variant="secondary" onClick={handleCopyTrackingId}>
                  <IconCopy className="h-3.5 w-3.5" />
                  Copy tracking ID
                </Button>
              </div>

              {/* Campaign Assignment */}
              <div className="rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
                <div className="flex items-center gap-2 text-[13px] font-semibold text-[var(--text-primary)]">
                  <IconFolder className="h-4 w-4 text-[var(--text-muted)]" />
                  Campaign
                </div>
                <div className="mt-2.5">
                  <label htmlFor="drawer-campaign-select" className="sr-only">
                    Assign to campaign
                  </label>
                  <select
                    id="drawer-campaign-select"
                    value={detail.campaignId ?? ''}
                    disabled={assigningCampaign}
                    onChange={(e) => void handleAssignCampaign(e.target.value)}
                    className={`${SELECT_CLASS} w-full`}
                  >
                    <option value="">No campaign</option>
                    {campaigns.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Follow-up Reminder */}
              <div className="rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
                <div className="flex items-center gap-2 text-[13px] font-semibold text-[var(--text-primary)]">
                  <IconCalendar className="h-4 w-4 text-[var(--text-muted)]" />
                  Set follow-up reminder
                </div>
                <form onSubmit={handleCreateReminder} className="mt-3 space-y-3" noValidate>
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor="drawer-reminder-due"
                        className="block text-[12px] font-medium text-[var(--text-secondary)]"
                      >
                        Due date & time
                      </label>
                      <input
                        id="drawer-reminder-due"
                        type="datetime-local"
                        value={dueAt}
                        onChange={(e) => {
                          setDueAt(e.target.value);
                          if (reminderError) setReminderError(null);
                        }}
                        className={`${INPUT_CLASS} mt-1`}
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="drawer-reminder-note"
                        className="block text-[12px] font-medium text-[var(--text-secondary)]"
                      >
                        Note (optional)
                      </label>
                      <input
                        id="drawer-reminder-note"
                        type="text"
                        value={reminderNote}
                        onChange={(e) => setReminderNote(e.target.value)}
                        placeholder="Send pricing follow-up"
                        maxLength={500}
                        className={`${INPUT_CLASS} mt-1`}
                      />
                    </div>
                  </div>
                  {reminderError ? (
                    <p className="text-[12px] text-[var(--status-danger-text)]">{reminderError}</p>
                  ) : null}
                  <div className="flex justify-end">
                    <Button type="submit" size="sm" variant="primary" loading={creatingReminder}>
                      <IconClock className="h-3.5 w-3.5" />
                      {creatingReminder ? 'Scheduling...' : 'Set reminder'}
                    </Button>
                  </div>
                </form>
              </div>

              {/* Pixel Event Timeline */}
              <div className="rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)]">
                <div className="flex items-center justify-between border-b border-[var(--border-default)] px-4 py-3">
                  <div>
                    <h3 className="text-[13px] font-semibold text-[var(--text-primary)]">
                      Pixel activity timeline
                    </h3>
                    <p className="text-[12px] text-[var(--text-muted)] tabular-nums">
                      {detail.events.length} recorded{' '}
                      {detail.events.length === 1 ? 'request' : 'requests'}
                    </p>
                  </div>
                </div>

                {detail.events.length === 0 ? (
                  <div className="px-4 py-6 text-center text-[12px] text-[var(--text-muted)]">
                    No pixel requests recorded for this email yet.
                  </div>
                ) : (
                  <ol className="divide-y divide-[var(--border-default)]">
                    {detail.events.map((ev) => (
                      <li
                        key={ev.id}
                        className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
                      >
                        <ClassificationBadge classification={ev.classification} />
                        <div className="text-right">
                          <div className="font-mono text-[12px] text-[var(--text-primary)] tabular-nums">
                            {formatDateTime(ev.occurredAt)}
                          </div>
                          <div className="font-mono text-[11px] text-[var(--text-muted)]">
                            {ev.id.slice(0, 12)}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </div>

              {/* How we classify opens explainer */}
              <div className="rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-subtle)]">
                <button
                  type="button"
                  onClick={() => setShowClassifierHelp((v) => !v)}
                  aria-expanded={showClassifierHelp}
                  className="flex w-full items-center justify-between px-4 py-2.5 text-left text-[12px] font-medium text-[var(--text-primary)]"
                >
                  <span>How we classify opens</span>
                  <IconChevronDown
                    className={`h-3.5 w-3.5 text-[var(--text-muted)] transition-transform duration-150 ${
                      showClassifierHelp ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {showClassifierHelp ? (
                  <div className="space-y-2 border-t border-[var(--border-default)] px-4 py-3 text-[12px] leading-relaxed text-[var(--text-secondary)]">
                    <p>
                      A tracking pixel fires whenever an email client or scanner fetches images, so
                      a single pixel request does not guarantee a human read the message.
                    </p>
                    <ul className="space-y-1 text-[12px]">
                      <li>
                        <strong className="font-medium text-[var(--text-primary)]">
                          Opened (likely human):
                        </strong>{' '}
                        Request without known proxy or scanner signatures.
                      </li>
                      <li>
                        <strong className="font-medium text-[var(--text-primary)]">
                          Email client prefetch:
                        </strong>{' '}
                        Image proxy or mail-server caching fetch (for example Gmail image proxy).
                      </li>
                      <li>
                        <strong className="font-medium text-[var(--text-primary)]">
                          Security scanner:
                        </strong>{' '}
                        Automated link or attachment inspection bot.
                      </li>
                    </ul>
                  </div>
                ) : null}
              </div>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
