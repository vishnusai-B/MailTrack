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
        <span className="brand">MailTrack</span>
        <span className="badge">{prefs?.authenticated ? 'Signed In' : 'Sign In Required'}</span>
      </div>

      {error && <div className="error">{error}</div>}

      {!prefs ? (
        <p className="muted">Connecting to service worker...</p>
      ) : prefs.authenticated ? (
        <>
          <div className="muted" style={{ marginBottom: 8 }}>
            Account: <strong>{prefs.userEmail}</strong>
          </div>

          <div className="row">
            <div>
              <div className="row-title">Default for new drafts</div>
              <div className="muted">Does not change already-open Gmail drafts.</div>
            </div>
            <input
              type="checkbox"
              aria-label="Enable tracking by default for new drafts"
              checked={prefs.defaultTrackingEnabled}
              disabled={busy}
              onChange={() => void handleToggleDefault()}
            />
          </div>

          <p className="muted" style={{ marginBottom: 10 }}>
            Use the <strong>Track: ON / OFF</strong> pill in any Gmail compose window to control
            tracking per email.
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
          <button
            type="button"
            className="btn btn-link"
            onClick={() => {
              setError(null);
              setMode(mode === 'login' ? 'register' : 'login');
            }}
          >
            {mode === 'login' ? 'Need an account? Sign up' : 'Already have an account? Sign in'}
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
