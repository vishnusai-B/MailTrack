import { useState } from 'react';
import type { HealthCheckResponse, User } from '@mailtrack/shared';
import {
  IconDownload,
  IconLogOut,
  IconMonitor,
  IconMoon,
  IconShield,
  IconSun,
  IconTrash,
} from '../components/Icons.js';
import { Button } from '../components/ui/Button.js';
import { SectionHeader, SurfaceCard } from '../components/ui/Card.js';
import { ModalDialog } from '../components/ui/Dialog.js';
import { ApiError, apiClient } from '../lib/api.js';
import { formatDateTime } from '../lib/format.js';
import { getResolvedSystemScheme, type ColorSchemePreference } from '../lib/theme.js';

interface SettingsPageProps {
  user: User;
  health: HealthCheckResponse | null;
  themePreference: ColorSchemePreference;
  onChangeTheme: (pref: ColorSchemePreference) => void;
  onLogout: () => void;
  onNotify: (tone: 'info' | 'success' | 'error', text: string) => void;
}

const DEFAULT_TRACKING_PREF_KEY = 'mailtrack.defaultTrackingOverride';

export function SettingsPage({
  user,
  health,
  themePreference,
  onChangeTheme,
  onLogout,
  onNotify,
}: SettingsPageProps) {
  const [disabledByDefault, setDisabledByDefault] = useState<boolean>(() => {
    try {
      const stored = window.localStorage.getItem(DEFAULT_TRACKING_PREF_KEY);
      if (stored !== null) return stored === 'disabled';
    } catch {
      // Ignore storage errors
    }
    return !user.defaultTrackingEnabled;
  });

  const [exportingAll, setExportingAll] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [confirmSignOutAllOpen, setConfirmSignOutAllOpen] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);

  const systemScheme = getResolvedSystemScheme();

  function handleToggleDefaultTracking() {
    const nextDisabled = !disabledByDefault;
    setDisabledByDefault(nextDisabled);
    try {
      window.localStorage.setItem(DEFAULT_TRACKING_PREF_KEY, nextDisabled ? 'disabled' : 'enabled');
    } catch {
      // Ignore storage errors
    }
    onNotify(
      'info',
      nextDisabled
        ? 'Tracking set to disabled by default. Update the Gmail extension toggle to match.'
        : 'Tracking set to enabled by default.',
    );
  }

  async function handleExportAllData() {
    setExportingAll(true);
    try {
      await apiClient.downloadCsv('/api/exports/emails', {}, 'mailtrack-emails-export.csv');
      await apiClient.downloadCsv('/api/exports/events', {}, 'mailtrack-events-export.csv');
      onNotify('success', 'Exported tracked emails and activity CSV files.');
    } catch (err: unknown) {
      onNotify('error', err instanceof ApiError ? err.message : 'Unable to export workspace data.');
    } finally {
      setExportingAll(false);
    }
  }

  function handleConfirmDeleteAccount() {
    setConfirmDeleteOpen(false);
    onNotify(
      'info',
      'Self-service account deletion is not enabled on this server yet. Contact your workspace administrator to purge records.',
    );
  }

  function handleConfirmSignOutAll() {
    setConfirmSignOutAllOpen(false);
    onLogout();
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Profile */}
        <SurfaceCard className="overflow-hidden">
          <SectionHeader
            title="Profile"
            description="Account identity for this MailTrack workspace."
          />
          <dl className="grid grid-cols-1 gap-4 p-4 text-[13px] sm:grid-cols-2">
            <div>
              <dt className="text-[12px] text-[var(--text-muted)]">Email</dt>
              <dd className="mt-1 font-medium text-[var(--text-primary)]">{user.email}</dd>
            </div>
            <div>
              <dt className="text-[12px] text-[var(--text-muted)]">Name</dt>
              <dd className="mt-1 text-[var(--text-primary)]">{user.name || '—'}</dd>
            </div>
            <div>
              <dt className="text-[12px] text-[var(--text-muted)]">Account created</dt>
              <dd className="mt-1 text-[var(--text-primary)] tabular-nums">
                {formatDateTime(user.createdAt)}
              </dd>
            </div>
          </dl>
        </SurfaceCard>

        {/* Appearance */}
        <SurfaceCard className="overflow-hidden">
          <SectionHeader
            title="Appearance"
            description="Choose light, dark, or match your operating system."
          />
          <div className="p-4">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {(
                [
                  { id: 'system', label: `System (${systemScheme})`, icon: IconMonitor },
                  { id: 'light', label: 'Light', icon: IconSun },
                  { id: 'dark', label: 'Dark', icon: IconMoon },
                ] as const
              ).map((opt) => {
                const Icon = opt.icon;
                const active = themePreference === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => onChangeTheme(opt.id)}
                    className={`flex items-center gap-2 rounded-[var(--radius-md)] border px-3 py-2 text-[12px] font-medium transition-colors duration-150 ${
                      active
                        ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-text)]'
                        : 'border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </SurfaceCard>
      </div>

      {/* Tracking Defaults & Chrome Extension */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <SurfaceCard className="overflow-hidden">
          <SectionHeader
            title="Tracking defaults"
            description="Control whether new Gmail compose windows start with tracking off."
          />
          <div className="flex items-start justify-between gap-4 p-4">
            <div>
              <div className="text-[13px] font-medium text-[var(--text-primary)]">
                Disabled by default
              </div>
              <p className="mt-0.5 text-[12px] leading-relaxed text-[var(--text-secondary)]">
                When enabled, you opt in per email inside Gmail compose instead of tracking every
                outgoing message automatically.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={disabledByDefault}
              aria-label="Disabled by default"
              onClick={handleToggleDefaultTracking}
              className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors duration-150 ${
                disabledByDefault
                  ? 'border-[var(--accent)] bg-[var(--accent)]'
                  : 'border-[var(--border-strong)] bg-[var(--bg-hover)]'
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform duration-150 ${
                  disabledByDefault ? 'translate-x-4' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
        </SurfaceCard>

        <SurfaceCard className="overflow-hidden">
          <SectionHeader
            title="Chrome extension"
            description="Connect Gmail compose to register tracking pixels."
          />
          <div className="space-y-2.5 p-4 text-[12px] text-[var(--text-secondary)]">
            <div className="flex items-center justify-between">
              <span className="font-medium text-[var(--text-primary)]">Connection</span>
              <span className="inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] bg-[var(--status-info-bg)] px-2 py-0.5 font-medium text-[var(--status-info-text)]">
                Ready to link via account sign-in
              </span>
            </div>
            <p className="leading-relaxed">
              Open the MailTrack extension popup in Chrome and sign in with{' '}
              <span className="font-medium text-[var(--text-primary)]">{user.email}</span>. New
              compose windows in Gmail will show the tracking toggle automatically.
            </p>
          </div>
        </SurfaceCard>
      </div>

      {/* Data & Privacy + Sessions */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <SurfaceCard className="overflow-hidden">
          <SectionHeader
            title="Data and privacy"
            description="Retention rules, exports, and account removal."
          />
          <div className="space-y-4 p-4">
            <div className="text-[12px] text-[var(--text-secondary)]">
              <span className="font-medium text-[var(--text-primary)]">Retention window:</span>{' '}
              Pending records expire after 24 hours; dispatched email tracking windows expire after
              7 days.
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                loading={exportingAll}
                onClick={handleExportAllData}
              >
                <IconDownload className="h-3.5 w-3.5" />
                Export all data
              </Button>
              <Button variant="danger" size="sm" onClick={() => setConfirmDeleteOpen(true)}>
                <IconTrash className="h-3.5 w-3.5" />
                Delete account
              </Button>
            </div>
          </div>
        </SurfaceCard>

        <SurfaceCard className="overflow-hidden">
          <SectionHeader
            title="Sessions"
            description="Manage active sign-in sessions for this browser."
          />
          <div className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="flex items-center gap-2.5 text-[12px] text-[var(--text-secondary)]">
              <IconShield className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
              <span>Rotating refresh tokens active for this browser.</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="secondary" size="sm" onClick={onLogout}>
                <IconLogOut className="h-3.5 w-3.5" />
                Sign out
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirmSignOutAllOpen(true)}>
                Sign out everywhere
              </Button>
            </div>
          </div>
        </SurfaceCard>
      </div>

      {/* Subtle System Status Link */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setShowStatusModal(true)}
          className="text-[12px] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:underline"
        >
          System status
        </button>
      </div>

      {/* Modals */}
      <ModalDialog
        open={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
        title="Delete account?"
        description="This will permanently remove your tracked emails, campaigns, reminders, and pixel logs."
        maxWidthClass="max-w-md"
      >
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirmDeleteOpen(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleConfirmDeleteAccount}>
            Request deletion
          </Button>
        </div>
      </ModalDialog>

      <ModalDialog
        open={confirmSignOutAllOpen}
        onClose={() => setConfirmSignOutAllOpen(false)}
        title="Sign out everywhere?"
        description="Revokes your current browser session and clears stored tokens."
        maxWidthClass="max-w-md"
      >
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirmSignOutAllOpen(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleConfirmSignOutAll}>
            Sign out
          </Button>
        </div>
      </ModalDialog>

      <ModalDialog
        open={showStatusModal}
        onClose={() => setShowStatusModal(false)}
        title="System status"
        description="Live API connectivity snapshot."
        maxWidthClass="max-w-sm"
      >
        {health ? (
          <dl className="space-y-2 text-[13px]">
            <div className="flex justify-between">
              <dt className="text-[var(--text-muted)]">API</dt>
              <dd className="font-medium text-[var(--text-primary)]">{health.status}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[var(--text-muted)]">Checked at</dt>
              <dd className="font-mono text-[12px] text-[var(--text-secondary)] tabular-nums">
                {formatDateTime(health.timestamp)}
              </dd>
            </div>
          </dl>
        ) : (
          <p className="text-[13px] text-[var(--text-secondary)]">
            Unable to reach the health endpoint right now.
          </p>
        )}
      </ModalDialog>
    </div>
  );
}
