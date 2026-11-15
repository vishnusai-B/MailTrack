import { useCallback, useEffect, useRef, useState } from 'react';
import type { HealthCheckResponse, User } from '@mailtrack/shared';
import { AuthScreen } from './components/AuthScreen.js';
import { CommandPalette } from './components/CommandPalette.js';
import { EmailDetailDrawer } from './components/EmailDetailDrawer.js';
import { Layout, type NavSection } from './components/Layout.js';
import { ToastContainer, type ToastMessage } from './components/Toast.js';
import { apiClient, clearStoredToken, getStoredToken, setUnauthorizedHandler } from './lib/api.js';
import {
  applyColorSchemePreference,
  getColorSchemePreference,
  type ColorSchemePreference,
} from './lib/theme.js';
import { ActivityPage } from './pages/ActivityPage.js';
import { AnalyticsPage } from './pages/AnalyticsPage.js';
import { CampaignDetailPage } from './pages/CampaignDetailPage.js';
import { CampaignsPage } from './pages/CampaignsPage.js';
import { OverviewPage } from './pages/OverviewPage.js';
import { RemindersPage } from './pages/RemindersPage.js';
import { SettingsPage } from './pages/SettingsPage.js';
import { TrackedEmailsPage } from './pages/TrackedEmailsPage.js';

const SECTION_TITLES: Record<NavSection, string> = {
  overview: 'Overview',
  emails: 'Tracked Emails',
  campaigns: 'Campaigns',
  reminders: 'Reminders',
  activity: 'Activity',
  analytics: 'Analytics',
  settings: 'Settings',
};

const SECTION_SUBTITLES: Record<NavSection, string> = {
  overview: 'Sent volume, pixel signals, and follow-ups',
  emails: 'Inspect tracked threads, filter activity, and assign campaigns',
  campaigns: 'Organize outreach into grouped campaigns',
  reminders: 'Follow-up schedule across tracked emails',
  activity: 'Chronological log of pixel requests',
  analytics: 'Signal trends, classifications, and active windows',
  settings: 'Profile, appearance, tracking defaults, and privacy',
};

