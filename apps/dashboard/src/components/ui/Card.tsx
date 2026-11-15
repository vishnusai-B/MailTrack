import type { ReactNode } from 'react';

export function SurfaceCard({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-surface)] shadow-[var(--shadow-sm)] ${className}`}
    >
      {children}
    </div>
  );
}

export function SectionHeader({
  title,
  description,
  action,
  className = '',
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-default)] px-4 py-3 ${className}`}
    >
      <div className="min-w-0">
        <h2 className="text-[14px] font-semibold text-[var(--text-primary)]">{title}</h2>
        {description ? (
          <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export const INPUT_CLASS =
  'h-8 w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)] px-2.5 text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] transition-[border-color,background-color] duration-150 ease-out hover:border-[var(--border-strong)] focus:border-[var(--accent)] focus:outline-none disabled:opacity-50';

export const SELECT_CLASS =
  'h-8 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)] px-2.5 text-[13px] text-[var(--text-primary)] transition-[border-color,background-color] duration-150 ease-out hover:border-[var(--border-strong)] focus:border-[var(--accent)] focus:outline-none disabled:opacity-50';
