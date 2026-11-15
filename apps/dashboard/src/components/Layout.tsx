import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { HealthCheckResponse, User } from '@mailtrack/shared';
import {
  IconActivity,
  IconAlertTriangle,
  IconAnalytics,
  IconBell,
  IconChevronDown,
  IconFolder,
  IconLogOut,
  IconMail,
  IconMenu,
  IconOverview,
  IconPanelLeft,
  IconSearch,
  IconSettings,
  IconX,
} from './Icons.js';

export type NavSection =
  'overview' | 'emails' | 'campaigns' | 'reminders' | 'activity' | 'analytics' | 'settings';

interface NavItem {
  id: NavSection;
  label: string;
  shortcut: string;
  icon: typeof IconOverview;
}

const NAV_GROUPS: Array<{ label: string; items: NavItem[] }> = [
  {
    label: 'Workspace',
    items: [
      { id: 'overview', label: 'Overview', shortcut: 'G O', icon: IconOverview },
      { id: 'emails', label: 'Tracked Emails', shortcut: 'G E', icon: IconMail },
      { id: 'campaigns', label: 'Campaigns', shortcut: 'G C', icon: IconFolder },
      { id: 'reminders', label: 'Reminders', shortcut: 'G R', icon: IconBell },
    ],
  },
  {
    label: 'Insights',
    items: [
      { id: 'activity', label: 'Activity', shortcut: 'G A', icon: IconActivity },
      { id: 'analytics', label: 'Analytics', shortcut: 'G N', icon: IconAnalytics },
    ],
  },
  {
    label: 'System',
    items: [{ id: 'settings', label: 'Settings', shortcut: 'G S', icon: IconSettings }],
  },
];

