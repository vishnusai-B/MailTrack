import { useState, type FormEvent } from 'react';
import type { User } from '@mailtrack/shared';
import { ApiError, apiClient, getApiBaseUrl, setStoredToken } from '../lib/api.js';
import { IconCheck, IconEye, IconEyeOff, IconMail } from './Icons.js';
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
    <div className="grid min-h-screen bg-[#FAFAFB] lg:grid-cols-12">
      {/* Product Context Panel (Desktop) */}
      <aside className="hidden flex-col justify-between border-r border-neutral-200/80 bg-[#F4F5F7] p-10 lg:col-span-5 lg:flex xl:p-14">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-900 text-white shadow-2xs">
            <IconMail className="h-4 w-4 text-blue-400" />
          </div>
          <span className="text-base font-semibold tracking-tight text-neutral-950">MailTrack</span>
        </div>

        <div className="max-w-md space-y-6">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-neutral-950">
              Clear email tracking for Gmail.
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-neutral-600">
              Monitor pixel activity, classify proxy fetches separately from direct loads, and keep
              follow-ups on schedule.
            </p>
          </div>

          <ul className="space-y-3 border-t border-neutral-200/80 pt-6">
            {HIGHLIGHTS.map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-xs text-neutral-700">
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-white text-blue-600 ring-1 ring-neutral-200">
                  <IconCheck className="h-2.5 w-2.5" />
                </span>
                <span className="leading-relaxed">{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="text-xs text-neutral-400">MailTrack Workspace</div>
      </aside>

      {/* Form Panel */}
      <main className="flex flex-col justify-center px-4 py-12 sm:px-6 lg:col-span-7 lg:px-12">
        <div className="mx-auto w-full max-w-[400px]">
          <div className="mb-8 flex items-center justify-center gap-2.5 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-neutral-900 text-white shadow-2xs">
              <IconMail className="h-4 w-4 text-blue-400" />
            </div>
            <span className="text-lg font-semibold tracking-tight text-neutral-950">MailTrack</span>
          </div>

          <div className="rounded-2xl border border-neutral-200/90 bg-white p-7 shadow-[0_1px_3px_rgba(16,24,40,0.05)] sm:p-8">
            <h1 className="text-lg font-semibold tracking-tight text-neutral-950">
              {mode === 'login' ? 'Sign in to your dashboard' : 'Create a MailTrack account'}
            </h1>
            <p className="mt-1 text-xs text-neutral-500">
              {mode === 'login'
                ? 'Enter your credentials to view tracked emails and activity.'
                : 'Register an account to link the Gmail Chrome extension.'}
            </p>

            {sessionMessage ? (
              <div
                role="status"
                className="mt-4 rounded-lg border border-amber-200 bg-amber-50/80 px-3.5 py-2.5 text-xs text-amber-900"
              >
                {sessionMessage}
              </div>
            ) : null}

            {error ? (
              <div
                role="alert"
                className="mt-4 rounded-lg border border-rose-200 bg-rose-50/80 px-3.5 py-2.5 text-xs text-rose-800"
              >
                {error}
              </div>
            ) : null}

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              {mode === 'register' ? (
                <div>
                  <label htmlFor="auth-name" className="block text-xs font-medium text-neutral-700">
                    Name (optional)
                  </label>
                  <input
                    id="auth-name"
                    type="text"
                    autoComplete="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={`${INPUT_CLASS} mt-1.5`}
                    placeholder="Alex Rivera"
                  />
                </div>
              ) : null}

              <div>
                <label htmlFor="auth-email" className="block text-xs font-medium text-neutral-700">
                  Email address
                </label>
                <input
                  id="auth-email"
                  type="email"
                  required
                  autoComplete="email"
                  aria-invalid={error ? 'true' : undefined}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`${INPUT_CLASS} mt-1.5`}
                  placeholder="you@company.com"
                />
              </div>

              <div>
                <label
                  htmlFor="auth-password"
                  className="block text-xs font-medium text-neutral-700"
                >
                  Password
                </label>
                <div className="relative mt-1.5">
                  <input
                    id="auth-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={mode === 'register' ? 8 : 1}
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    aria-invalid={error ? 'true' : undefined}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`${INPUT_CLASS} pr-10`}
                    placeholder={mode === 'register' ? 'Minimum 8 characters' : 'Enter password'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-neutral-400 transition hover:text-neutral-700"
                  >
                    {showPassword ? (
                      <IconEyeOff className="h-4 w-4" />
                    ) : (
                      <IconEye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="flex h-9 w-full items-center justify-center rounded-lg bg-neutral-900 px-4 text-xs font-semibold text-white shadow-xs transition duration-150 hover:bg-neutral-800 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-55"
              >
                {loading
                  ? mode === 'login'
                    ? 'Signing in...'
                    : 'Creating account...'
                  : mode === 'login'
                    ? 'Sign in'
                    : 'Create account'}
              </button>
            </form>

            <div className="mt-6 border-t border-neutral-100 pt-4 text-center text-xs text-neutral-500">
              {mode === 'login' ? (
                <>
                  Need an account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setMode('register');
                      setError(null);
                    }}
                    className="font-semibold text-blue-600 hover:text-blue-700"
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
                    className="font-semibold text-blue-600 hover:text-blue-700"
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
