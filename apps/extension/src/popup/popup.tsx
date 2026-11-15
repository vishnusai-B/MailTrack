import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type {
  ExtensionMessage,
  ExtensionPreferences,
  ExtensionResponse,
} from '../shared/messages.js';

function sendMessage<T>(message: ExtensionMessage): Promise<ExtensionResponse<T>> {
  return chrome.runtime.sendMessage(message);
}

function PopupApp() {
  const [prefs, setPrefs] = useState<ExtensionPreferences | null>(null);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await sendMessage<ExtensionPreferences>({ type: 'GET_PREFERENCES' });
        if (res.ok) {
          setPrefs(res.data);
        } else {
          setError(res.error);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to reach extension service worker');
      }
    })();
  }, []);

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res =
        mode === 'login'
          ? await sendMessage<ExtensionPreferences>({ type: 'LOGIN', email, password })
          : await sendMessage<ExtensionPreferences>({
              type: 'REGISTER',
              email,
              password,
              name: name || undefined,
            });

      if (res.ok) {
        setPrefs(res.data);
        setPassword('');
      } else {
        setError(res.error);
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleDefault() {
    if (!prefs) return;
    setBusy(true);
    setError(null);
    try {
      const res = await sendMessage<ExtensionPreferences>({
        type: 'SET_DEFAULT_TRACKING',
        enabled: !prefs.defaultTrackingEnabled,
      });
      if (res.ok) {
        setPrefs(res.data);
      } else {
        setError(res.error);
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleLogout() {
    setBusy(true);
    setError(null);
    try {
      const res = await sendMessage<ExtensionPreferences>({ type: 'LOGOUT' });
      if (res.ok) {
        setPrefs(res.data);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <div className="header">
        <div className="brand-wrap">
          <span className="brand-icon" aria-hidden="true">
            M
          </span>
          <span className="brand">MailTrack</span>
        </div>
        <span className={`badge ${prefs?.authenticated ? '' : 'badge-muted'}`}>
          {prefs?.authenticated ? 'Connected' : 'Signed out'}
        </span>
      </div>

      {error && <div className="error">{error}</div>}

      {!prefs ? (
        <p className="muted">Connecting to extension...</p>
      ) : prefs.authenticated ? (
        <>
          <div className="account-pill">
            Signed in as <strong>{prefs.userEmail}</strong>
          </div>

          <div className="row">
            <div>
              <div className="row-title">Auto-track new drafts</div>
              <div className="muted">Only applies to newly opened drafts.</div>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                aria-label="Enable tracking by default for new drafts"
                checked={prefs.defaultTrackingEnabled}
                disabled={busy}
                onChange={() => void handleToggleDefault()}
              />
              <span className="slider" aria-hidden="true" />
            </label>
          </div>

          <p className="muted" style={{ marginBottom: 12 }}>
            Toggle <strong>Track: ON / OFF</strong> in Gmail Compose to track individual emails.
          </p>

          <button
            type="button"
            className="btn btn-secondary"
            disabled={busy}
            onClick={() => void handleLogout()}
          >
            Sign Out
          </button>
        </>
      ) : (
        <form onSubmit={(e) => void handleAuth(e)}>
          <div className="tabs" role="tablist" aria-label="Authentication mode">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'login'}
              className={`tab-btn ${mode === 'login' ? 'active' : ''}`}
              onClick={() => {
                setError(null);
                setMode('login');
              }}
            >
              Sign in
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'register'}
              className={`tab-btn ${mode === 'register' ? 'active' : ''}`}
              onClick={() => {
                setError(null);
                setMode('register');
              }}
            >
              Create account
            </button>
          </div>
          {mode === 'register' && (
            <div className="field">
              <label>Name (optional)</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Alex" />
            </div>
          )}
          <div className="field">
            <label>Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
            />
          </div>
          <div className="field">
            <label>Password</label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min 8 characters"
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>
      )}
    </div>
  );
}

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(<PopupApp />);
}
