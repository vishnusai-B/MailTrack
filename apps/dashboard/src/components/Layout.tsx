import { useEffect, useState, type ReactNode } from 'react';
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
  IconPanelLeft,
  IconSettings,
  IconX,
} from './Icons.js';

export type NavSection =
  'overview' | 'emails' | 'campaigns' | 'reminders' | 'activity' | 'analytics' | 'settings';

interface NavGroup {
  label: string;
  items: Array<{
    id: NavSection;
    label: string;
    icon: typeof IconOverview;
  }>;
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Workspace',
    items: [
      { id: 'overview', label: 'Overview', icon: IconOverview },
      { id: 'emails', label: 'Tracked Emails', icon: IconMail },
      { id: 'campaigns', label: 'Campaigns', icon: IconFolder },
      { id: 'reminders', label: 'Reminders', icon: IconBell },
    ],
  },
  {
    label: 'Insights',
    items: [
      { id: 'activity', label: 'Activity', icon: IconActivity },
      { id: 'analytics', label: 'Analytics', icon: IconAnalytics },
    ],
  },
  {
    label: 'System',
    items: [{ id: 'settings', label: 'Settings', icon: IconSettings }],
  },
];

interface LayoutProps {
  activeSection: NavSection;
  pageTitle: string;
  pageSubtitle?: string;
  user: User;
  health: HealthCheckResponse | null;
  onNavigate: (section: NavSection) => void;
  onLogout: () => void;
  children: ReactNode;
}

function getUserInitials(user: User): string {
  const source = (user.name || user.email).trim();
  if (!source) return 'M';
  const parts = source.split(/\s+/);
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

export function Layout({
  activeSection,
  pageTitle,
  pageSubtitle,
  user,
  health,
  onNavigate,
  onLogout,
  children,
}: LayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setMobileMenuOpen(false);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mobileMenuOpen]);

  const initials = getUserInitials(user);

  const renderSidebar = (isMobile = false) => {
    const collapsed = !isMobile && sidebarCollapsed;
    return (
      <div className="flex h-full flex-col border-r border-neutral-200/80 bg-[#F4F5F7] text-neutral-700">
        {/* Brand Header */}
        <div
          className={`flex h-14 items-center border-b border-neutral-200/70 ${
            collapsed ? 'justify-center px-2' : 'justify-between px-4'
          }`}
        >
          <button
            type="button"
            onClick={() => {
              onNavigate('overview');
              setMobileMenuOpen(false);
            }}
            className="flex items-center gap-2.5 rounded-lg py-1 text-left transition hover:opacity-85"
            title="MailTrack Overview"
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-neutral-900 text-white shadow-2xs">
              <IconMail className="h-3.5 w-3.5 text-blue-400" />
            </div>
            {!collapsed ? (
              <span className="text-sm font-semibold tracking-tight text-neutral-950">
                MailTrack
              </span>
            ) : null}
          </button>

          {isMobile ? (
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              aria-label="Close navigation menu"
              className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-200/60 hover:text-neutral-900 lg:hidden"
            >
              <IconX className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setSidebarCollapsed((c) => !c)}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className="hidden rounded-md p-1 text-neutral-400 transition hover:bg-neutral-200/70 hover:text-neutral-800 lg:inline-flex"
            >
              <IconPanelLeft className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Navigation Groups */}
        <nav
          className="flex-1 space-y-5 overflow-y-auto px-2.5 py-4"
          aria-label="Dashboard navigation"
        >
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              {!collapsed ? (
                <div className="mb-1.5 px-2.5 text-[11px] font-medium tracking-wide text-neutral-400 uppercase">
                  {group.label}
                </div>
              ) : null}
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeSection === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      title={collapsed ? item.label : undefined}
                      onClick={() => {
                        onNavigate(item.id);
                        setMobileMenuOpen(false);
                      }}
                      aria-current={isActive ? 'page' : undefined}
                      className={`group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium transition duration-150 ${
                        collapsed ? 'justify-center px-0' : ''
                      } ${
                        isActive
                          ? 'bg-white text-neutral-950 shadow-[0_1px_2px_rgba(16,24,40,0.06)] ring-1 ring-neutral-200/80'
                          : 'text-neutral-600 hover:bg-neutral-200/50 hover:text-neutral-950'
                      }`}
                    >
                      <Icon
                        className={`h-4 w-4 shrink-0 transition-colors ${
                          isActive
                            ? 'text-blue-600'
                            : 'text-neutral-500 group-hover:text-neutral-800'
                        }`}
                      />
                      {!collapsed ? <span className="truncate">{item.label}</span> : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* User Profile Footer */}
        <div className="border-t border-neutral-200/80 p-3">
          {!collapsed ? (
            <div className="rounded-xl border border-neutral-200/80 bg-white p-2.5 shadow-2xs">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-neutral-900 text-xs font-semibold text-white">
                  {initials}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-semibold text-neutral-900">
                    {user.name || user.email}
                  </div>
                  <div className="truncate text-[11px] text-neutral-500">{user.email}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={onLogout}
                className="mt-2.5 inline-flex h-7 w-full items-center justify-center gap-1.5 rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 text-xs font-medium text-neutral-700 transition hover:bg-neutral-100 hover:text-neutral-950"
              >
                <IconLogOut className="h-3.5 w-3.5" />
                Sign out
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onLogout}
              title="Sign out"
              aria-label="Sign out"
              className="mx-auto flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-950"
            >
              <IconLogOut className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex min-h-screen bg-[#FAFAFB] text-neutral-900">
      {/* Desktop Sidebar */}
      <aside
        className={`hidden shrink-0 transition-[width] duration-200 lg:sticky lg:top-0 lg:block lg:h-screen ${
          sidebarCollapsed ? 'w-16' : 'w-60'
        }`}
      >
        {renderSidebar(false)}
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen ? (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <div
            className="fixed inset-0 bg-neutral-950/35 backdrop-blur-xs"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative z-50 w-64 max-w-[82vw]">{renderSidebar(true)}</aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-neutral-200/80 bg-white/85 px-4 backdrop-blur-md sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              className="rounded-lg p-1.5 text-neutral-600 hover:bg-neutral-100 lg:hidden"
            >
              <IconMenu className="h-5 w-5" />
            </button>
            <div className="flex min-w-0 items-baseline gap-2.5">
              <h1 className="truncate text-sm font-semibold tracking-tight text-neutral-950 sm:text-base">
                {pageTitle}
              </h1>
              {pageSubtitle ? (
                <span className="hidden truncate text-xs text-neutral-400 md:inline">
                  {pageSubtitle}
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2.5">
            {health ? (
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ring-inset ${
                  health.status === 'ok' && health.database === 'connected'
                    ? 'bg-emerald-50/80 text-emerald-700 ring-emerald-600/20'
                    : 'bg-amber-50/80 text-amber-800 ring-amber-600/20'
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
            <button
              type="button"
              onClick={() => onNavigate('settings')}
              title="Account settings"
              className="hidden items-center gap-2 rounded-lg border border-neutral-200/80 bg-neutral-50/80 px-2.5 py-1 text-xs font-medium text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-950 sm:inline-flex"
            >
              <span className="flex h-4 w-4 items-center justify-center rounded-sm bg-neutral-900 text-[10px] font-semibold text-white">
                {initials[0]}
              </span>
              <span className="max-w-[160px] truncate">{user.email}</span>
            </button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1320px] flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div key={`${activeSection}-${pageTitle}`} className="animate-page-enter">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
