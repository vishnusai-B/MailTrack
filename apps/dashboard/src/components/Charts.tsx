import type {
  DailyActivityPoint,
  EventClassificationCounts,
  TrackingStatusCounts,
} from '@mailtrack/shared';
import { formatShortDate } from '../lib/format.js';

export function DailyActivityChart({
  data,
  title = 'Daily Recorded Pixel Requests',
  subtitle = 'Total pixel requests recorded per UTC day (includes repeated, proxy, and scanner requests).',
}: {
  data: DailyActivityPoint[];
  title?: string;
  subtitle?: string;
}) {
  const hasEvents = data.some((d) => d.totalEvents > 0);
  const maxCount = Math.max(1, ...data.map((d) => d.totalEvents));

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>
        </div>
      </div>

      {!hasEvents ? (
        <div className="mt-6 flex h-44 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/70 text-xs text-slate-500">
          No pixel requests recorded in this date range.
        </div>
      ) : (
        <div className="mt-6">
          <div
            className="flex h-44 items-end gap-1.5 border-b border-slate-200 pb-2"
            role="img"
            aria-label={title}
          >
            {data.map((point) => {
              const heightPct = Math.max(
                point.totalEvents > 0 ? 6 : 0,
                Math.round((point.totalEvents / maxCount) * 100),
              );
              return (
                <div
                  key={point.date}
                  className="group relative flex h-full flex-1 flex-col items-center justify-end"
                >
                  <div
                    className="w-full max-w-[28px] rounded-t bg-blue-600 transition-colors group-hover:bg-blue-700"
                    style={{ height: `${heightPct}%` }}
                    title={`${formatShortDate(point.date)}: ${point.totalEvents} recorded requests`}
                  />
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex justify-between text-[11px] text-slate-500">
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
  { key: 'EXPIRED', label: 'Expired', barClass: 'bg-slate-400', dotClass: 'bg-slate-400' },
] as const;

export function StatusDistributionChart({ counts }: { counts: TrackingStatusCounts }) {
  const total = counts.totalEmails;

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
      <div>
        <h2 className="text-sm font-semibold text-slate-900">Tracking Status Distribution</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Lifecycle breakdown across {total} tracked {total === 1 ? 'email' : 'emails'}. SENT
          requires trusted server-side confirmation.
        </p>
      </div>

      {total === 0 ? (
        <div className="mt-6 flex h-44 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/70 text-xs text-slate-500">
          No tracked emails recorded yet.
        </div>
      ) : (
        <div className="mt-6 space-y-3.5">
          {STATUS_META.map((item) => {
            const count = counts[item.key];
            const pct = total > 0 ? Math.round((count / total) * 100) : 0;
            return (
              <div key={item.key}>
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2 font-medium text-slate-700">
                    <span className={`h-2.5 w-2.5 rounded-full ${item.dotClass}`} />
                    {item.label}
                  </span>
                  <span className="tabular-nums text-slate-600">
                    {count} ({pct}%)
                  </span>
                </div>
                <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full ${item.barClass}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
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
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
      <div>
        <h2 className="text-sm font-semibold text-slate-900">Event Classification Distribution</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Request characteristics across {total} recorded {total === 1 ? 'event' : 'events'}. Does
          not confirm human reading.
        </p>
      </div>

      {total === 0 ? (
        <div className="mt-6 flex h-44 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/70 text-xs text-slate-500">
          No tracking events in this period.
        </div>
      ) : (
        <div className="mt-6 flex flex-col items-center gap-6 sm:flex-row">
          <div className="relative h-36 w-36 shrink-0">
            <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90" role="img">
              <title>Event Classification Distribution</title>
              <circle cx="70" cy="70" r={radius} fill="none" stroke="#f1f5f9" strokeWidth="18" />
              {segments.map((seg) =>
                seg.value > 0 ? (
                  <circle
                    key={seg.key}
                    cx="70"
                    cy="70"
                    r={radius}
                    fill="none"
                    stroke={seg.color}
                    strokeWidth="18"
                    strokeDasharray={seg.strokeDasharray}
                    strokeDashoffset={seg.strokeDashoffset}
                  />
                ) : null,
              )}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-xl font-bold text-slate-900 tabular-nums">{total}</span>
              <span className="text-[11px] text-slate-500">Events</span>
            </div>
          </div>

          <div className="w-full flex-1 space-y-3">
            {segments.map((seg) => (
              <div key={seg.key} className="flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${seg.dotClass}`} />
                  <div>
                    <div className="font-medium text-slate-800">{seg.label}</div>
                    <div className="text-[11px] text-slate-500">{seg.description}</div>
                  </div>
                </div>
                <span className="font-semibold text-slate-900 tabular-nums">
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
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            Daily Activity Trend by Classification
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Stacked daily pixel requests segmented by request classification.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-600">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-xs bg-indigo-600" /> RECORDED
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-xs bg-amber-500" /> LIKELY_PROXY
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-xs bg-rose-500" /> SUSPECTED_SCANNER
          </span>
        </div>
      </div>

      {!hasEvents ? (
        <div className="mt-6 flex h-44 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/70 text-xs text-slate-500">
          No daily trend data available for this period.
        </div>
      ) : (
        <div className="mt-6">
          <div
            className="flex h-44 items-end gap-1.5 border-b border-slate-200 pb-2"
            role="img"
            aria-label="Daily Activity Trend by Classification"
          >
            {data.map((point) => {
              const totalPct =
                point.totalEvents > 0
                  ? Math.max(6, Math.round((point.totalEvents / maxCount) * 100))
                  : 0;
              const recPct = point.totalEvents > 0 ? (point.recorded / point.totalEvents) * 100 : 0;
              const proxyPct =
                point.totalEvents > 0 ? (point.likelyProxy / point.totalEvents) * 100 : 0;
              const scanPct =
                point.totalEvents > 0 ? (point.suspectedScanner / point.totalEvents) * 100 : 0;

              return (
                <div
                  key={point.date}
                  className="flex h-full flex-1 flex-col items-center justify-end"
                >
                  <div
                    className="flex w-full max-w-[28px] flex-col overflow-hidden rounded-t"
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
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex justify-between text-[11px] text-slate-500">
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
