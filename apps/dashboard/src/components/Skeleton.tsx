export function CardSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div
      className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
      aria-busy="true"
      aria-label="Loading summary metrics"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-4"
        >
          <div className="h-3 w-24 animate-pulse rounded bg-[var(--bg-hover)]" />
          <div className="mt-2.5 h-6 w-14 animate-pulse rounded bg-[var(--bg-hover)]" />
          <div className="mt-2 h-2.5 w-32 animate-pulse rounded bg-[var(--bg-subtle)]" />
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div
      className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-surface)]"
      aria-busy="true"
      aria-label="Loading table rows"
    >
      <div className="border-b border-[var(--border-default)] bg-[var(--bg-subtle)] px-4 py-2.5">
        <div className="h-3 w-40 animate-pulse rounded bg-[var(--bg-hover)]" />
      </div>
      <div className="divide-y divide-[var(--border-default)]">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center justify-between gap-4 px-4 py-3">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div className="h-6 w-6 shrink-0 animate-pulse rounded-full bg-[var(--bg-hover)]" />
              <div className="h-3.5 w-44 animate-pulse rounded bg-[var(--bg-hover)]" />
              <div className="hidden h-3 w-52 animate-pulse rounded bg-[var(--bg-subtle)] sm:block" />
            </div>
            <div className="h-5 w-20 animate-pulse rounded bg-[var(--bg-hover)]" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div
      className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-4"
      aria-busy="true"
      aria-label="Loading chart"
    >
      <div className="h-4 w-44 animate-pulse rounded bg-[var(--bg-hover)]" />
      <div className="mt-1.5 h-3 w-64 animate-pulse rounded bg-[var(--bg-subtle)]" />
      <div className="mt-5 h-44 w-full animate-pulse rounded-[var(--radius-md)] bg-[var(--bg-subtle)]" />
    </div>
  );
}
