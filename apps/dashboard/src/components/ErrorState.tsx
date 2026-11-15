import { IconAlertTriangle, IconRefresh } from './Icons.js';
import { Button } from './ui/Button.js';

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export function ErrorState({ title = 'Unable to load data', message, onRetry }: ErrorStateProps) {
  return (
    <div
      role="alert"
      className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-5"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-[var(--status-danger-text)]">
          <IconAlertTriangle className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[14px] font-semibold text-[var(--text-primary)]">{title}</h3>
          <p className="mt-1 text-[13px] text-[var(--text-secondary)]">{message}</p>
          {onRetry ? (
            <div className="mt-3">
              <Button size="sm" variant="secondary" onClick={onRetry}>
                <IconRefresh className="h-3.5 w-3.5" />
                Retry
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
