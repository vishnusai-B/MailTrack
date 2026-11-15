export function CardSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
      aria-busy="true"
      aria-label="Loading summary metrics"
    >
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="animate-pulse rounded-xl border border-neutral-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]"
        >
          <div className="h-3 w-24 rounded bg-neutral-200/80" />
          <div className="mt-3 h-7 w-16 rounded bg-neutral-200/80" />
          <div className="mt-2 h-2.5 w-32 rounded bg-neutral-100" />
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div
      className="overflow-hidden rounded-xl border border-neutral-200/80 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]"
      aria-busy="true"
      aria-label="Loading table data"
    >
      <div className="divide-y divide-neutral-100">
        {Array.from({ length: rows }).map((_, rIdx) => (
          <div key={rIdx} className="flex animate-pulse items-center gap-4 px-5 py-3.5">
            {Array.from({ length: cols }).map((__, cIdx) => (
              <div
                key={cIdx}
                className={`h-3.5 rounded bg-neutral-200/80 ${cIdx === 0 ? 'w-1/4' : 'flex-1'}`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div
      className="animate-pulse rounded-xl border border-neutral-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]"
      aria-busy="true"
      aria-label="Loading chart"
    >
      <div className="h-4 w-40 rounded bg-neutral-200/80" />
      <div className="mt-2 h-3 w-64 rounded bg-neutral-100" />
      <div className="mt-6 h-48 w-full rounded-lg bg-neutral-100" />
    </div>
  );
}
