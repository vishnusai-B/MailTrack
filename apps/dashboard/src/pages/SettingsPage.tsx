import type { HealthCheckResponse, User } from '@mailtrack/shared';
import { IconLogOut, IconShield } from '../components/Icons.js';
import { Button } from '../components/ui/Button.js';
import { SectionHeader, SurfaceCard } from '../components/ui/Card.js';
import { formatDateTime } from '../lib/format.js';

interface SettingsPageProps {
  user: User;
  health: HealthCheckResponse | null;
  onLogout?: () => void;
}

export function SettingsPage({ user, health, onLogout }: SettingsPageProps) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <SurfaceCard className="overflow-hidden">
          <SectionHeader
            title="Account Profile"
            description="Your signed-in account details. Compose defaults are managed in the Chrome extension."
          />
          <dl className="grid grid-cols-1 gap-4 p-5 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-[11px] font-medium text-neutral-500">Email</dt>
              <dd className="mt-1 text-xs font-medium text-neutral-950">{user.email}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-medium text-neutral-500">Name</dt>
              <dd className="mt-1 text-xs text-neutral-900">{user.name || '—'}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-medium text-neutral-500">
                Default Tracking Preference
              </dt>
              <dd className="mt-1 text-xs text-neutral-900">
                {user.defaultTrackingEnabled ? 'Enabled by default' : 'Disabled by default'}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-medium text-neutral-500">Account Created</dt>
              <dd className="mt-1 text-xs text-neutral-900 tabular-nums">
                {formatDateTime(user.createdAt)}
              </dd>
            </div>
          </dl>
        </SurfaceCard>

        <SurfaceCard className="overflow-hidden">
          <SectionHeader
            title="Backend Connectivity"
            description="Live status reported by the MailTrack API."
          />
          <div className="p-5">
            {health ? (
              <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-[11px] font-medium text-neutral-500">API Status</dt>
                  <dd className="mt-1.5 inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 uppercase ring-1 ring-emerald-600/20">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    {health.status}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] font-medium text-neutral-500">Database</dt>
                  <dd className="mt-1.5 inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 uppercase ring-1 ring-emerald-600/20">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    {health.database}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] font-medium text-neutral-500">Service</dt>
                  <dd className="mt-1.5 font-mono text-xs text-neutral-700">{health.service}</dd>
                </div>
              </dl>
            ) : (
              <p className="text-xs text-neutral-500">Health status unavailable.</p>
            )}
          </div>
        </SurfaceCard>
      </div>

      <SurfaceCard className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-600">
              <IconShield className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-neutral-900">Session Security</h2>
              <p className="mt-0.5 text-xs text-neutral-500">
                Signed in with rotating refresh tokens. Sign out to revoke your active session on
                this browser.
              </p>
            </div>
          </div>
          {onLogout ? (
            <Button variant="secondary" onClick={onLogout}>
              <IconLogOut className="h-3.5 w-3.5" />
              Sign out
            </Button>
          ) : null}
        </div>
      </SurfaceCard>
    </div>
  );
}
