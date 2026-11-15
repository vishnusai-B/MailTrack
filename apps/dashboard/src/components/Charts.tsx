import { useState } from 'react';
import type {
  ActivityEventItem,
  DailyActivityPoint,
  EventClassificationCounts,
  TrackingStatusCounts,
} from '@mailtrack/shared';
import { formatShortDate } from '../lib/format.js';

export function DailyActivityChart({
  data,
  title = 'Pixel activity over time',
  takeaway,
  onSelectRange,
  selectedDays,
}: {
  data: DailyActivityPoint[];
  title?: string;
  takeaway?: string;
  selectedDays?: number;
  onSelectRange?: (days: number) => void;
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const totalEvents = data.reduce((sum, d) => sum + d.totalEvents, 0);
  const maxEvents = Math.max(...data.map((d) => d.totalEvents), 1);

  const hoveredPoint = hoveredIndex !== null ? data[hoveredIndex] : null;

  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 shadow-[var(--shadow-sm)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[14px] font-semibold text-[var(--text-primary)]">{title}</h3>
          <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">
            {takeaway ?? `Daily pixel requests (${totalEvents} total). Dates in UTC.`}
          </p>
        </div>

        {onSelectRange && selectedDays !== undefined ? (
          <div
            role="group"
            aria-label="Activity time range"
            className="inline-flex rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-subtle)] p-0.5"
          >
            {[7, 14, 30].map((d) => {
              const active = selectedDays === d;
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => onSelectRange(d)}
                  aria-pressed={active}
                  className={`rounded-[var(--radius-sm)] px-2.5 py-1 text-[12px] font-medium tabular-nums transition-colors duration-150 ${
                    active
                      ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-[var(--shadow-sm)]'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {d}d
                </button>
              );
            })}
          </div>
        ) : (
          <span className="text-[12px] font-medium text-[var(--text-muted)] tabular-nums">
            {totalEvents} total
          </span>
        )}
      </div>

      {data.length === 0 || totalEvents === 0 ? (
        <div className="mt-4 flex h-40 items-center justify-center rounded-[var(--radius-md)] border border-dashed border-[var(--border-default)] bg-[var(--bg-subtle)] px-4 text-center text-[12px] text-[var(--text-muted)]">
          No pixel requests recorded during this period.
        </div>
      ) : (
        <div className="relative mt-4">
          {hoveredPoint ? (
            <div className="mb-2 flex items-center justify-between rounded-[var(--radius-sm)] border border-[var(--border-default)] bg-[var(--bg-subtle)] px-2.5 py-1 text-[12px] tabular-nums">
              <span className="font-medium text-[var(--text-primary)]">
                {formatShortDate(hoveredPoint.date)}
              </span>
              <span className="text-[var(--text-secondary)]">
                {hoveredPoint.totalEvents} total · {hoveredPoint.recorded} likely human ·{' '}
                {hoveredPoint.likelyProxy + hoveredPoint.suspectedScanner} automated
              </span>
            </div>
          ) : (
            <div className="mb-2 h-[26px]" aria-hidden="true" />
          )}

          <div className="h-40 w-full">
            <svg
              viewBox="0 0 600 140"
              className="h-full w-full overflow-visible"
              role="img"
              aria-label={`Bar chart showing ${totalEvents} pixel requests across ${data.length} days`}
            >
              <line
                x1="0"
                y1="20"
                x2="600"
                y2="20"
                stroke="var(--border-default)"
                strokeDasharray="3 3"
              />
              <line
                x1="0"
                y1="75"
                x2="600"
                y2="75"
                stroke="var(--border-default)"
                strokeDasharray="3 3"
              />
              <line x1="0" y1="130" x2="600" y2="130" stroke="var(--border-strong)" />

              {data.map((point, index) => {
                const slotWidth = 600 / Math.max(data.length, 1);
                const barWidth = Math.max(Math.min(slotWidth - 4, 24), 4);
                const x = index * slotWidth + (slotWidth - barWidth) / 2;
                const barHeight =
                  point.totalEvents > 0 ? Math.max((point.totalEvents / maxEvents) * 106, 4) : 0;
                const y = 130 - barHeight;
                const isHovered = hoveredIndex === index;

                return (
                  <g
                    key={point.date}
                    onMouseEnter={() => setHoveredIndex(index)}
                    onMouseLeave={() => setHoveredIndex(null)}
                  >
                    <rect
                      x={index * slotWidth}
                      y={0}
                      width={slotWidth}
                      height={140}
                      fill="transparent"
                    />
                    <rect
                      x={x}
                      y={y}
                      width={barWidth}
                      height={barHeight}
                      rx={2}
                      fill={isHovered ? 'var(--accent-hover)' : 'var(--accent)'}
                      opacity={hoveredIndex === null || isHovered ? 0.92 : 0.45}
                    >
                      <title>{`${formatShortDate(point.date)}: ${point.totalEvents} requests (${point.recorded} likely human)`}</title>
                    </rect>
                  </g>
                );
              })}
            </svg>
          </div>

          <div className="mt-2 flex items-center justify-between text-[11px] text-[var(--text-muted)] tabular-nums">
            <span>{formatShortDate(data[0]!.date)}</span>
            {data.length > 2 ? (
              <span>{formatShortDate(data[Math.floor(data.length / 2)]!.date)}</span>
            ) : null}
            <span>{formatShortDate(data[data.length - 1]!.date)}</span>
          </div>
        </div>
      )}
    </section>
  );
}

export function DailyTrendByClassificationChart({
  data,
  takeaway,
}: {
  data: DailyActivityPoint[];
  takeaway?: string;
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const totalEvents = data.reduce((sum, d) => sum + d.totalEvents, 0);
  const maxEvents = Math.max(...data.map((d) => d.totalEvents), 1);
  const hoveredPoint = hoveredIndex !== null ? data[hoveredIndex] : null;

  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 shadow-[var(--shadow-sm)]">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-[14px] font-semibold text-[var(--text-primary)]">
            Activity by signal type
          </h3>
          <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">
            {takeaway ??
              'Daily pixel requests separated into likely human opens and automated fetches.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-[var(--text-secondary)]">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-xs bg-[var(--accent)]" aria-hidden="true" />
            Likely human
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              className="h-2 w-2 rounded-xs bg-[var(--status-warning-dot)]"
              aria-hidden="true"
            />
            Prefetch
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-xs bg-[var(--status-danger-dot)]" aria-hidden="true" />
            Scanner
          </span>
        </div>
      </div>

      {data.length === 0 || totalEvents === 0 ? (
        <div className="mt-4 flex h-40 items-center justify-center rounded-[var(--radius-md)] border border-dashed border-[var(--border-default)] bg-[var(--bg-subtle)] px-4 text-center text-[12px] text-[var(--text-muted)]">
          No classified pixel requests in this window.
        </div>
      ) : (
        <div className="mt-4">
          <div className="mb-2 h-[22px] text-[12px] text-[var(--text-secondary)] tabular-nums">
            {hoveredPoint
              ? `${formatShortDate(hoveredPoint.date)}: ${hoveredPoint.recorded} likely human, ${hoveredPoint.likelyProxy} prefetch, ${hoveredPoint.suspectedScanner} scanner`
              : 'Hover a day to inspect breakdown'}
          </div>
          <div className="h-36 w-full">
            <svg
              viewBox="0 0 600 130"
              className="h-full w-full overflow-visible"
              role="img"
              aria-label="Stacked bar chart of daily pixel requests by signal classification"
            >
              <line x1="0" y1="120" x2="600" y2="120" stroke="var(--border-strong)" />
              {data.map((point, index) => {
                const slotWidth = 600 / Math.max(data.length, 1);
                const barWidth = Math.max(Math.min(slotWidth - 4, 22), 4);
                const x = index * slotWidth + (slotWidth - barWidth) / 2;

                const hRec = (point.recorded / maxEvents) * 104;
                const hProxy = (point.likelyProxy / maxEvents) * 104;
                const hScan = (point.suspectedScanner / maxEvents) * 104;

                let yCursor = 120;
                const recY = yCursor - hRec;
                yCursor = recY;
                const proxyY = yCursor - hProxy;
                yCursor = proxyY;
                const scanY = yCursor - hScan;

                return (
                  <g
                    key={point.date}
                    onMouseEnter={() => setHoveredIndex(index)}
                    onMouseLeave={() => setHoveredIndex(null)}
                  >
                    <rect
                      x={index * slotWidth}
                      y={0}
                      width={slotWidth}
                      height={130}
                      fill="transparent"
                    />
                    {hRec > 0 ? (
                      <rect
                        x={x}
                        y={recY}
                        width={barWidth}
                        height={Math.max(hRec, 2)}
                        fill="var(--accent)"
                      />
                    ) : null}
                    {hProxy > 0 ? (
                      <rect
                        x={x}
                        y={proxyY}
                        width={barWidth}
                        height={Math.max(hProxy, 2)}
                        fill="var(--status-warning-dot)"
                      />
                    ) : null}
                    {hScan > 0 ? (
                      <rect
                        x={x}
                        y={scanY}
                        width={barWidth}
                        height={Math.max(hScan, 2)}
                        fill="var(--status-danger-dot)"
                      />
                    ) : null}
                  </g>
                );
              })}
            </svg>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-[var(--text-muted)] tabular-nums">
            <span>{formatShortDate(data[0]!.date)}</span>
            <span>{formatShortDate(data[data.length - 1]!.date)}</span>
          </div>
        </div>
      )}
    </section>
  );
}

export function ClassificationDistributionChart({
  counts,
  takeaway,
}: {
  counts: EventClassificationCounts;
  takeaway?: string;
}) {
  const total = counts.totalEvents;
  const rows = [
    {
      label: 'Opened (likely human)',
      count: counts.RECORDED,
      color: 'bg-[var(--accent)]',
      dot: 'bg-[var(--accent)]',
    },
    {
      label: 'Email client prefetch',
      count: counts.LIKELY_PROXY,
      color: 'bg-[var(--status-warning-dot)]',
      dot: 'bg-[var(--status-warning-dot)]',
    },
    {
      label: 'Security scanner',
      count: counts.SUSPECTED_SCANNER,
      color: 'bg-[var(--status-danger-dot)]',
      dot: 'bg-[var(--status-danger-dot)]',
    },
  ];

  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 shadow-[var(--shadow-sm)]">
      <h3 className="text-[14px] font-semibold text-[var(--text-primary)]">
        Classification breakdown
      </h3>
      <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">
        {takeaway ?? `Distribution across ${total} recorded pixel requests.`}
      </p>

      {total === 0 ? (
        <div className="mt-4 flex h-32 items-center justify-center rounded-[var(--radius-md)] border border-dashed border-[var(--border-default)] bg-[var(--bg-subtle)] text-[12px] text-[var(--text-muted)]">
          No pixel classifications recorded yet.
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <div
            className="flex h-3 w-full overflow-hidden rounded-full bg-[var(--bg-subtle)]"
            role="img"
            aria-label={`Classification breakdown across ${total} events`}
          >
            {rows.map((row) => {
              const pct = (row.count / total) * 100;
              if (pct <= 0) return null;
              return (
                <div
                  key={row.label}
                  style={{ width: `${pct}%` }}
                  className={row.color}
                  title={`${row.label}: ${row.count} (${Math.round(pct)}%)`}
                />
              );
            })}
          </div>

          <div className="space-y-2.5">
            {rows.map((row) => {
              const pct = total > 0 ? Math.round((row.count / total) * 100) : 0;
              return (
                <div
                  key={row.label}
                  className="flex items-center justify-between text-[13px] tabular-nums"
                >
                  <span className="inline-flex items-center gap-2 text-[var(--text-secondary)]">
                    <span className={`h-2 w-2 rounded-full ${row.dot}`} aria-hidden="true" />
                    {row.label}
                  </span>
                  <span className="font-medium text-[var(--text-primary)]">
                    {row.count}{' '}
                    <span className="text-[12px] font-normal text-[var(--text-muted)]">
                      ({pct}%)
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const TIME_BUCKETS = ['00–04', '04–08', '08–12', '12–16', '16–20', '20–24'];

export function SendTimeHeatmap({
  events,
  heatmap,
  days,
}: {
  events: ActivityEventItem[];
  heatmap?: number[][];
  days?: number;
}) {
  const grid = Array.from({ length: 7 }, (_, r) =>
    Array.from({ length: 6 }, (_, c) => heatmap?.[r]?.[c] ?? 0),
  );
  let maxCount = 0;

  if (heatmap && heatmap.length === 7) {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 6; c++) {
        const val = grid[r]![c] ?? 0;
        if (val > maxCount) maxCount = val;
      }
    }
  } else {
    for (const ev of events) {
      if (ev.classification !== 'RECORDED') continue;
      const d = new Date(ev.occurredAt);
      if (Number.isNaN(d.getTime())) continue;
      const dayIdx = (d.getUTCDay() + 6) % 7; // Monday = 0
      const bucketIdx = Math.min(Math.floor(d.getUTCHours() / 4), 5);
      const next = (grid[dayIdx]![bucketIdx] ?? 0) + 1;
      grid[dayIdx]![bucketIdx] = next;
      if (next > maxCount) maxCount = next;
    }
  }

  let bestDay = '';
  let bestBucket = '';
  if (maxCount > 0) {
    outer: for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 6; c++) {
        if (grid[r]![c] === maxCount) {
          bestDay = WEEKDAYS[r]!;
          bestBucket = TIME_BUCKETS[c]!;
          break outer;
        }
      }
    }
  }

  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 shadow-[var(--shadow-sm)]">
      <h3 className="text-[14px] font-semibold text-[var(--text-primary)]">
        Recent pixel-request activity
      </h3>
      <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">
        {maxCount > 0
          ? `Peak likely-human pixel requests around ${bestDay} ${bestBucket} (UTC)${days ? ` over ${days}d` : ''}. Represents pixel-request timestamps, not actual send times or verified reading times.`
          : 'No likely-human pixel-request timestamps recorded in this window (UTC). Represents pixel-request timestamps, not actual send times or verified reading times.'}
      </p>

      {maxCount === 0 ? (
        <div className="mt-4 flex h-32 items-center justify-center rounded-[var(--radius-md)] border border-dashed border-[var(--border-default)] bg-[var(--bg-subtle)] text-[12px] text-[var(--text-muted)]">
          Heatmap populates once likely-human pixel activity is recorded.
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <div
            className="min-w-[320px]"
            role="img"
            aria-label="Heatmap of likely-human pixel requests by weekday and UTC hour block"
          >
            <div className="mb-1.5 grid grid-cols-[36px_repeat(6,1fr)] gap-1 text-center text-[11px] text-[var(--text-muted)] tabular-nums">
              <span />
              {TIME_BUCKETS.map((b) => (
                <span key={b}>{b}</span>
              ))}
            </div>
            <div className="space-y-1">
              {WEEKDAYS.map((day, r) => (
                <div key={day} className="grid grid-cols-[36px_repeat(6,1fr)] items-center gap-1">
                  <span className="text-[11px] text-[var(--text-muted)]">{day}</span>
                  {TIME_BUCKETS.map((bucket, c) => {
                    const count = grid[r]![c] ?? 0;
                    const ratio = maxCount > 0 ? count / maxCount : 0;
                    const opacity = count === 0 ? 0.08 : 0.25 + ratio * 0.75;
                    return (
                      <div
                        key={bucket}
                        title={`${day} ${bucket}: ${count} likely-human ${count === 1 ? 'event' : 'events'}`}
                        style={{
                          backgroundColor: count === 0 ? 'var(--border-strong)' : 'var(--accent)',
                          opacity,
                        }}
                        className="h-4 rounded-[3px]"
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export function StatusDistributionChart({ counts }: { counts: TrackingStatusCounts }) {
  const total = Math.max(counts.totalEmails, 1);
  const rows = [
    { label: 'Pending', value: counts.PENDING, dot: 'bg-[var(--status-warning-dot)]' },
    { label: 'Dispatched', value: counts.DISPATCHED, dot: 'bg-[var(--status-info-dot)]' },
    { label: 'Sent', value: counts.SENT, dot: 'bg-[var(--status-success-dot)]' },
    { label: 'Failed', value: counts.FAILED, dot: 'bg-[var(--status-danger-dot)]' },
    { label: 'Expired', value: counts.EXPIRED, dot: 'bg-[var(--status-neutral-dot)]' },
  ];

  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 shadow-[var(--shadow-sm)]">
      <h3 className="text-[14px] font-semibold text-[var(--text-primary)]">Delivery status</h3>
      <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">
        Breakdown across {counts.totalEmails} tracked emails.
      </p>

      <div className="mt-4 space-y-2.5">
        {rows.map((row) => {
          const pct = counts.totalEmails > 0 ? Math.round((row.value / total) * 100) : 0;
          return (
            <div key={row.label} className="space-y-1">
              <div className="flex items-center justify-between text-[12px] tabular-nums">
                <span className="inline-flex items-center gap-2 text-[var(--text-secondary)]">
                  <span className={`h-2 w-2 rounded-full ${row.dot}`} aria-hidden="true" />
                  {row.label}
                </span>
                <span className="font-medium text-[var(--text-primary)]">
                  {row.value} ({pct}%)
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-subtle)]">
                <div className={`h-full rounded-full ${row.dot}`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
