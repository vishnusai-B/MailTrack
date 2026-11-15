import type { ReactNode } from 'react';
import { IconInbox } from './Icons.js';

interface EmptyStateProps {
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-neutral-200 bg-white px-6 py-12 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-neutral-200/80 bg-neutral-50 text-neutral-500">
        <IconInbox className="h-5 w-5" />
      </div>
      <h3 className="mt-3.5 text-sm font-semibold text-neutral-900">{title}</h3>
      <p className="mt-1 max-w-sm text-xs leading-relaxed text-neutral-500">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
