import type { ReactNode } from 'react';

export function SurfaceCard({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-xl border border-neutral-200/80 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)] ${className}`}
    >
      {children}
    </section>
  );
}

export function SectionHeader({
  title,
  description,
  actions,
  className = '',
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 px-5 py-4 ${className}`}
    >
      <div className="min-w-0">
        <h2 className="text-sm font-semibold tracking-tight text-neutral-900">{title}</h2>
        {description ? <p className="mt-0.5 text-xs text-neutral-500">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export const INPUT_CLASS =
  'block h-9 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-900 placeholder:text-neutral-400 shadow-2xs transition focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15 focus:outline-none disabled:bg-neutral-50 disabled:text-neutral-500';

export const SELECT_CLASS =
  'block h-9 w-full rounded-lg border border-neutral-200 bg-white px-3 text-xs font-medium text-neutral-900 shadow-2xs transition focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15 focus:outline-none disabled:bg-neutral-50 disabled:text-neutral-500';
