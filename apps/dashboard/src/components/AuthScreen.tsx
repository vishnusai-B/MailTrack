import { useState, type FormEvent } from 'react';
import type { User } from '@mailtrack/shared';
import { ApiError, apiClient, setStoredToken } from '../lib/api.js';
import { IconMail } from './Icons.js';

interface AuthScreenProps {
  onAuthenticated: (user: User) => void;
  sessionMessage?: string | null;
}

export function AuthScreen({ onAuthenticated, sessionMessage }: AuthScreenProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
        setError('Unable to connect to the authentication server.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col justify-center bg-slate-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-md">
        <div className="flex items-center justify-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-xs">
            <IconMail className="h-5 w-5" />
          </div>
          <span className="text-2xl font-bold tracking-tight text-slate-900">MailTrack</span>
        </div>

        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-lg font-semibold text-slate-900">
            {mode === 'login' ? 'Sign in to your dashboard' : 'Create a MailTrack account'}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {mode === 'login'
              ? 'View tracked emails, pixel request classifications, and analytics.'
              : 'Register an account to connect your MailTrack Chrome extension.'}
          </p>

          {sessionMessage ? (
            <div
              role="status"
              className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900"
            >
              {sessionMessage}
            </div>
          ) : null}

          {error ? (
            <div
              role="alert"
              className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-800"
            >
              {error}
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {mode === 'register' ? (
              <div>
                <label htmlFor="auth-name" className="block text-xs font-medium text-slate-700">
                  Name (optional)
                </label>
                <input
                  id="auth-name"
                  type="text"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-xs focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                  placeholder="Alex Rivera"
                />
              </div>
            ) : null}

            <div>
              <label htmlFor="auth-email" className="block text-xs font-medium text-slate-700">
                Email address
              </label>
              <input
                id="auth-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-xs focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="auth-password" className="block text-xs font-medium text-slate-700">
                Password
              </label>
              <input
                id="auth-password"
                type="password"
                required
                minLength={mode === 'register' ? 8 : 1}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-xs focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                placeholder={mode === 'register' ? 'Minimum 8 characters' : 'Enter your password'}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full justify-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
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

          <div className="mt-6 border-t border-slate-100 pt-4 text-center text-xs text-slate-600">
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
    </div>
  );
}