const SHORTCUT_MAP: Record<string, NavSection> = {
  o: 'overview',
  e: 'emails',
  c: 'campaigns',
  r: 'reminders',
  a: 'activity',
  n: 'analytics',
  s: 'settings',
};

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [sessionMessage, setSessionMessage] = useState<string | null>(null);
  const [health, setHealth] = useState<HealthCheckResponse | null>(null);
  const [apiUnreachable, setApiUnreachable] = useState(false);

  const [activeSection, setActiveSection] = useState<NavSection>('overview');
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [emailsRefreshSignal, setEmailsRefreshSignal] = useState(0);

  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [themePreference, setThemePreference] = useState<ColorSchemePreference>(() =>
    getColorSchemePreference(),
  );
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const gPressedAtRef = useRef<number>(0);

  const pushToast = useCallback((tone: ToastMessage['tone'], text: string) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((prev) => [...prev, { id, tone, text }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const handleChangeTheme = useCallback((pref: ColorSchemePreference) => {
    applyColorSchemePreference(pref);
    setThemePreference(pref);
  }, []);

  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === 'color-scheme') {
        const next = getColorSchemePreference();
        applyColorSchemePreference(next);
        setThemePreference(next);
      }
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null);
      setSelectedEmailId(null);
      setSelectedCampaignId(null);
      setSessionMessage('Your session has expired or is invalid. Please sign in again.');
      pushToast('error', 'Session expired. Please sign in again.');
    });
    return () => setUnauthorizedHandler(null);
  }, [pushToast]);

  useEffect(() => {
    const controller = new AbortController();

    apiClient
      .getHealth(controller.signal)
      .then((res) => {
        setHealth(res);
        setApiUnreachable(false);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setApiUnreachable(true);
      });

    const token = getStoredToken();
    if (!token) {
      setAuthChecking(false);
      return () => controller.abort();
    }

    apiClient
      .getMe(controller.signal)
      .then((res) => {
        setUser(res.user);
        setSessionMessage(null);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        clearStoredToken();
        setUser(null);
      })
      .finally(() => {
        setAuthChecking(false);
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!user) return;

    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((open) => !open);
        return;
      }

      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || target?.isContentEditable) {
        return;
      }
      if (commandPaletteOpen) return;

      const key = e.key.toLowerCase();
      if (key === 'g' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        gPressedAtRef.current = Date.now();
        return;
      }

      if (Date.now() - gPressedAtRef.current < 900 && SHORTCUT_MAP[key]) {
        e.preventDefault();
        gPressedAtRef.current = 0;
        const nextSection = SHORTCUT_MAP[key];
        setActiveSection(nextSection);
        setSelectedCampaignId(null);
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [user, commandPaletteOpen]);

  function handleAuthenticated(authenticatedUser: User) {
    setUser(authenticatedUser);
    setSessionMessage(null);
    setActiveSection('overview');
    setSelectedEmailId(null);
    setSelectedCampaignId(null);
    pushToast('success', `Signed in as ${authenticatedUser.email}`);
  }

  function handleLogout() {
    void apiClient.logout();
    setUser(null);
    setSelectedEmailId(null);
    setSelectedCampaignId(null);
    setSessionMessage(null);
    pushToast('info', 'Signed out.');
  }

  function handleNavigate(section: NavSection) {
    setActiveSection(section);
    setSelectedCampaignId(null);
  }

  function handleSelectEmail(emailId: string) {
    setSelectedEmailId(emailId);
  }

  function handleSelectCampaign(campaignId: string) {
    setActiveSection('campaigns');
    setSelectedCampaignId(campaignId);
  }

  if (authChecking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg-canvas)] text-[13px] text-[var(--text-muted)]">
        Verifying session...
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <AuthScreen onAuthenticated={handleAuthenticated} sessionMessage={sessionMessage} />
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      </>
    );
  }

  const pageTitle =
    activeSection === 'campaigns' && selectedCampaignId
      ? 'Campaign Details'
      : SECTION_TITLES[activeSection];

  const pageSubtitle =
    activeSection === 'campaigns' && selectedCampaignId
      ? 'Campaign metrics, member emails, and follow-up reminders'
      : SECTION_SUBTITLES[activeSection];

  return (
    <>
      <Layout
        activeSection={activeSection}
        pageTitle={pageTitle}
        pageSubtitle={pageSubtitle}
        user={user}
        health={health}
        apiUnreachable={apiUnreachable}
        onNavigate={handleNavigate}
        onOpenCommandPalette={() => setCommandPaletteOpen(true)}
        onLogout={handleLogout}
      >
        {activeSection === 'overview' ? (
          <OverviewPage
            onSelectEmail={handleSelectEmail}
            onNavigateEmails={() => handleNavigate('emails')}
            onNavigateActivity={() => handleNavigate('activity')}
            onNavigateReminders={() => handleNavigate('reminders')}
          />
        ) : null}

        {activeSection === 'emails' ? (
          <TrackedEmailsPage
            onSelectEmail={handleSelectEmail}
            onNotify={pushToast}
            refreshSignal={emailsRefreshSignal}
          />
        ) : null}

        {activeSection === 'campaigns' && !selectedCampaignId ? (
          <CampaignsPage onSelectCampaign={handleSelectCampaign} onNotify={pushToast} />
        ) : null}

        {activeSection === 'campaigns' && selectedCampaignId ? (
          <CampaignDetailPage
            campaignId={selectedCampaignId}
            onBack={() => setSelectedCampaignId(null)}
            onSelectEmail={handleSelectEmail}
            onNotify={pushToast}
          />
        ) : null}

        {activeSection === 'reminders' ? (
          <RemindersPage onSelectEmail={handleSelectEmail} onNotify={pushToast} />
        ) : null}

        {activeSection === 'activity' ? (
          <ActivityPage onSelectEmail={handleSelectEmail} onNotify={pushToast} />
        ) : null}

        {activeSection === 'analytics' ? <AnalyticsPage /> : null}

        {activeSection === 'settings' ? (
          <SettingsPage
            user={user}
            health={health}
            themePreference={themePreference}
            onChangeTheme={handleChangeTheme}
            onLogout={handleLogout}
            onNotify={pushToast}
          />
        ) : null}
      </Layout>

      <EmailDetailDrawer
        emailId={selectedEmailId}
        onClose={() => setSelectedEmailId(null)}
        onNotify={pushToast}
        onUpdated={() => setEmailsRefreshSignal((n) => n + 1)}
      />

      <CommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onNavigate={handleNavigate}
        onSelectEmail={handleSelectEmail}
        onSetTheme={handleChangeTheme}
        onLogout={handleLogout}
      />

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}
