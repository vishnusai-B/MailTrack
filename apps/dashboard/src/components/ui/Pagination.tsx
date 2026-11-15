import { IconChevronLeft, IconChevronRight } from '../Icons.js';

interface PaginationBarProps {
  page: number;
  totalPages: number;
  total: number;
  unitLabel?: string;
  onPageChange: (nextPage: number) => void;
}

export function PaginationBar({
  page,
  totalPages,
  total,
  unitLabel = 'total',
  onPageChange,
}: PaginationBarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 bg-neutral-50/60 px-5 py-3 text-xs text-neutral-500">
      <div>
        Showing page <span className="font-semibold text-neutral-900 tabular-nums">{page}</span> of{' '}
        <span className="font-semibold text-neutral-900 tabular-nums">{totalPages}</span> (
        <span className="tabular-nums">{total}</span> {unitLabel})
      </div>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(Math.max(1, page - 1))}
          className="inline-flex h-8 items-center gap-1 rounded-lg border border-neutral-200 bg-white px-2.5 text-xs font-medium text-neutral-700 shadow-2xs transition hover:bg-neutral-50 hover:text-neutral-950 disabled:cursor-not-allowed disabled:opacity-45"
        >
          <IconChevronLeft className="h-3.5 w-3.5" />
          Previous
        </button>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          className="inline-flex h-8 items-center gap-1 rounded-lg border border-neutral-200 bg-white px-2.5 text-xs font-medium text-neutral-700 shadow-2xs transition hover:bg-neutral-50 hover:text-neutral-950 disabled:cursor-not-allowed disabled:opacity-45"
        >
          Next
          <IconChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
