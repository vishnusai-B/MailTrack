import { useCallback, useEffect, useState } from 'react';
import type { DashboardAnalyticsResponse } from '@mailtrack/shared';
import { DailyActivityChart } from '../components/Charts.js';
import { ErrorState } from '../components/ErrorState.js';
import { IconAlertTriangle, IconArrowUpRight, IconCheck, IconInfo } from '../components/Icons.js';
import { CardSkeleton, ChartSkeleton } from '../components/Skeleton.js';
import { Button } from '../components/ui/Button.js';
import { SectionHeader, SurfaceCard } from '../components/ui/Card.js';
import { ApiError, apiClient } from '../lib/api.js';
import { formatDateTime, formatRelativeTime } from '../lib/format.js';

interface OverviewPageProps {
  onSelectEmail: (emailId: string) => void;
  onNavigateEmails: () => void;
  onNavigateActivity: () => void;
  onNavigateReminders: () => void;
}

export function OverviewPage({
  onSelectEmail,
  onNavigateEmails,
  onNavigateActivity,
  onNavigateReminders,
}: OverviewPageProps) {
  const [days, setDays] = useState<number>(30);
  const [data, setData] = useState<DashboardAnalyticsResponse | null>(null);
  const [pendingFollowUps, setPendingFollowUps] = useState<{
    upcoming: number;
    overdue: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadOverview = useCallback(
    (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);

      Promise.allSettled([
        apiClient.getAnalytics({ days }, signal),
        apiClient.listReminders({ filter: 'upcoming', page: 1, limit: 1 }, signal),
        apiClient.listReminders({ filter: 'overdue', page: 1, limit: 1 }, signal),
      ])
        .then(([analyticsRes, upcomingRes, overdueRes]) => {
          if (analyticsRes.status === 'rejected') {
            const err = analyticsRes.reason;
            if (err instanceof DOMException && err.name === 'AbortError') return;
            setError(err instanceof ApiError ? err.message : 'Unable to load dashboard overview.');
            return;
          }

          setData(analyticsRes.value);

          if (upcomingRes.status === 'fulfilled' && overdueRes.status === 'fulfilled') {
            setPendingFollowUps({
              upcoming: Number.isFinite(upcomingRes.value?.total) ? upcomingRes.value.total : 0,
              overdue: Number.isFinite(overdueRes.value?.total) ? overdueRes.value.total : 0,
            });
          } else {
            setPendingFollowUps(null);
          }
        })
        .finally(() => {
          setLoading(false);
        });
    },
    [days],
  );

  useEffect(() => {
    const controller = new AbortController();
    loadOverview(controller.signal);
    return () => controller.abort();
  }, [loadOverview]);

  if (loading) {
    return (
      <div className="space-y-5">
        <CardSkeleton count={4} />
        <ChartSkeleton />
      </div>
    );
  }

  if (error || !data) {
    return (
      <ErrorState
        title="Failed to load overview"
        message={error ?? 'No analytics data returned.'}
        onRetry={() => loadOverview()}
      />
    );
  }

  const { statusCounts, classificationCounts, dailyActivity, recentEvents } = data;
  const isZeroState = statusCounts.totalEmails === 0 && classificationCounts.totalEvents === 0;

  if (isZeroState) {
    return (
      <SurfaceCard className="p-6">
        <h2 className="text-[16px] font-semibold text-[var(--text-primary)]">
          Get started with MailTrack
        </h2>
        <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
          No tracking activity yet. Complete these steps to record your first email signals.
        </p>

        <ol className="mt-5 space-y-3">
          {[
            {
              step: '1',
              title: 'Install and sign in to the Chrome extension',
              detail: 'Connect your MailTrack account inside Gmail compose.',
            },
            {
              step: '2',
              title: 'Send a tracked email from Gmail',
              detail: 'Make sure the tracking toggle is enabled before clicking Send.',
            },
            {
              step: '3',
              title: 'Wait for pixel activity',
              detail: 'Pixel requests and proxy/scanner classifications appear here automatically.',
            },
          ].map((item) => (
            <li
              key={item.step}
              className="flex items-start gap-3 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-subtle)] p-3.5"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[12px] font-semibold text-[var(--accent-text)] tabular-nums">
                {item.step}
              </span>
              <div>
                <div className="text-[13px] font-medium text-[var(--text-primary)]">
                  {item.title}
                </div>
                <div className="mt-0.5 text-[12px] text-[var(--text-secondary)]">{item.detail}</div>
              </div>
            </li>
          ))}
        </ol>
      </SurfaceCard>
    );
  }

  const emailsSent = data.totalDispatchedEmails ?? statusCounts.DISPATCHED + statusCounts.SENT;
  const emailsWithActivity = data.emailsWithPixelActivity ?? 0;
  const emailsWithRecorded = data.emailsWithRecordedActivity ?? 0;
  const totalPixelRequests = data.totalPixelRequests ?? classificationCounts.totalEvents;
  const estimatedEngagementRate =
    emailsSent > 0 ? Math.round((emailsWithRecorded / emailsSent) * 100) : 0;

  const totalFollowUps =
    pendingFollowUps !== null ? pendingFollowUps.upcoming + pendingFollowUps.overdue : null;

  const nonZeroAlerts: string[] = [];
  if (statusCounts.FAILED > 0) {
    nonZeroAlerts.push(
      `${statusCounts.FAILED} ${statusCounts.FAILED === 1 ? 'email' : 'emails'} failed to send`,
    );
  }
  if (statusCounts.PENDING > 0) {
    nonZeroAlerts.push(`${statusCounts.PENDING} pending`);
  }
  if (statusCounts.EXPIRED > 0) {
    nonZeroAlerts.push(`${statusCounts.EXPIRED} expired`);
  }

  return (
    <div className="space-y-5">
      {/* Compact 4-KPI Row */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 shadow-[var(--shadow-sm)]">
          <div className="text-[12px] font-medium text-[var(--text-secondary)]">Emails sent</div>
          <div className="mt-1.5 text-[24px] font-semibold tracking-tight text-[var(--text-primary)] tabular-nums">
            {emailsSent}
          </div>
          <div className="mt-1 text-[12px] text-[var(--text-muted)] tabular-nums">
            {statusCounts.totalEmails} tracked ({days}d)
          </div>
        </div>

        <div className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 shadow-[var(--shadow-sm)]">
          <div className="text-[12px] font-medium text-[var(--text-secondary)]">
            Emails with pixel activity
          </div>
          <div className="mt-1.5 text-[24px] font-semibold tracking-tight text-[var(--text-primary)] tabular-nums">
            {emailsWithActivity}
          </div>
          <div className="mt-1 text-[12px] text-[var(--text-muted)] tabular-nums">
            {totalPixelRequests} pixel requests ({days}d)
          </div>
        </div>

        <div className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 shadow-[var(--shadow-sm)]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[12px] font-medium text-[var(--text-secondary)]">
              Estimated engagement rate
            </span>
            <span
              title="Pixel requests can be generated by email proxies, security scanners, caching, or repeated image requests. A recorded pixel event does not prove that a person read the email."
              className="inline-flex cursor-help items-center gap-1 rounded-[var(--radius-sm)] bg-[var(--bg-subtle)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--text-muted)]"
            >
              <IconInfo className="h-3 w-3" />
              Estimate
            </span>
          </div>
          <div className="mt-1.5 text-[24px] font-semibold tracking-tight text-[var(--text-primary)] tabular-nums">
            {`${estimatedEngagementRate}%`}
          </div>
          <div className="mt-1 text-[12px] text-[var(--text-muted)] tabular-nums">
            {emailsWithRecorded} {emailsWithRecorded === 1 ? 'email' : 'emails'} with likely human
            signals ({days}d)
          </div>
        </div>

        <button
          type="button"
          onClick={onNavigateReminders}
          className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 text-left shadow-[var(--shadow-sm)] transition-colors duration-150 hover:border-[var(--border-strong)] hover:bg-[var(--bg-subtle)]"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[12px] font-medium text-[var(--text-secondary)]">
              Pending follow-ups
            </span>
            <IconArrowUpRight className="h-3.5 w-3.5 text-[var(--text-muted)]" />
          </div>
          <div className="mt-1.5 text-[24px] font-semibold tracking-tight text-[var(--text-primary)] tabular-nums">
            {totalFollowUps !== null ? totalFollowUps : '—'}
          </div>
          <div className="mt-1 text-[12px] text-[var(--text-muted)] tabular-nums">
            {pendingFollowUps && pendingFollowUps.overdue > 0
              ? `${pendingFollowUps.overdue} overdue`
              : 'Scheduled reminders'}
          </div>
        </button>
      </div>

      {/* Inline Status Alert (only shown when Pending/Failed/Expired > 0) */}
      {nonZeroAlerts.length > 0 ? (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-2.5 text-[13px]"
        >
          <div className="flex items-center gap-2 text-[var(--text-secondary)]">
            <IconAlertTriangle className="h-4 w-4 shrink-0 text-[var(--status-warning-dot)]" />
            <span className="tabular-nums">{nonZeroAlerts.join(' · ')}</span>
          </div>
          <Button size="sm" variant="ghost" onClick={onNavigateEmails}>
            Review emails
          </Button>
        </div>
      ) : null}

      {/* Time-Series Activity Chart */}
      <DailyActivityChart
        data={dailyActivity}
        title="Pixel activity"
        selectedDays={days}
        onSelectRange={setDays}
      />

      {/* Recent Activity */}
      <SurfaceCard className="overflow-hidden">
        <SectionHeader
          title="Recent activity"
          description="Latest pixel requests. Click any row to inspect the email timeline."
          action={
            <div className="flex items-center gap-2">
              <Button size="sm" variant="ghost" onClick={onNavigateActivity}>
                All activity
              </Button>
              <Button size="sm" variant="secondary" onClick={onNavigateEmails}>
                Tracked emails
              </Button>
            </div>
          }
        />

        {recentEvents.length === 0 ? (
          <div className="px-4 py-8 text-center text-[13px] text-[var(--text-muted)]">
            No pixel requests recorded in this window.
          </div>
        ) : (
          <ul className="divide-y divide-[var(--border-default)]">
            {recentEvents.slice(0, 8).map((ev) => {
              const isLikelyHuman = ev.classification === 'RECORDED';
              return (
                <li key={ev.id}>
                  <button
                    type="button"
                    onClick={() => onSelectEmail(ev.trackedEmailId)}
                    className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition-colors duration-150 hover:bg-[var(--bg-subtle)]"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`truncate text-[13px] font-medium ${
                            ev.trackedEmail.subject
                              ? 'text-[var(--text-primary)]'
                              : 'italic text-[var(--text-muted)]'
                          }`}
                        >
                          {ev.trackedEmail.subject || 'No subject'}
                        </span>
                      </div>
                      <div className="mt-0.5 truncate text-[12px] text-[var(--text-secondary)]">
                        {ev.trackedEmail.recipientReference}
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-3">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] px-2 py-0.5 text-[12px] font-medium ${
                          isLikelyHuman
                            ? 'bg-[var(--status-success-bg)] text-[var(--status-success-text)]'
                            : 'bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]'
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            isLikelyHuman
                              ? 'bg-[var(--status-success-dot)]'
                              : 'bg-[var(--status-warning-dot)]'
                          }`}
                          aria-hidden="true"
                        />
                        {isLikelyHuman ? 'Likely opened' : 'Probably automated'}
                      </span>
                      <span
                        title={formatDateTime(ev.occurredAt)}
                        className="hidden w-20 text-right text-[12px] text-[var(--text-muted)] tabular-nums sm:inline"
                      >
                        {formatRelativeTime(ev.occurredAt)}
                      </span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </SurfaceCard>
    </div>
  );
}

// Keep unused icon check clean if needed
void IconCheck;
