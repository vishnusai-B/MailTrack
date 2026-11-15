import { useCallback, useEffect, useState } from 'react';
import type { PaginatedRemindersResponse, ReminderFilter } from '@mailtrack/shared';
import { EmptyState } from '../components/EmptyState.js';
import { ErrorState } from '../components/ErrorState.js';
import { IconCheck, IconClock } from '../components/Icons.js';
import { TableSkeleton } from '../components/Skeleton.js';
import { ReminderStatusBadge } from '../components/StatusBadge.js';
import { Button } from '../components/ui/Button.js';
import { INPUT_CLASS, SurfaceCard } from '../components/ui/Card.js';
import { ModalDialog } from '../components/ui/Dialog.js';
import { PaginationBar } from '../components/ui/Pagination.js';
import { ApiError, apiClient } from '../lib/api.js';
import { formatDateTime } from '../lib/format.js';

interface RemindersPageProps {
  onSelectEmail: (emailId: string) => void;
  onNotify: (tone: 'info' | 'success' | 'error', text: string) => void;
}

const FILTER_TABS: Array<{ value: ReminderFilter; label: string }> = [
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

export function RemindersPage({ onSelectEmail, onNotify }: RemindersPageProps) {
  const [filter, setFilter] = useState<ReminderFilter>('upcoming');
  const [page, setPage] = useState(1);

  const [data, setData] = useState<PaginatedRemindersResponse | null>(null);
  const [tabCounts, setTabCounts] = useState<Partial<Record<ReminderFilter, number>>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [snoozeId, setSnoozeId] = useState<string | null>(null);
  const [customSnoozeValue, setCustomSnoozeValue] = useState('');
  const [cancelConfirmId, setCancelConfirmId] = useState<string | null>(null);

  const loadReminders = useCallback(
    (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);

      const otherTabs = FILTER_TABS.map((t) => t.value).filter((v) => v !== filter);

      Promise.allSettled([
        apiClient.listReminders({ filter, page, limit: 15 }, signal),
        ...otherTabs.map((tab) =>
          apiClient.listReminders({ filter: tab, page: 1, limit: 1 }, signal),
        ),
      ])
        .then(([activeRes, ...otherRes]) => {
          if (activeRes.status === 'rejected') {
            const err = activeRes.reason;
            if (err instanceof DOMException && err.name === 'AbortError') return;
            setError(err instanceof ApiError ? err.message : 'Unable to load reminders.');
            return;
          }

          setData(activeRes.value);
          const nextCounts: Partial<Record<ReminderFilter, number>> = {
            [filter]: activeRes.value.total,
          };
          otherTabs.forEach((tab, idx) => {
            const res = otherRes[idx];
            if (res && res.status === 'fulfilled') {
              nextCounts[tab] = res.value.total;
            }
          });
          setTabCounts(nextCounts);
        })
        .finally(() => setLoading(false));
    },
    [filter, page],
  );

  useEffect(() => {
    const controller = new AbortController();
    loadReminders(controller.signal);
    return () => controller.abort();
  }, [loadReminders]);

  async function handleComplete(id: string) {
    try {
      await apiClient.completeReminder(id);
      onNotify('success', 'Reminder marked as completed.');
      loadReminders();
    } catch (err) {
      onNotify('error', err instanceof ApiError ? err.message : 'Failed to complete reminder.');
    }
  }

  async function handleSnoozeTo(id: string, isoDate: string) {
    try {
      await apiClient.updateReminder(id, { dueAt: isoDate });
      onNotify('success', 'Reminder snoozed.');
      setSnoozeId(null);
      setCustomSnoozeValue('');
      loadReminders();
    } catch (err) {
      onNotify('error', err instanceof ApiError ? err.message : 'Failed to snooze reminder.');
    }
  }

  async function handleCancel(id: string) {
    try {
      await apiClient.cancelReminder(id);
      onNotify('info', 'Reminder cancelled.');
      setCancelConfirmId(null);
      loadReminders();
    } catch (err) {
      onNotify('error', err instanceof ApiError ? err.message : 'Failed to cancel reminder.');
    }
  }

  return (
    <div className="space-y-4">
      {/* Tabs with Counts */}
      <div
        role="tablist"
        aria-label="Reminder filter"
        className="inline-flex flex-wrap rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-subtle)] p-0.5"
      >
        {FILTER_TABS.map((tab) => {
          const active = filter === tab.value;
          const count = tabCounts[tab.value];
          return (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => {
                setFilter(tab.value);
                setPage(1);
                setSnoozeId(null);
              }}
              className={`inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] px-3 py-1.5 text-[12px] font-medium transition-colors duration-150 ${
                active
                  ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-[var(--shadow-sm)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              <span>{tab.label}</span>
              {count !== undefined ? (
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[11px] tabular-nums ${
                    active
                      ? 'bg-[var(--bg-subtle)] text-[var(--text-primary)]'
                      : 'text-[var(--text-muted)]'
                  }`}
                >
                  {count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {loading ? (
        <TableSkeleton rows={5} />
      ) : error ? (
        <ErrorState
          title="Unable to load reminders"
          message={error}
          onRetry={() => loadReminders()}
        />
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          title={filter === 'upcoming' ? 'No reminders yet' : `No ${filter} reminders`}
          description={
            filter === 'upcoming'
              ? 'No reminders yet. Set one from any tracked email.'
              : `No ${filter} follow-up reminders right now.`
          }
        />
      ) : (
        <SurfaceCard className="overflow-hidden">
          <ul className="divide-y divide-[var(--border-default)]">
            {data.items.map((reminder) => {
              const isOverdue =
                reminder.status === 'PENDING' && new Date(reminder.dueAt).getTime() < Date.now();
              const isPending = reminder.status === 'PENDING';
              const isSnoozing = snoozeId === reminder.id;

              return (
                <li
                  key={reminder.id}
                  className={`p-4 transition-colors duration-150 ${
                    isOverdue
                      ? 'border-l-2 border-l-[var(--status-danger-dot)] bg-[var(--status-danger-bg)]/25'
                      : 'hover:bg-[var(--bg-subtle)]/60'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <ReminderStatusBadge status={reminder.status} />
                        <span
                          className={`text-[12px] tabular-nums ${
                            isOverdue
                              ? 'font-medium text-[var(--status-danger-text)]'
                              : 'text-[var(--text-secondary)]'
                          }`}
                        >
                          Due {formatDateTime(reminder.dueAt)}
                        </span>
                      </div>

                      <div className="mt-1.5">
                        <button
                          type="button"
                          onClick={() => onSelectEmail(reminder.trackedEmailId)}
                          className="text-left text-[13px] font-semibold text-[var(--text-primary)] hover:text-[var(--accent-text)] hover:underline"
                        >
                          {reminder.trackedEmail?.subject || 'No subject'}
                        </button>
                        {reminder.trackedEmail?.recipientReference ? (
                          <span className="ml-2 text-[12px] text-[var(--text-secondary)]">
                            ({reminder.trackedEmail.recipientReference})
                          </span>
                        ) : null}
                      </div>

                      {reminder.note ? (
                        <p className="mt-1 text-[12px] text-[var(--text-secondary)]">
                          {reminder.note}
                        </p>
                      ) : null}
                    </div>

                    {isPending ? (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => void handleComplete(reminder.id)}
                        >
                          <IconCheck className="h-3.5 w-3.5" />
                          Complete
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() =>
                            setSnoozeId((cur) => (cur === reminder.id ? null : reminder.id))
                          }
                        >
                          <IconClock className="h-3.5 w-3.5" />
                          Snooze
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setCancelConfirmId(reminder.id)}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : null}
                  </div>

                  {isSnoozing ? (
                    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[var(--border-default)] pt-3">
                      <span className="text-[12px] text-[var(--text-muted)]">Snooze until:</span>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          const d = new Date(Date.now() + 24 * 3600 * 1000);
                          void handleSnoozeTo(reminder.id, d.toISOString());
                        }}
                      >
                        Tomorrow
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          const d = new Date(Date.now() + 3 * 24 * 3600 * 1000);
                          void handleSnoozeTo(reminder.id, d.toISOString());
                        }}
                      >
                        In 3 days
                      </Button>
                      <input
                        type="datetime-local"
                        aria-label="Custom snooze date and time"
                        value={customSnoozeValue}
                        onChange={(e) => setCustomSnoozeValue(e.target.value)}
                        className={`${INPUT_CLASS} w-auto`}
                      />
                      <Button
                        size="sm"
                        variant="primary"
                        disabled={!customSnoozeValue}
                        onClick={() =>
                          void handleSnoozeTo(
                            reminder.id,
                            new Date(customSnoozeValue).toISOString(),
                          )
                        }
                      >
                        Save
                      </Button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>

          <PaginationBar
            page={data.page}
            totalPages={data.totalPages}
            totalItems={data.total}
            itemLabel="reminders"
            onPageChange={setPage}
          />
        </SurfaceCard>
      )}

      {/* Cancel Confirmation Modal */}
      <ModalDialog
        open={Boolean(cancelConfirmId)}
        onClose={() => setCancelConfirmId(null)}
        title="Cancel reminder?"
        description="This reminder will be moved to the Cancelled tab."
        maxWidthClass="max-w-sm"
      >
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setCancelConfirmId(null)}>
            Keep reminder
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              if (cancelConfirmId) void handleCancel(cancelConfirmId);
            }}
          >
            Confirm cancel
          </Button>
        </div>
      </ModalDialog>
    </div>
  );
}
