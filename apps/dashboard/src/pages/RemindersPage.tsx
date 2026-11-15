import { useCallback, useEffect, useState } from 'react';
import type { PaginatedRemindersResponse, ReminderFilter } from '@mailtrack/shared';
import { EmptyState } from '../components/EmptyState.js';
import { ErrorState } from '../components/ErrorState.js';
import { IconChevronLeft, IconChevronRight } from '../components/Icons.js';
import { TableSkeleton } from '../components/Skeleton.js';
import { ReminderStatusBadge } from '../components/StatusBadge.js';
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
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
        {FILTER_TABS.map((tab) => {
          const active = filter === tab.value;
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => {
                setFilter(tab.value);
                setPage(1);
              }}
              className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition ${
                active
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
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
          description="Create a follow-up reminder from any Tracked Email detail page."
        />
      ) : (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
          <ul className="divide-y divide-slate-100">
            {data.items.map((reminder) => (
              <li key={reminder.id} className="space-y-3 px-6 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {reminder.trackedEmail ? (
                        <button
                          type="button"
                          onClick={() => onSelectEmail(reminder.trackedEmail!.id)}
                          className="text-sm font-semibold text-slate-900 hover:text-blue-600"
                        >
                          {reminder.trackedEmail.subject || '(No subject)'}
                        </button>
                      ) : (
                        <span className="text-sm font-semibold text-slate-900">Tracked Email</span>
                      )}
                      <ReminderStatusBadge status={reminder.status} />
                    </div>
                    {reminder.trackedEmail ? (
                      <div className="mt-0.5 text-xs text-slate-500">
                        Recipient: {reminder.trackedEmail.recipientReference}
                      </div>
                    ) : null}
                    {reminder.note ? (
                      <p className="mt-1.5 text-xs text-slate-700">{reminder.note}</p>
                    ) : null}
                    <div className="mt-1 text-xs text-slate-500">
                      Due: <span className="font-medium">{formatDateTime(reminder.dueAt)}</span>
                      {reminder.completedAt
                        ? ` · Completed: ${formatDateTime(reminder.completedAt)}`
                        : ''}
                    </div>
                  </div>

                  {reminder.status === 'PENDING' ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void handleComplete(reminder.id)}
                        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                      >
                        Complete
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRescheduleId(rescheduleId === reminder.id ? null : reminder.id);
                          setRescheduleValue('');
                        }}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Reschedule
                      </button>
                      <button
                        type="button"
                        onClick={() => setCancelConfirmId(reminder.id)}
                        className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-100"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : null}
                </div>

                {rescheduleId === reminder.id ? (
                  <div className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 p-3 text-xs">
                    <label
                      htmlFor={`reschedule-${reminder.id}`}
                      className="font-medium text-slate-700"
                    >
                      New due date & time:
                    </label>
                    <input
                      id={`reschedule-${reminder.id}`}
                      type="datetime-local"
                      value={rescheduleValue}
                      onChange={(e) => setRescheduleValue(e.target.value)}
                      className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => void handleReschedule(reminder.id)}
                      className="rounded-lg bg-blue-600 px-3 py-1.5 font-semibold text-white hover:bg-blue-700"
                    >
                      Save
                    </button>
                  </div>
                ) : null}

                {cancelConfirmId === reminder.id ? (
                  <div
                    role="alertdialog"
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-900"
                  >
                    <span>Cancel this follow-up reminder?</span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => void handleCancel(reminder.id)}
                        className="rounded-lg bg-rose-600 px-2.5 py-1 font-semibold text-white hover:bg-rose-700"
                      >
                        Confirm Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => setCancelConfirmId(null)}
                        className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 font-medium text-slate-700"
                      >
                        Keep
                      </button>
                    </div>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/60 px-5 py-3 text-xs text-slate-600">
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
        </section>
      )}
    </div>
  );
}
