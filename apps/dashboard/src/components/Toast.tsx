import { IconX } from './Icons.js';

export interface ToastMessage {
  id: number;
  tone: 'info' | 'success' | 'error';
  text: string;
}

const DOT_STYLES: Record<ToastMessage['tone'], string> = {
  info: 'bg-[var(--status-info-dot)]',
  success: 'bg-[var(--status-success-dot)]',
  error: 'bg-[var(--status-danger-dot)]',
};

export function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: ToastMessage[];
  onDismiss: (id: number) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed right-4 bottom-4 z-[var(--z-toast)] flex w-[calc(100%-32px)] max-w-sm flex-col gap-2"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          className="pointer-events-auto flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-3.5 py-2.5 text-[13px] text-[var(--text-primary)] shadow-[var(--shadow-md)]"
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${DOT_STYLES[toast.tone]}`}
              aria-hidden="true"
            />
            <span className="truncate font-medium">{toast.text}</span>
          </div>
          <button
            type="button"
            onClick={() => onDismiss(toast.id)}
            aria-label="Dismiss notification"
            className="shrink-0 rounded-[var(--radius-sm)] p-1 text-[var(--text-muted)] transition-colors duration-150 hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
          >
            <IconX className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
