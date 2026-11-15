import type {
  CampaignStatus,
  EventClassification,
  ReminderStatus,
  TrackingStatus,
} from '@mailtrack/shared';

const STATUS_STYLES: Record<
  TrackingStatus,
  { label: string; className: string; dot: string; description: string }
> = {
  PENDING: {
    label: 'PENDING',
    className: 'bg-amber-50/90 text-amber-800 ring-amber-600/20',
    dot: 'bg-amber-500',
    description: 'Registered and waiting to send.',
  },
  DISPATCHED: {
    label: 'DISPATCHED',
    className: 'bg-sky-50/90 text-sky-800 ring-sky-600/20',
    dot: 'bg-sky-500',
    description: 'Sent from Gmail compose; awaiting trusted server confirmation.',
  },
  SENT: {
    label: 'SENT',
    className: 'bg-emerald-50/90 text-emerald-800 ring-emerald-600/20',
    dot: 'bg-emerald-500',
    description: 'Confirmed sent by server-side evidence.',
  },
  FAILED: {
    label: 'FAILED',
    className: 'bg-rose-50/90 text-rose-800 ring-rose-600/20',
    dot: 'bg-rose-500',
    description: 'Send attempt did not complete.',
  },
  EXPIRED: {
    label: 'EXPIRED',
    className: 'bg-neutral-100 text-neutral-600 ring-neutral-500/20',
    dot: 'bg-neutral-400',
    description: 'Tracking window expired.',
  },
};

const CLASSIFICATION_STYLES: Record<
  EventClassification,
  { label: string; className: string; dot: string; description: string }
> = {
  RECORDED: {
    label: 'RECORDED',
    className: 'bg-indigo-50/90 text-indigo-700 ring-indigo-600/20',
    dot: 'bg-indigo-500',
    description: 'Standard pixel request without proxy or scanner signature.',
  },
  LIKELY_PROXY: {
    label: 'LIKELY_PROXY',
    className: 'bg-amber-50/90 text-amber-800 ring-amber-600/20',
    dot: 'bg-amber-500',
    description: 'Matches image proxy or caching fetcher characteristics.',
  },
  SUSPECTED_SCANNER: {
    label: 'SUSPECTED_SCANNER',
    className: 'bg-rose-50/90 text-rose-700 ring-rose-600/20',
    dot: 'bg-rose-500',
    description: 'Matches automated security scanner or pre-fetcher patterns.',
  },
};

export function TrackingStatusBadge({ status }: { status: TrackingStatus }) {
  const style = STATUS_STYLES[status];
  return (
    <span
      title={style.description}
      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 font-mono text-[11px] font-medium ring-1 ring-inset ${style.className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} aria-hidden="true" />
      {style.label}
    </span>
  );
}

export function OpenStatusBadge({
  firstRecordedAt,
  eventCount = 0,
}: {
  firstRecordedAt: string | null | undefined;
  eventCount?: number;
}) {
  const isOpened = Boolean(firstRecordedAt) || eventCount > 0;
  if (isOpened) {
    return (
      <span
        title="At least one pixel request recorded."
        className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-600/20 ring-inset"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
        Opened{eventCount > 1 ? ` · ${eventCount}` : ''}
      </span>
    );
  }

  return (
    <span
      title="No pixel requests recorded yet."
      className="inline-flex items-center gap-1.5 rounded-md bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-600 ring-1 ring-neutral-500/15 ring-inset"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-neutral-400" aria-hidden="true" />
      Not opened
    </span>
  );
}

export function ClassificationBadge({ classification }: { classification: EventClassification }) {
  const style = CLASSIFICATION_STYLES[classification];
  return (
    <span
      title={style.description}
      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 font-mono text-[11px] font-medium ring-1 ring-inset ${style.className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} aria-hidden="true" />
      {style.label}
    </span>
  );
}

const CAMPAIGN_STATUS_STYLES: Record<CampaignStatus, string> = {
  ACTIVE: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  COMPLETED: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  ARCHIVED: 'bg-neutral-100 text-neutral-600 ring-neutral-500/20',
};

export function CampaignStatusBadge({ status }: { status: CampaignStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 font-mono text-[11px] font-medium ring-1 ring-inset ${CAMPAIGN_STATUS_STYLES[status]}`}
    >
      {status}
    </span>
  );
}

const REMINDER_STATUS_STYLES: Record<ReminderStatus, string> = {
  PENDING: 'bg-amber-50 text-amber-800 ring-amber-600/20',
  COMPLETED: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  CANCELLED: 'bg-neutral-100 text-neutral-600 ring-neutral-500/20',
};

export function ReminderStatusBadge({ status }: { status: ReminderStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 font-mono text-[11px] font-medium ring-1 ring-inset ${REMINDER_STATUS_STYLES[status]}`}
    >
      {status}
    </span>
  );
}
