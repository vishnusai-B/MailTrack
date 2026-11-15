export type ColorSchemePreference = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'color-scheme';

export function getColorSchemePreference(): ColorSchemePreference {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') {
      return stored;
    }
  } catch {
    // Ignore storage errors
  }
  return 'system';
}

export function applyColorSchemePreference(pref: ColorSchemePreference): void {
  const meta = document.querySelector('meta[name="color-scheme"]');
  const content = pref === 'system' ? 'light dark' : pref;
  if (meta) {
    meta.setAttribute('content', content);
  }
  try {
    if (pref === 'system') {
      window.localStorage.removeItem(STORAGE_KEY);
    } else {
      window.localStorage.setItem(STORAGE_KEY, pref);
    }
  } catch {
    // Ignore storage errors
  }
}

export function getResolvedSystemScheme(): 'light' | 'dark' {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'light';
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