interface LayoutProps {
  activeSection: NavSection;
  pageTitle: string;
  pageSubtitle?: string;
  user: User;
  health: HealthCheckResponse | null;
  apiUnreachable?: boolean;
  onNavigate: (section: NavSection) => void;
  onOpenCommandPalette: () => void;
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
  apiUnreachable = false,
  onNavigate,
  onOpenCommandPalette,
  onLogout,
  children,
}: LayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setMobileMenuOpen(false);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mobileMenuOpen]);

  useEffect(() => {
    if (!accountMenuOpen) return;
    function onPointerDown(e: MouseEvent) {
      if (accountMenuRef.current && !accountMenuRef.current.contains(e.target as Node)) {
        setAccountMenuOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setAccountMenuOpen(false);
    }
    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [accountMenuOpen]);

  const initials = getUserInitials(user);
  const showConnectionWarning = apiUnreachable || health?.status === 'degraded';

  const renderSidebar = (isMobile = false) => {
    const collapsed = !isMobile && sidebarCollapsed;
    return (
      <div className="flex h-full flex-col border-r border-[var(--border-default)] bg-[var(--bg-subtle)] text-[var(--text-secondary)]">
        {/* Brand Header */}
        <div
          className={`flex h-14 items-center border-b border-[var(--border-default)] ${
            collapsed ? 'justify-center px-2' : 'justify-between px-3.5'
          }`}
        >
          <button
            type="button"
            onClick={() => {
              onNavigate('overview');
              setMobileMenuOpen(false);
            }}
            className="flex items-center gap-2.5 rounded-[var(--radius-md)] py-1 text-left transition-opacity duration-150 hover:opacity-85"
            title="MailTrack Overview"
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--accent)] text-white">
              <IconMail className="h-3.5 w-3.5" />
            </div>
            {!collapsed ? (
              <span className="text-[14px] font-semibold tracking-tight text-[var(--text-primary)]">
                MailTrack
              </span>
            ) : null}
          </button>

          {isMobile ? (
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              aria-label="Close navigation menu"
              className="rounded-[var(--radius-sm)] p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] lg:hidden"
            >
              <IconX className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setSidebarCollapsed((c) => !c)}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className="hidden rounded-[var(--radius-sm)] p-1 text-[var(--text-muted)] transition-colors duration-150 hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] lg:inline-flex"
            >
              <IconPanelLeft className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Navigation Groups */}
        <nav
          className="flex-1 space-y-5 overflow-y-auto px-2.5 py-3.5"
          aria-label="Dashboard navigation"
        >
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              {!collapsed ? (
                <div className="mb-1 px-2.5 text-[11px] font-medium text-[var(--text-muted)]">
                  {group.label}
                </div>
              ) : null}
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const active = activeSection === item.id;
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        onNavigate(item.id);
                        setMobileMenuOpen(false);
                      }}
                      title={collapsed ? `${item.label} (${item.shortcut})` : undefined}
                      aria-current={active ? 'page' : undefined}
                      className={`group flex w-full items-center ${
                        collapsed ? 'justify-center px-2' : 'justify-between px-2.5'
                      } rounded-[var(--radius-md)] py-1.5 text-[13px] font-medium transition-colors duration-150 ${
                        active
                          ? 'bg-[var(--bg-active)] text-[var(--accent-text)]'
                          : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      <span className="flex min-w-0 items-center gap-2.5">
                        <Icon
                          className={`h-4 w-4 shrink-0 ${
                            active
                              ? 'text-[var(--accent)]'
                              : 'text-[var(--text-muted)] group-hover:text-[var(--text-primary)]'
                          }`}
                        />
                        {!collapsed ? <span className="truncate">{item.label}</span> : null}
                      </span>
                      {!collapsed ? (
                        <span className="hidden text-[10px] font-medium text-[var(--text-muted)] opacity-0 transition-opacity duration-150 group-hover:opacity-100 xl:inline">
                          {item.shortcut}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Account Footer */}
        <div className="border-t border-[var(--border-default)] p-2.5">
          {!collapsed ? (
            <div className="mb-1.5 flex items-center gap-2.5 rounded-[var(--radius-md)] px-2 py-1.5">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--bg-hover)] text-[11px] font-semibold text-[var(--text-primary)]">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                {user.name ? (
                  <div className="truncate text-[12px] font-medium text-[var(--text-primary)]">
                    {user.name}
                  </div>
                ) : null}
                <div className="truncate text-[11px] text-[var(--text-muted)]">{user.email}</div>
              </div>
            </div>
          ) : null}

          <button
            type="button"
            onClick={onLogout}
            title={collapsed ? 'Sign out' : undefined}
            className={`flex w-full items-center ${
              collapsed ? 'justify-center px-2' : 'gap-2.5 px-2.5'
            } rounded-[var(--radius-md)] py-1.5 text-[13px] font-medium text-[var(--text-secondary)] transition-colors duration-150 hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]`}
          >
            <IconLogOut className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
            {!collapsed ? <span>Sign out</span> : null}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="flex min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)]">
      {/* Desktop Sidebar */}
      <aside
        className={`hidden shrink-0 transition-[width] duration-150 ease-out lg:sticky lg:top-0 lg:block lg:h-screen ${
          sidebarCollapsed ? 'w-[60px]' : 'w-[228px]'
        }`}
      >
        {renderSidebar(false)}
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen ? (
        <div className="fixed inset-0 z-[var(--z-drawer)] flex lg:hidden">
          <div
            className="fixed inset-0 bg-black/45"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <aside
            className="relative z-10 h-full w-64 max-w-[82vw]"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
          >
            {renderSidebar(true)}
          </aside>
        </div>
      ) : null}

      {/* Main Content */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-[var(--z-sticky)] border-b border-[var(--border-default)] bg-[var(--bg-surface)]">
          <div className="mx-auto flex h-14 max-w-[1200px] items-center justify-between gap-3 px-4 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                aria-label="Open navigation menu"
                className="rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-1.5 text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] lg:hidden"
              >
                <IconMenu className="h-4 w-4" />
              </button>
              <div className="flex min-w-0 items-baseline gap-2.5">
                <h1 className="truncate text-[16px] font-semibold tracking-tight text-[var(--text-primary)]">
                  {pageTitle}
                </h1>
                {pageSubtitle ? (
                  <p className="hidden truncate text-[12px] text-[var(--text-muted)] md:block">
                    {pageSubtitle}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onOpenCommandPalette}
                aria-label="Open command palette"
                className="inline-flex h-8 items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-subtle)] px-2.5 text-[12px] text-[var(--text-muted)] transition-colors duration-150 hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
              >
                <IconSearch className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Search...</span>
                <kbd className="hidden rounded border border-[var(--border-default)] bg-[var(--bg-surface)] px-1.5 py-0.5 font-sans text-[10px] font-medium text-[var(--text-muted)] sm:inline">
                  Ctrl K
                </kbd>
              </button>

              <div className="relative" ref={accountMenuRef}>
                <button
                  type="button"
                  onClick={() => setAccountMenuOpen((o) => !o)}
                  aria-expanded={accountMenuOpen}
                  aria-haspopup="menu"
                  aria-label="Account menu"
                  className="inline-flex h-8 items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)] px-2 text-[12px] font-medium text-[var(--text-primary)] transition-colors duration-150 hover:bg-[var(--bg-hover)]"
                >
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[10px] font-semibold text-[var(--accent-text)]">
                    {initials}
                  </span>
                  <span className="hidden max-w-[140px] truncate sm:inline">
                    {user.name || user.email}
                  </span>
                  <IconChevronDown className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                </button>

                {accountMenuOpen ? (
                  <div
                    role="menu"
                    className="absolute right-0 mt-1.5 w-56 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-elevated)] p-1 shadow-[var(--shadow-md)]"
                  >
                    <div className="border-b border-[var(--border-default)] px-2.5 py-2">
                      {user.name ? (
                        <div className="truncate text-[12px] font-semibold text-[var(--text-primary)]">
                          {user.name}
                        </div>
                      ) : null}
                      <div className="truncate text-[11px] text-[var(--text-muted)]">
                        {user.email}
                      </div>
                    </div>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setAccountMenuOpen(false);
                        onNavigate('settings');
                      }}
                      className="mt-1 flex w-full items-center gap-2 rounded-[var(--radius-sm)] px-2.5 py-1.5 text-left text-[12px] text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
                    >
                      <IconSettings className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                      Settings
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setAccountMenuOpen(false);
                        onLogout();
                      }}
                      className="flex w-full items-center gap-2 rounded-[var(--radius-sm)] px-2.5 py-1.5 text-left text-[12px] text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
                    >
                      <IconLogOut className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                      Sign out
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          {showConnectionWarning ? (
            <div
              role="status"
              className="border-t border-[var(--border-default)] bg-[var(--status-warning-bg)] px-4 py-2 text-[12px] text-[var(--status-warning-text)] sm:px-6"
            >
              <div className="mx-auto flex max-w-[1200px] items-center gap-2">
                <IconAlertTriangle className="h-3.5 w-3.5 shrink-0" />
                <span>
                  {apiUnreachable
                    ? 'Unable to reach the MailTrack API. Some data may be outdated.'
                    : 'MailTrack API is reporting degraded connectivity. Pixel recording or database queries may be delayed.'}
                </span>
              </div>
            </div>
          ) : null}
        </header>

        <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-5 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
