import { useState, type ReactNode } from 'react';
import type { HealthCheckResponse, User } from '@mailtrack/shared';
import {
  IconActivity,
  IconAnalytics,
  IconBell,
  IconFolder,
  IconLogOut,
  IconMail,
  IconMenu,
  IconOverview,
  IconSettings,
  IconX,
} from './Icons.js';

export type NavSection =
  'overview' | 'emails' | 'campaigns' | 'reminders' | 'activity' | 'analytics' | 'settings';

const NAV_ITEMS: Array<{
  id: NavSection;
  label: string;
  icon: typeof IconOverview;
}> = [
  { id: 'overview', label: 'Overview', icon: IconOverview },
  { id: 'emails', label: 'Tracked Emails', icon: IconMail },
  { id: 'campaigns', label: 'Campaigns', icon: IconFolder },
  { id: 'reminders', label: 'Reminders', icon: IconBell },
  { id: 'activity', label: 'Activity', icon: IconActivity },
  { id: 'analytics', label: 'Analytics', icon: IconAnalytics },
  { id: 'settings', label: 'Settings', icon: IconSettings },
];

interface LayoutProps {
  activeSection: NavSection;
  pageTitle: string;
  user: User;
  health: HealthCheckResponse | null;
  onNavigate: (section: NavSection) => void;
  onLogout: () => void;
  children: ReactNode;
}

export function Layout({
  activeSection,
  pageTitle,
  user,
  health,
  onNavigate,
  onLogout,
  children,
}: LayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const sidebarContent = (
    <div className="flex h-full flex-col bg-slate-900 text-slate-200">
      <div className="flex h-16 items-center justify-between border-b border-slate-800 px-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white">
            <IconMail className="h-4 w-4" />
          </div>
          <span className="text-base font-bold tracking-tight text-white">MailTrack</span>
        </div>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(false)}
          aria-label="Close navigation menu"
          className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white lg:hidden"
        >
          <IconX className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4" aria-label="Dashboard navigation">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onNavigate(item.id);
                setMobileMenuOpen(false);
              }}
              aria-current={isActive ? 'page' : undefined}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition ${
                isActive
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="border-t border-slate-800 p-4 text-xs text-slate-400">
        <div className="truncate font-medium text-slate-200">{user.name || user.email}</div>
        <div className="truncate text-slate-400">{user.email}</div>
        <button
          type="button"
          onClick={onLogout}
          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-slate-800 hover:text-white"
        >
          <IconLogOut className="h-3.5 w-3.5" />
          Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      {/* Desktop Sidebar */}
      <aside className="hidden w-64 shrink-0 lg:block">{sidebarContent}</aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen ? (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <div
            className="fixed inset-0 bg-slate-900/60"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative z-50 w-64 max-w-[80vw]">{sidebarContent}</aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
            >
              <IconMenu className="h-5 w-5" />
            </button>
            <h1 className="text-lg font-semibold text-slate-900">{pageTitle}</h1>
          </div>

          <div className="flex items-center gap-3">
            {health ? (
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                  health.status === 'ok' && health.database === 'connected'
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-amber-50 text-amber-800'
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    health.status === 'ok' && health.database === 'connected'
                      ? 'bg-emerald-500'
                      : 'bg-amber-500'
                  }`}
                />
                API {health.status}
              </span>
            ) : null}
            <span className="hidden text-xs text-slate-500 sm:inline">{user.email}</span>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
