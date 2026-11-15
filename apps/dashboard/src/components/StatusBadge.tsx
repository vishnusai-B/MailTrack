import type {
  CampaignStatus,
  EventClassification,
  ReminderStatus,
  TrackingStatus,
} from '@mailtrack/shared';

const STATUS_STYLES: Record<
  TrackingStatus,
  { label: string; className: string; description: string }
> = {
  PENDING: {
    label: 'PENDING',
    className: 'bg-amber-50 text-amber-800 ring-amber-600/20',
    description: 'Tracking pixel registered; awaiting send dispatch.',
  },
  DISPATCHED: {
    label: 'DISPATCHED',
    className: 'bg-sky-50 text-sky-800 ring-sky-600/20',
    description: 'Send action triggered in Gmail; awaiting trusted delivery confirmation.',
  },
  SENT: {
    label: 'SENT',
    className: 'bg-emerald-50 text-emerald-800 ring-emerald-600/20',
    description: 'Confirmed sent by trusted server-side provider evidence.',
  },
  FAILED: {
    label: 'FAILED',
    className: 'bg-rose-50 text-rose-800 ring-rose-600/20',
    description: 'Send attempt failed before completion.',
  },
  EXPIRED: {
    label: 'EXPIRED',
    className: 'bg-slate-100 text-slate-700 ring-slate-500/20',
    description: 'Abandoned record expired per retention policy.',
  },
};

const CLASSIFICATION_STYLES: Record<
  EventClassification,
  { label: string; className: string; description: string }
> = {
  RECORDED: {
    label: 'RECORDED',
    className: 'bg-indigo-50 text-indigo-800 ring-indigo-600/20',
    description: 'Standard pixel request recorded without proxy or scanner signature.',
  },
  LIKELY_PROXY: {
    label: 'LIKELY_PROXY',
    className: 'bg-amber-50 text-amber-800 ring-amber-600/20',
    description: 'Request matches known image proxy or caching fetcher characteristics.',
  },
  SUSPECTED_SCANNER: {
    label: 'SUSPECTED_SCANNER',
    className: 'bg-rose-50 text-rose-800 ring-rose-600/20',
    description: 'Request matches automated security scanner or link pre-fetcher patterns.',
  },
};

export function TrackingStatusBadge({ status }: { status: TrackingStatus }) {
  const style = STATUS_STYLES[status];
  return (
    <span
      title={style.description}
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${style.className}`}
    >
      {style.label}
    </span>
  );
}

export function ClassificationBadge({ classification }: { classification: EventClassification }) {
  const style = CLASSIFICATION_STYLES[classification];
  return (
    <span
      title={style.description}
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${style.className}`}
    >
      {style.label}
    </span>
  );
}

const CAMPAIGN_STATUS_STYLES: Record<CampaignStatus, string> = {
  ACTIVE: 'bg-emerald-50 text-emerald-800 ring-emerald-600/20',
  COMPLETED: 'bg-blue-50 text-blue-800 ring-blue-600/20',
  ARCHIVED: 'bg-slate-100 text-slate-700 ring-slate-500/20',
};

export function CampaignStatusBadge({ status }: { status: CampaignStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${CAMPAIGN_STATUS_STYLES[status]}`}
    >
      {status}
    </span>
  );
}

const REMINDER_STATUS_STYLES: Record<ReminderStatus, string> = {
  PENDING: 'bg-amber-50 text-amber-800 ring-amber-600/20',
  COMPLETED: 'bg-emerald-50 text-emerald-800 ring-emerald-600/20',
  CANCELLED: 'bg-slate-100 text-slate-600 ring-slate-500/20',
};

export function ReminderStatusBadge({ status }: { status: ReminderStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${REMINDER_STATUS_STYLES[status]}`}
    >
      {status}
    </span>
  );
}
