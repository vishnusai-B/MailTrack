import { IconAlertCircle, IconCheck, IconX } from './Icons.js';

export interface ToastMessage {
  id: number;
  tone: 'info' | 'error' | 'success';
  text: string;
}

const TONE_CLASSES: Record<ToastMessage['tone'], string> = {
  info: 'border-neutral-200 bg-white text-neutral-900',
  success: 'border-emerald-200 bg-white text-neutral-900',
  error: 'border-rose-200 bg-white text-neutral-900',
};

const ICON_CLASSES: Record<ToastMessage['tone'], string> = {
  info: 'bg-neutral-100 text-neutral-600',
  success: 'bg-emerald-50 text-emerald-600',
  error: 'bg-rose-50 text-rose-600',
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
    <div aria-live="polite" className="fixed right-4 bottom-4 z-50 flex max-w-sm flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          className={`flex items-center gap-3 rounded-xl border px-3.5 py-2.5 text-xs font-medium shadow-lg ${TONE_CLASSES[toast.tone]}`}
        >
          <span
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${ICON_CLASSES[toast.tone]}`}
          >
            {toast.tone === 'success' ? (
              <IconCheck className="h-3.5 w-3.5" />
            ) : (
              <IconAlertCircle className="h-3.5 w-3.5" />
            )}
          </span>
          <span className="flex-1 leading-snug">{toast.text}</span>
          <button
            type="button"
            onClick={() => onDismiss(toast.id)}
            aria-label="Dismiss notification"
            className="rounded-md p-1 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700"
          >
            <IconX className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
