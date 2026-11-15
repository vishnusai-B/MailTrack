import type {
  DailyActivityPoint,
  EventClassificationCounts,
  TrackingStatusCounts,
} from '@mailtrack/shared';
import { formatShortDate } from '../lib/format.js';

export function DailyActivityChart({
  data,
  title = 'Daily Recorded Pixel Requests',
  subtitle = 'Pixel requests logged per day (UTC).',
}: {
  data: DailyActivityPoint[];
  title?: string;
  subtitle?: string;
}) {
  const hasEvents = data.some((d) => d.totalEvents > 0);
  const totalEvents = data.reduce((sum, d) => sum + d.totalEvents, 0);
  const maxCount = Math.max(1, ...data.map((d) => d.totalEvents));
  const midCount = Math.ceil(maxCount / 2);

  return (
    <section className="rounded-xl border border-neutral-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-neutral-900">{title}</h2>
          <p className="mt-0.5 text-xs text-neutral-500">{subtitle}</p>
        </div>
        {hasEvents ? (
          <div className="flex items-center gap-2 text-[11px] font-medium text-neutral-600 tabular-nums">
            <span className="rounded-md bg-neutral-100 px-2 py-0.5">Peak {maxCount}</span>
            <span className="rounded-md bg-blue-50 px-2 py-0.5 text-blue-700">
              {totalEvents} total
            </span>
          </div>
        ) : null}
      </div>

      {!hasEvents ? (
        <div className="mt-5 flex h-44 items-center justify-center rounded-lg border border-dashed border-neutral-200 bg-neutral-50/70 text-xs text-neutral-500">
          No pixel requests recorded in this date range.
        </div>
      ) : (
        <div className="mt-5">
          <div className="flex gap-3">
            {/* Y-Axis Scale */}
            <div
              className="flex h-44 flex-col justify-between pb-2 text-right font-mono text-[10px] text-neutral-400 tabular-nums"
              aria-hidden="true"
            >
              <span>{maxCount}</span>
              <span>{midCount !== maxCount ? midCount : ''}</span>
              <span>0</span>
            </div>

            <div className="relative min-w-0 flex-1">
              <div
                className="pointer-events-none absolute inset-0 flex flex-col justify-between pb-2"
                aria-hidden="true"
              >
                <div className="border-b border-dashed border-neutral-100" />
                <div className="border-b border-dashed border-neutral-100" />
                <div className="border-b border-dashed border-neutral-100" />
              </div>
              <div
                className="relative flex h-44 items-end gap-1 border-b border-neutral-200 pb-2"
                role="img"
                aria-label={title}
              >
                {data.map((point) => {
                  const hasValue = point.totalEvents > 0;
                  const heightPct = hasValue
                    ? Math.max(8, Math.round((point.totalEvents / maxCount) * 100))
                    : 0;
                  return (
                    <div
                      key={point.date}
                      className="group relative flex h-full flex-1 flex-col items-center justify-end"
                    >
                      {hasValue ? (
                        <>
                          <div className="pointer-events-none absolute -top-7 z-10 hidden rounded-md bg-neutral-900 px-2 py-0.5 text-[10px] font-medium whitespace-nowrap text-white shadow-sm group-hover:block tabular-nums">
                            {formatShortDate(point.date)}: {point.totalEvents}
                          </div>
                          <div
                            className="w-full max-w-[26px] rounded-t-sm bg-blue-600 transition-colors duration-150 group-hover:bg-blue-700"
                            style={{ height: `${heightPct}%` }}
                            title={`${formatShortDate(point.date)}: ${point.totalEvents} recorded requests`}
                          />
                        </>
                      ) : (
                        <div
                          className="h-[2px] w-full max-w-[14px] rounded-full bg-neutral-200/70 transition-colors group-hover:bg-neutral-300"
                          title={`${formatShortDate(point.date)}: 0 recorded requests`}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="mt-2 flex justify-between pl-7 text-[11px] text-neutral-400">
            <span>{data[0] ? formatShortDate(data[0].date) : ''}</span>
            <span>
              {data.length > 2 ? formatShortDate(data[Math.floor(data.length / 2)]!.date) : ''}
            </span>
            <span>{data[data.length - 1] ? formatShortDate(data[data.length - 1]!.date) : ''}</span>
          </div>
        </div>
      )}
    </section>
  );
}

const STATUS_META = [
  { key: 'PENDING', label: 'Pending', barClass: 'bg-amber-500', dotClass: 'bg-amber-500' },
  { key: 'DISPATCHED', label: 'Dispatched', barClass: 'bg-sky-500', dotClass: 'bg-sky-500' },
  {
    key: 'SENT',
    label: 'Sent (Trusted)',
    barClass: 'bg-emerald-500',
    dotClass: 'bg-emerald-500',
  },
  { key: 'FAILED', label: 'Failed', barClass: 'bg-rose-500', dotClass: 'bg-rose-500' },
  { key: 'EXPIRED', label: 'Expired', barClass: 'bg-neutral-400', dotClass: 'bg-neutral-400' },
] as const;

export function StatusDistributionChart({ counts }: { counts: TrackingStatusCounts }) {
  const total = counts.totalEmails;

  return (
    <section className="rounded-xl border border-neutral-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-neutral-900">
            Tracking Status Distribution
          </h2>
          <p className="mt-0.5 text-xs text-neutral-500">
            Breakdown across {total} tracked {total === 1 ? 'email' : 'emails'}.
          </p>
        </div>
      </div>

      {total === 0 ? (
        <div className="mt-5 flex h-44 items-center justify-center rounded-lg border border-dashed border-neutral-200 bg-neutral-50/70 text-xs text-neutral-500">
          No tracked emails recorded yet.
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          {/* Proportional Segmented Bar */}
          <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-neutral-100">
            {STATUS_META.map((item) => {
              const count = counts[item.key];
              if (count <= 0) return null;
              const widthPct = (count / total) * 100;
              return (
                <div
                  key={item.key}
                  className={`h-full ${item.barClass} transition-all duration-300`}
                  style={{ width: `${widthPct}%` }}
                  title={`${item.label}: ${count}`}
                />
              );
            })}
          </div>

          <div className="space-y-3">
            {STATUS_META.map((item) => {
              const count = counts[item.key];
              const pct = total > 0 ? Math.round((count / total) * 100) : 0;
              return (
                <div key={item.key}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 font-medium text-neutral-700">
                      <span className={`h-2 w-2 rounded-full ${item.dotClass}`} />
                      {item.label}
                    </span>
                    <span className="font-mono text-[11px] text-neutral-600 tabular-nums">
                      {count} ({pct}%)
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
                    <div
                      className={`h-full rounded-full ${item.barClass} transition-all duration-300`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

const CLASSIFICATION_META = [
  {
    key: 'RECORDED',
    label: 'RECORDED',
    color: '#4f46e5',
    dotClass: 'bg-indigo-600',
    description: 'Standard pixel request',
  },
  {
    key: 'LIKELY_PROXY',
    label: 'LIKELY_PROXY',
    color: '#d97706',
    dotClass: 'bg-amber-600',
    description: 'Image proxy / cache',
  },
  {
    key: 'SUSPECTED_SCANNER',
    label: 'SUSPECTED_SCANNER',
    color: '#e11d48',
    dotClass: 'bg-rose-600',
    description: 'Automated security scanner',
  },
] as const;

export function ClassificationDistributionChart({ counts }: { counts: EventClassificationCounts }) {
  const total = counts.totalEvents;
  const radius = 52;
  const circumference = 2 * Math.PI * radius;

  let cumulativeOffset = 0;
  const segments = CLASSIFICATION_META.map((item) => {
    const value = counts[item.key];
    const fraction = total > 0 ? value / total : 0;
    const strokeLength = fraction * circumference;
    const segment = {
      ...item,
      value,
      pct: total > 0 ? Math.round(fraction * 100) : 0,
      strokeDasharray: `${strokeLength} ${circumference - strokeLength}`,
      strokeDashoffset: -cumulativeOffset,
    };
    cumulativeOffset += strokeLength;
    return segment;
  });

  return (
    <section className="rounded-xl border border-neutral-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div>
        <h2 className="text-sm font-semibold tracking-tight text-neutral-900">
          Event Classification Distribution
        </h2>
        <p className="mt-0.5 text-xs text-neutral-500">
          Breakdown across {total} recorded {total === 1 ? 'event' : 'events'}.
        </p>
      </div>

      {total === 0 ? (
        <div className="mt-5 flex h-44 items-center justify-center rounded-lg border border-dashed border-neutral-200 bg-neutral-50/70 text-xs text-neutral-500">
          No tracking events in this period.
        </div>
      ) : (
        <div className="mt-5 flex flex-col items-center gap-6 sm:flex-row">
          <div className="relative h-36 w-36 shrink-0">
            <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90" role="img">
              <title>Event Classification Distribution</title>
              <circle cx="70" cy="70" r={radius} fill="none" stroke="#f4f4f5" strokeWidth="16" />
              {segments.map((seg) =>
                seg.value > 0 ? (
                  <circle
                    key={seg.key}
                    cx="70"
                    cy="70"
                    r={radius}
                    fill="none"
                    stroke={seg.color}
                    strokeWidth="16"
                    strokeDasharray={seg.strokeDasharray}
                    strokeDashoffset={seg.strokeDashoffset}
                  />
                ) : null,
              )}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-xl font-semibold text-neutral-950 tabular-nums">{total}</span>
              <span className="text-[11px] text-neutral-500">Events</span>
            </div>
          </div>

          <div className="w-full flex-1 space-y-3">
            {segments.map((seg) => (
              <div
                key={seg.key}
                className="flex items-center justify-between gap-2 rounded-lg border border-neutral-100 bg-neutral-50/60 px-3 py-2 text-xs"
              >
                <div className="flex items-center gap-2.5">
                  <span className={`h-2.5 w-2.5 rounded-full ${seg.dotClass}`} />
                  <div>
                    <div className="font-mono text-[11px] font-medium text-neutral-800">
                      {seg.label}
                    </div>
                    <div className="text-[11px] text-neutral-500">{seg.description}</div>
                  </div>
                </div>
                <span className="font-mono text-xs font-semibold text-neutral-900 tabular-nums">
                  {seg.value} ({seg.pct}%)
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

export function DailyTrendByClassificationChart({ data }: { data: DailyActivityPoint[] }) {
  const hasEvents = data.some((d) => d.totalEvents > 0);
  const maxCount = Math.max(1, ...data.map((d) => d.totalEvents));

  return (
    <section className="rounded-xl border border-neutral-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-neutral-900">
            Daily Activity Trend by Classification
          </h2>
          <p className="mt-0.5 text-xs text-neutral-500">
            Daily pixel requests split by classification.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 font-mono text-[10px] text-neutral-600">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-xs bg-indigo-600" /> RECORDED
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-xs bg-amber-500" /> LIKELY_PROXY
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-xs bg-rose-500" /> SUSPECTED_SCANNER
          </span>
        </div>
      </div>

      {!hasEvents ? (
        <div className="mt-5 flex h-44 items-center justify-center rounded-lg border border-dashed border-neutral-200 bg-neutral-50/70 text-xs text-neutral-500">
          No daily trend data available for this period.
        </div>
      ) : (
        <div className="mt-5">
          <div className="relative">
            <div
              className="pointer-events-none absolute inset-0 flex flex-col justify-between pb-2"
              aria-hidden="true"
            >
              <div className="border-b border-dashed border-neutral-100" />
              <div className="border-b border-dashed border-neutral-100" />
              <div className="border-b border-dashed border-neutral-100" />
            </div>
            <div
              className="relative flex h-44 items-end gap-1 border-b border-neutral-200 pb-2"
              role="img"
              aria-label="Daily Activity Trend by Classification"
            >
              {data.map((point) => {
                const hasValue = point.totalEvents > 0;
                const totalPct = hasValue
                  ? Math.max(8, Math.round((point.totalEvents / maxCount) * 100))
                  : 0;
                const recPct = hasValue ? (point.recorded / point.totalEvents) * 100 : 0;
                const proxyPct = hasValue ? (point.likelyProxy / point.totalEvents) * 100 : 0;
                const scanPct = hasValue ? (point.suspectedScanner / point.totalEvents) * 100 : 0;

                return (
                  <div
                    key={point.date}
                    className="group flex h-full flex-1 flex-col items-center justify-end"
                  >
                    {hasValue ? (
                      <div
                        className="flex w-full max-w-[26px] flex-col overflow-hidden rounded-t-sm"
                        style={{ height: `${totalPct}%` }}
                        title={`${formatShortDate(point.date)} — RECORDED: ${point.recorded}, LIKELY_PROXY: ${point.likelyProxy}, SUSPECTED_SCANNER: ${point.suspectedScanner}`}
                      >
                        {scanPct > 0 ? (
                          <div className="w-full bg-rose-500" style={{ height: `${scanPct}%` }} />
                        ) : null}
                        {proxyPct > 0 ? (
                          <div className="w-full bg-amber-500" style={{ height: `${proxyPct}%` }} />
                        ) : null}
                        {recPct > 0 ? (
                          <div className="w-full bg-indigo-600" style={{ height: `${recPct}%` }} />
                        ) : null}
                      </div>
                    ) : (
                      <div className="h-[2px] w-full max-w-[14px] rounded-full bg-neutral-200/70" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="mt-2 flex justify-between text-[11px] text-neutral-400">
            <span>{data[0] ? formatShortDate(data[0].date) : ''}</span>
            <span>
              {data.length > 2 ? formatShortDate(data[Math.floor(data.length / 2)]!.date) : ''}
            </span>
            <span>{data[data.length - 1] ? formatShortDate(data[data.length - 1]!.date) : ''}</span>
          </div>
        </div>
      )}
    </section>
  );
}
