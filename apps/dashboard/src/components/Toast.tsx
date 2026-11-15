import { IconX } from './Icons.js';

export interface ToastMessage {
  id: number;
  tone: 'info' | 'error' | 'success';
  text: string;
}

const TONE_CLASSES: Record<ToastMessage['tone'], string> = {
  info: 'border-slate-200 bg-white text-slate-900',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  error: 'border-rose-200 bg-rose-50 text-rose-900',
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
          className={`flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-sm shadow-lg ${TONE_CLASSES[toast.tone]}`}
        >
          <span>{toast.text}</span>
          <button
            type="button"
            onClick={() => onDismiss(toast.id)}
            aria-label="Dismiss notification"
            className="rounded p-0.5 text-current/70 hover:text-current"
          >
            <IconX className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
