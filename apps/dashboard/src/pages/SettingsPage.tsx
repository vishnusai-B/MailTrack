import type { HealthCheckResponse, User } from '@mailtrack/shared';
import { formatDateTime } from '../lib/format.js';

interface SettingsPageProps {
  user: User;
  health: HealthCheckResponse | null;
}

export function SettingsPage({ user, health }: SettingsPageProps) {
  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
        <h2 className="text-sm font-semibold text-slate-900">Account Profile</h2>
        <p className="mt-1 text-xs text-slate-500">
          Authenticated MailTrack user details. Extension compose preferences are configured in the
          MailTrack Chrome extension popup.
        </p>

        <dl className="mt-5 grid grid-cols-1 gap-4 border-t border-slate-100 pt-5 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium text-slate-500">Email</dt>
            <dd className="mt-1 font-medium text-slate-900">{user.email}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-slate-500">Name</dt>
            <dd className="mt-1 text-slate-900">{user.name || '—'}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-slate-500">Default Tracking Preference</dt>
            <dd className="mt-1 text-slate-900">
              {user.defaultTrackingEnabled ? 'Enabled by default' : 'Disabled by default'}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-slate-500">Account Created</dt>
            <dd className="mt-1 text-slate-900">{formatDateTime(user.createdAt)}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
        <h2 className="text-sm font-semibold text-slate-900">Backend Connectivity</h2>
        <p className="mt-1 text-xs text-slate-500">
          Live status reported by the MailTrack API health endpoint.
        </p>

        {health ? (
          <dl className="mt-5 grid grid-cols-1 gap-4 border-t border-slate-100 pt-5 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs font-medium text-slate-500">API Status</dt>
              <dd className="mt-1 font-semibold text-slate-900 uppercase">{health.status}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500">Database</dt>
              <dd className="mt-1 font-semibold text-slate-900 uppercase">{health.database}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500">Service</dt>
              <dd className="mt-1 text-slate-700">{health.service}</dd>
            </div>
          </dl>
        ) : (
          <p className="mt-4 text-xs text-slate-500">Health status unavailable.</p>
        )}
      </section>
    </div>
  );
}
