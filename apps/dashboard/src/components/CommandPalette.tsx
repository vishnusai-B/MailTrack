import { useEffect, useMemo, useRef, useState } from 'react';
import type { TrackedEmail } from '@mailtrack/shared';
import { apiClient } from '../lib/api.js';
import type { ColorSchemePreference } from '../lib/theme.js';
import { IconMail, IconSearch, IconX } from './Icons.js';
import type { NavSection } from './Layout.js';

interface CommandItem {
  id: string;
  group: 'Navigate' | 'Tracked emails' | 'Actions';
  label: string;
  hint?: string;
  onSelect: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onNavigate: (section: NavSection) => void;
  onSelectEmail: (emailId: string) => void;
  onSetTheme: (pref: ColorSchemePreference) => void;
  onLogout: () => void;
}

const NAV_COMMANDS: Array<{ id: NavSection; label: string; shortcut: string }> = [
  { id: 'overview', label: 'Go to Overview', shortcut: 'G O' },
  { id: 'emails', label: 'Go to Tracked Emails', shortcut: 'G E' },
  { id: 'campaigns', label: 'Go to Campaigns', shortcut: 'G C' },
  { id: 'reminders', label: 'Go to Reminders', shortcut: 'G R' },
  { id: 'activity', label: 'Go to Activity', shortcut: 'G A' },
  { id: 'analytics', label: 'Go to Analytics', shortcut: 'G N' },
  { id: 'settings', label: 'Go to Settings', shortcut: 'G S' },
];

export function CommandPalette({
  open,
  onClose,
  onNavigate,
  onSelectEmail,
  onSetTheme,
  onLogout,
}: CommandPaletteProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState('');
  const [emails, setEmails] = useState<TrackedEmail[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open) {
      setQuery('');
      setActiveIndex(0);
      if (typeof el.showModal === 'function') {
        if (!el.open) el.showModal();
      } else {
        el.setAttribute('open', '');
      }
      window.setTimeout(() => inputRef.current?.focus(), 0);
    } else if (el.open) {
      if (typeof el.close === 'function') {
        el.close();
      } else {
        el.removeAttribute('open');
      }
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      apiClient
        .listTrackedEmails(
          { page: 1, limit: 5, search: query.trim() || undefined },
          controller.signal,
        )
        .then((res) => setEmails(res.items))
        .catch(() => setEmails([]));
    }, 150);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [open, query]);

  const items = useMemo<CommandItem[]>(() => {
    const q = query.trim().toLowerCase();

    const navItems: CommandItem[] = NAV_COMMANDS.filter(
      (n) => !q || n.label.toLowerCase().includes(q),
    ).map((n) => ({
      id: `nav-${n.id}`,
      group: 'Navigate',
      label: n.label,
      hint: n.shortcut,
      onSelect: () => {
        onNavigate(n.id);
        onClose();
      },
    }));

    const emailItems: CommandItem[] = emails.map((email) => ({
      id: `email-${email.id}`,
      group: 'Tracked emails',
      label: email.subject?.trim() || 'No subject',
      hint: email.recipientReference,
      onSelect: () => {
        onSelectEmail(email.id);
        onClose();
      },
    }));

    const actionItems: CommandItem[] = [
      {
        id: 'theme-light',
        group: 'Actions' as const,
        label: 'Switch to light mode',
        onSelect: () => {
          onSetTheme('light');
          onClose();
        },
      },
      {
        id: 'theme-dark',
        group: 'Actions' as const,
        label: 'Switch to dark mode',
        onSelect: () => {
          onSetTheme('dark');
          onClose();
        },
      },
      {
        id: 'theme-system',
        group: 'Actions' as const,
        label: 'Use system theme',
        onSelect: () => {
          onSetTheme('system');
          onClose();
        },
      },
      {
        id: 'logout',
        group: 'Actions' as const,
        label: 'Sign out',
        onSelect: () => {
          onLogout();
          onClose();
        },
      },
    ].filter((a) => !q || a.label.toLowerCase().includes(q));

    return [...emailItems, ...navItems, ...actionItems];
  }, [query, emails, onNavigate, onSelectEmail, onSetTheme, onLogout, onClose]);

  useEffect(() => {
    setActiveIndex(0);
  }, [items.length]);

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      aria-label="Command palette"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
      className="mx-auto mt-16 w-[calc(100%-24px)] max-w-lg rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-elevated)] p-0 text-[var(--text-primary)] shadow-[var(--shadow-md)]"
    >
      <div className="flex items-center gap-2.5 border-b border-[var(--border-default)] px-3.5 py-2.5">
        <IconSearch className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActiveIndex((i) => (items.length ? (i + 1) % items.length : 0));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActiveIndex((i) => (items.length ? (i - 1 + items.length) % items.length : 0));
            } else if (e.key === 'Enter' && items[activeIndex]) {
              e.preventDefault();
              items[activeIndex].onSelect();
            }
          }}
          placeholder="Search tracked emails or jump to a page..."
          aria-label="Search commands and tracked emails"
          className="w-full bg-transparent text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none"
        />
        <button
          type="button"
          onClick={onClose}
          aria-label="Close command palette"
          className="rounded-[var(--radius-sm)] p-1 text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
        >
          <IconX className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="max-h-80 overflow-y-auto p-1.5" role="listbox" aria-label="Results">
        {items.length === 0 ? (
          <div className="px-3 py-6 text-center text-[12px] text-[var(--text-muted)]">
            No matching commands or emails.
          </div>
        ) : (
          items.map((item, idx) => {
            const active = idx === activeIndex;
            const showGroupHeader = idx === 0 || items[idx - 1]?.group !== item.group;
            return (
              <div key={item.id}>
                {showGroupHeader ? (
                  <div className="px-2.5 pt-2 pb-1 text-[11px] font-medium text-[var(--text-muted)]">
                    {item.group}
                  </div>
                ) : null}
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={item.onSelect}
                  className={`flex w-full items-center justify-between gap-3 rounded-[var(--radius-sm)] px-2.5 py-2 text-left text-[13px] transition-colors duration-100 ${
                    active
                      ? 'bg-[var(--bg-active)] text-[var(--accent-text)]'
                      : 'text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-2 truncate">
                    {item.group === 'Tracked emails' ? (
                      <IconMail className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" />
                    ) : null}
                    <span className="truncate font-medium">{item.label}</span>
                  </span>
                  {item.hint ? (
                    <span className="shrink-0 text-[11px] text-[var(--text-muted)]">
                      {item.hint}
                    </span>
                  ) : null}
                </button>
              </div>
            );
          })
        )}
      </div>

      <div className="flex items-center justify-between border-t border-[var(--border-default)] px-3.5 py-2 text-[11px] text-[var(--text-muted)]">
        <span>Use ↑↓ to navigate, Enter to select</span>
        <span>Esc to close</span>
      </div>
    </dialog>
  );
}
