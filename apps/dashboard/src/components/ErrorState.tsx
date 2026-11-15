import { IconAlertCircle, IconRefresh } from './Icons.js';

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export function ErrorState({ title = 'Unable to load data', message, onRetry }: ErrorStateProps) {
  return (
    <div
      role="alert"
      className="rounded-2xl border border-rose-200/90 bg-rose-50/70 p-6 text-rose-900"
    >
      <div className="flex items-start gap-3">
        <IconAlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
        <div className="flex-1">
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="mt-1 text-sm text-rose-800">{message}</p>
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-rose-800 shadow-xs ring-1 ring-rose-300 transition hover:bg-rose-50"
            >
              <IconRefresh className="h-3.5 w-3.5" />
              Retry
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
