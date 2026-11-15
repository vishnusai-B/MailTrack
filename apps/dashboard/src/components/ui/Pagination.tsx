import { Button } from './Button.js';
import { SELECT_CLASS } from './Card.js';

interface PaginationBarProps {
  page: number;
  totalPages: number;
  totalItems: number;
  itemLabel?: string;
  pageSize?: number;
  onPageSizeChange?: (nextSize: number) => void;
  onPageChange: (nextPage: number) => void;
}

const PAGE_SIZES = [15, 25, 50];

export function PaginationBar({
  page,
  totalPages,
  totalItems,
  itemLabel = 'items',
  pageSize,
  onPageSizeChange,
  onPageChange,
}: PaginationBarProps) {
  const safeTotalPages = Math.max(totalPages, 1);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-default)] px-4 py-2.5">
      <div className="flex flex-wrap items-center gap-3 text-[12px] text-[var(--text-muted)] tabular-nums">
        <span>
          Showing page <span className="font-medium text-[var(--text-primary)]">{page}</span> of{' '}
          <span className="font-medium text-[var(--text-primary)]">{safeTotalPages}</span> (
          {totalItems} {itemLabel})
        </span>
        {pageSize !== undefined && onPageSizeChange ? (
          <label className="inline-flex items-center gap-1.5">
            <span>Rows</span>
            <select
              aria-label="Rows per page"
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className={`${SELECT_CLASS} h-7 px-2 text-[12px]`}
            >
              {PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      <div className="flex items-center gap-1.5">
        <Button
          size="sm"
          variant="secondary"
          disabled={page <= 1}
          onClick={() => onPageChange(Math.max(1, page - 1))}
        >
          Previous
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={page >= safeTotalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
