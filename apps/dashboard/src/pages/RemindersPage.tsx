import { useCallback, useEffect, useState } from 'react';
import type { PaginatedRemindersResponse, ReminderFilter } from '@mailtrack/shared';
import { EmptyState } from '../components/EmptyState.js';
import { ErrorState } from '../components/ErrorState.js';
import { IconCheck, IconClock } from '../components/Icons.js';
import { TableSkeleton } from '../components/Skeleton.js';
import { ReminderStatusBadge } from '../components/StatusBadge.js';
import { Button } from '../components/ui/Button.js';
import { INPUT_CLASS, SurfaceCard } from '../components/ui/Card.js';
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [rescheduleId, setRescheduleId] = useState<string | null>(null);
  const [rescheduleValue, setRescheduleValue] = useState('');
  const [cancelConfirmId, setCancelConfirmId] = useState<string | null>(null);

  const loadReminders = useCallback(
    (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      apiClient
        .listReminders({ filter, page, limit: 15 }, signal)
        .then((res) => setData(res))
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === 'AbortError') return;
          setError(err instanceof ApiError ? err.message : 'Unable to load reminders.');
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

  async function handleReschedule(id: string) {
    if (!rescheduleValue) return;
    const dueIso = new Date(rescheduleValue).toISOString();
    try {
      await apiClient.updateReminder(id, { dueAt: dueIso });
      onNotify('success', 'Reminder rescheduled.');
      setRescheduleId(null);
      setRescheduleValue('');
      loadReminders();
    } catch (err) {
      onNotify('error', err instanceof ApiError ? err.message : 'Failed to reschedule reminder.');
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
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="Reminder filter"
          className="inline-flex flex-wrap items-center rounded-lg border border-neutral-200/90 bg-white p-0.5 shadow-2xs"
        >
          {FILTER_TABS.map((tab) => {
            const active = filter === tab.value;
            return (
              <button
                key={tab.value}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => {
                  setFilter(tab.value);
                  setPage(1);
                }}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                  active
                    ? 'bg-neutral-900 text-white shadow-2xs'
                    : 'text-neutral-600 hover:text-neutral-950'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <TableSkeleton rows={5} cols={4} />
      ) : error ? (
        <ErrorState
          title="Unable to load reminders"
          message={error}
          onRetry={() => loadReminders()}
        />
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          title={`No ${filter} reminders`}
          description="Schedule a follow-up reminder from any Tracked Email detail view."
        />
      ) : (
        <SurfaceCard className="overflow-hidden">
          <ul className="divide-y divide-neutral-100">
            {data.items.map((reminder) => (
              <li
                key={reminder.id}
                className="space-y-3 px-5 py-4 transition hover:bg-neutral-50/50"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {reminder.trackedEmail ? (
                        <button
                          type="button"
                          onClick={() => onSelectEmail(reminder.trackedEmail!.id)}
                          className="text-left text-sm font-semibold text-neutral-950 transition hover:text-blue-600"
                        >
                          {reminder.trackedEmail.subject || '(No subject)'}
                        </button>
                      ) : (
                        <span className="text-sm font-semibold text-neutral-950">
                          Tracked Email
                        </span>
                      )}
                      <ReminderStatusBadge status={reminder.status} />
                    </div>
                    {reminder.trackedEmail ? (
                      <div className="mt-0.5 text-xs text-neutral-500">
                        To {reminder.trackedEmail.recipientReference}
                      </div>
                    ) : null}
                    {reminder.note ? (
                      <p className="mt-2 rounded-lg border border-neutral-100 bg-neutral-50/80 px-3 py-2 text-xs text-neutral-700">
                        {reminder.note}
                      </p>
                    ) : null}
                    <div className="mt-2 flex items-center gap-1.5 text-xs text-neutral-500 tabular-nums">
                      <IconClock className="h-3.5 w-3.5 text-neutral-400" />
                      <span>
                        Due:{' '}
                        <span
                          className={`font-medium ${
                            filter === 'overdue' ? 'text-rose-700' : 'text-neutral-800'
                          }`}
                        >
                          {formatDateTime(reminder.dueAt)}
                        </span>
                      </span>
                      {reminder.completedAt
                        ? ` · Completed ${formatDateTime(reminder.completedAt)}`
                        : ''}
                    </div>
                  </div>

                  {reminder.status === 'PENDING' ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <Button variant="success" onClick={() => void handleComplete(reminder.id)}>
                        <IconCheck className="h-3.5 w-3.5" />
                        Complete
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setRescheduleId(rescheduleId === reminder.id ? null : reminder.id);
                          setRescheduleValue('');
                        }}
                      >
                        Reschedule
                      </Button>
                      <button
                        type="button"
                        onClick={() => setCancelConfirmId(reminder.id)}
                        className="inline-flex h-8 items-center rounded-lg border border-rose-200 bg-rose-50 px-3 text-xs font-medium text-rose-700 transition hover:bg-rose-100"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : null}
                </div>

                {rescheduleId === reminder.id ? (
                  <div className="flex flex-wrap items-center gap-2.5 rounded-lg border border-neutral-200/80 bg-neutral-50/80 p-3 text-xs">
                    <label
                      htmlFor={`reschedule-${reminder.id}`}
                      className="font-medium text-neutral-700"
                    >
                      New due date &amp; time:
                    </label>
                    <input
                      id={`reschedule-${reminder.id}`}
                      type="datetime-local"
                      value={rescheduleValue}
                      onChange={(e) => setRescheduleValue(e.target.value)}
                      className={`${INPUT_CLASS} h-8 w-auto text-xs`}
                    />
                    <Button variant="primary" onClick={() => void handleReschedule(reminder.id)}>
                      Save
                    </Button>
                  </div>
                ) : null}

                {cancelConfirmId === reminder.id ? (
                  <div
                    role="alertdialog"
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-rose-200 bg-rose-50/80 px-3.5 py-2.5 text-xs text-rose-950"
                  >
                    <span>Cancel this follow-up reminder?</span>
                    <div className="flex gap-2">
                      <Button variant="danger" onClick={() => void handleCancel(reminder.id)}>
                        Confirm Cancel
                      </Button>
                      <Button variant="secondary" onClick={() => setCancelConfirmId(null)}>
                        Keep
                      </Button>
                    </div>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>

          <PaginationBar
            page={data.page}
            totalPages={data.totalPages}
            total={data.total}
            onPageChange={setPage}
          />
        </SurfaceCard>
      )}
    </div>
  );
}
