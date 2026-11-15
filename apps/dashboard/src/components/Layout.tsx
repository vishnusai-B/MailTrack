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
    <div className="flex h-full flex-col bg-zinc-950 text-zinc-300">
      <div className="flex h-16 items-center justify-between border-b border-zinc-800/80 px-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white shadow-xs ring-1 ring-white/10">
            <IconMail className="h-4 w-4" />
          </div>
          <span className="text-base font-semibold tracking-tight text-white">MailTrack</span>
        </div>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(false)}
          aria-label="Close navigation menu"
          className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white lg:hidden"
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
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-zinc-800/90 text-white ring-1 ring-zinc-700/80'
                  : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100'
              }`}
            >
              <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-blue-400' : ''}`} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="border-t border-zinc-800/80 p-4 text-xs text-zinc-400">
        <div className="truncate font-medium text-zinc-100">{user.name || user.email}</div>
        <div className="truncate text-zinc-500">{user.email}</div>
        <button
          type="button"
          onClick={onLogout}
          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-200 transition-colors hover:bg-zinc-800 hover:text-white"
        >
          <IconLogOut className="h-3.5 w-3.5" />
          Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-slate-50/80 text-slate-900">
      {/* Desktop Sidebar */}
      <aside className="hidden w-64 shrink-0 lg:sticky lg:top-0 lg:block lg:h-screen">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen ? (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <div
            className="fixed inset-0 bg-zinc-950/60 backdrop-blur-xs"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative z-50 w-64 max-w-[80vw]">{sidebarContent}</aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200/80 bg-white/85 px-4 backdrop-blur-md sm:px-6 lg:px-8">
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
