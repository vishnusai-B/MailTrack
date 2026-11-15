import { useState, type FormEvent } from 'react';
import type { User } from '@mailtrack/shared';
import { ApiError, apiClient, getApiBaseUrl, setStoredToken } from '../lib/api.js';
import { IconCheck, IconEye, IconEyeOff, IconMail } from './Icons.js';
import { Button } from './ui/Button.js';
import { INPUT_CLASS } from './ui/Card.js';

interface AuthScreenProps {
  onAuthenticated: (user: User) => void;
  sessionMessage?: string | null;
}

const HIGHLIGHTS = [
  'Pixel request recording with proxy and scanner classification',
  'Organize outreach into campaigns with per-campaign metrics',
  'Schedule follow-up reminders directly on tracked emails',
  'Export filtered activity and email logs to CSV',
];

export function AuthScreen({ onAuthenticated, sessionMessage }: AuthScreenProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError('Enter both your email address and password.');
      return;
    }
    setLoading(true);
    try {
      const response =
        mode === 'login'
          ? await apiClient.login(email.trim(), password)
          : await apiClient.register(email.trim(), password, name.trim() || undefined);

      setStoredToken(response.accessToken, response.refreshToken);
      onAuthenticated(response.user);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError(
          import.meta.env.DEV
            ? `Unable to reach the API server at ${getApiBaseUrl()}. Start the backend server (npm run dev:server) and try again.`
            : 'Unable to reach the authentication server. Wait a moment and try again.',
        );
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)] lg:grid-cols-12">
      {/* Product Context Panel (Desktop) */}
      <aside className="hidden flex-col justify-between border-r border-[var(--border-default)] bg-[var(--bg-subtle)] p-10 lg:col-span-5 lg:flex xl:p-14">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] bg-[var(--accent)] text-white">
            <IconMail className="h-4 w-4" />
          </div>
          <span className="text-[15px] font-semibold tracking-tight text-[var(--text-primary)]">
            MailTrack
          </span>
        </div>

        <div className="max-w-md space-y-6">
          <div>
            <h2 className="text-[24px] font-semibold tracking-tight text-[var(--text-primary)]">
              Clear email tracking for Gmail.
            </h2>
            <p className="mt-2 text-[14px] leading-relaxed text-[var(--text-secondary)]">
              Monitor pixel activity, separate proxy fetches from likely human opens, and keep
              follow-ups on schedule.
            </p>
          </div>

          <ul className="space-y-3 border-t border-[var(--border-default)] pt-6">
            {HIGHLIGHTS.map((item) => (
              <li
                key={item}
                className="flex items-start gap-2.5 text-[13px] text-[var(--text-secondary)]"
              >
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent-text)]">
                  <IconCheck className="h-2.5 w-2.5" />
                </span>
                <span className="leading-relaxed">{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="text-[12px] text-[var(--text-muted)]">MailTrack Workspace</div>
      </aside>

      {/* Auth Form Column */}
      <main className="flex flex-col items-center justify-center px-4 py-10 sm:px-8 lg:col-span-7">
        <div className="w-full max-w-[380px]">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <div className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] bg-[var(--accent)] text-white">
              <IconMail className="h-4 w-4" />
            </div>
            <span className="text-[15px] font-semibold tracking-tight text-[var(--text-primary)]">
              MailTrack
            </span>
          </div>

          <div className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-6 shadow-[var(--shadow-sm)] sm:p-7">
            <h1 className="text-[20px] font-semibold tracking-tight text-[var(--text-primary)]">
              {mode === 'login' ? 'Sign in to your dashboard' : 'Create a MailTrack account'}
            </h1>
            <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
              {mode === 'login'
                ? 'Enter your credentials to view tracked emails and activity.'
                : 'Register an account to link the Gmail Chrome extension.'}
            </p>

            {sessionMessage && !error ? (
              <div
                role="status"
                className="mt-4 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--status-warning-bg)] px-3 py-2 text-[12px] text-[var(--status-warning-text)]"
              >
                {sessionMessage}
              </div>
            ) : null}

            {error ? (
              <div
                role="alert"
                className="mt-4 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--status-danger-bg)] px-3 py-2 text-[12px] text-[var(--status-danger-text)]"
              >
                {error}
              </div>
            ) : null}

            <form onSubmit={handleSubmit} className="mt-5 space-y-4" noValidate>
              {mode === 'register' ? (
                <div>
                  <label
                    htmlFor="auth-name"
                    className="block text-[12px] font-medium text-[var(--text-secondary)]"
                  >
                    Name (optional)
                  </label>
                  <input
                    id="auth-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Alex Rivera"
                    autoComplete="name"
                    className={`${INPUT_CLASS} mt-1.5 h-9`}
                  />
                </div>
              ) : null}

              <div>
                <label
                  htmlFor="auth-email"
                  className="block text-[12px] font-medium text-[var(--text-secondary)]"
                >
                  Email address
                </label>
                <input
                  id="auth-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  autoComplete="email"
                  className={`${INPUT_CLASS} mt-1.5 h-9`}
                />
              </div>

              <div>
                <label
                  htmlFor="auth-password"
                  className="block text-[12px] font-medium text-[var(--text-secondary)]"
                >
                  Password
                </label>
                <div className="relative mt-1.5">
                  <input
                    id="auth-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={mode === 'register' ? 'At least 8 characters' : '••••••••'}
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    className={`${INPUT_CLASS} h-9 pr-9`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute inset-y-0 right-0 flex items-center px-2.5 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  >
                    {showPassword ? (
                      <IconEyeOff className="h-4 w-4" />
                    ) : (
                      <IconEye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                variant="primary"
                loading={loading}
                className="h-9 w-full text-[13px]"
              >
                {loading
                  ? mode === 'login'
                    ? 'Signing in...'
                    : 'Creating account...'
                  : mode === 'login'
                    ? 'Sign in'
                    : 'Create account'}
              </Button>
            </form>

            <div className="mt-5 border-t border-[var(--border-default)] pt-4 text-center text-[12px] text-[var(--text-secondary)]">
              {mode === 'login' ? (
                <>
                  Need an account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setMode('register');
                      setError(null);
                    }}
                    className="font-medium text-[var(--accent-text)] hover:underline"
                  >
                    Create one
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setMode('login');
                      setError(null);
                    }}
                    className="font-medium text-[var(--accent-text)] hover:underline"
                  >
                    Sign in
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
