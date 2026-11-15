import { useCallback, useEffect, useState } from 'react';
import type { HealthCheckResponse, User } from '@mailtrack/shared';
import { AuthScreen } from './components/AuthScreen.js';
import { Layout, type NavSection } from './components/Layout.js';
import { ToastContainer, type ToastMessage } from './components/Toast.js';
import { apiClient, clearStoredToken, getStoredToken, setUnauthorizedHandler } from './lib/api.js';
import { ActivityPage } from './pages/ActivityPage.js';
import { AnalyticsPage } from './pages/AnalyticsPage.js';
import { CampaignDetailPage } from './pages/CampaignDetailPage.js';
import { CampaignsPage } from './pages/CampaignsPage.js';
import { EmailDetailPage } from './pages/EmailDetailPage.js';
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

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [sessionMessage, setSessionMessage] = useState<string | null>(null);
  const [health, setHealth] = useState<HealthCheckResponse | null>(null);

  const [activeSection, setActiveSection] = useState<NavSection>('overview');
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

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
      .then((res) => setHealth(res))
      .catch(() => {
        // Health indicator remains hidden if backend is unreachable
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
    setSelectedEmailId(null);
    setSelectedCampaignId(null);
  }

  function handleSelectEmail(emailId: string) {
    setActiveSection('emails');
    setSelectedEmailId(emailId);
    setSelectedCampaignId(null);
  }

  function handleSelectCampaign(campaignId: string) {
    setActiveSection('campaigns');
    setSelectedCampaignId(campaignId);
    setSelectedEmailId(null);
  }

  if (authChecking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500">
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

  const pageTitle = selectedEmailId
    ? 'Email Details'
    : selectedCampaignId
      ? 'Campaign Details'
      : SECTION_TITLES[activeSection];

  return (
    <>
      <Layout
        activeSection={activeSection}
        pageTitle={pageTitle}
        user={user}
        health={health}
        onNavigate={handleNavigate}
        onLogout={handleLogout}
      >
        {selectedEmailId ? (
          <EmailDetailPage
            emailId={selectedEmailId}
            onBack={() => setSelectedEmailId(null)}
            onNotify={pushToast}
          />
        ) : selectedCampaignId ? (
          <CampaignDetailPage
            campaignId={selectedCampaignId}
            onBack={() => setSelectedCampaignId(null)}
            onSelectEmail={handleSelectEmail}
            onNotify={pushToast}
          />
        ) : activeSection === 'overview' ? (
          <OverviewPage
            onSelectEmail={handleSelectEmail}
            onNavigateEmails={() => handleNavigate('emails')}
            onNavigateActivity={() => handleNavigate('activity')}
          />
        ) : activeSection === 'emails' ? (
          <TrackedEmailsPage onSelectEmail={handleSelectEmail} onNotify={pushToast} />
        ) : activeSection === 'campaigns' ? (
          <CampaignsPage onSelectCampaign={handleSelectCampaign} onNotify={pushToast} />
        ) : activeSection === 'reminders' ? (
          <RemindersPage onSelectEmail={handleSelectEmail} onNotify={pushToast} />
        ) : activeSection === 'activity' ? (
          <ActivityPage onSelectEmail={handleSelectEmail} onNotify={pushToast} />
        ) : activeSection === 'analytics' ? (
          <AnalyticsPage />
        ) : (
          <SettingsPage user={user} health={health} />
        )}
      </Layout>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}
