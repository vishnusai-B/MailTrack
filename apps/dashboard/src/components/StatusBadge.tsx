import type {
  CampaignStatus,
  EventClassification,
  ReminderStatus,
  TrackingStatus,
} from '@mailtrack/shared';

interface BadgeSpec {
  label: string;
  bg: string;
  text: string;
  dot: string;
  description: string;
}

const TRACKING_STATUS_SPECS: Record<TrackingStatus, BadgeSpec> = {
  PENDING: {
    label: 'Pending',
    bg: 'bg-[var(--status-warning-bg)]',
    text: 'text-[var(--status-warning-text)]',
    dot: 'bg-[var(--status-warning-dot)]',
    description: 'Registered and waiting to send.',
  },
  DISPATCHED: {
    label: 'Dispatched',
    bg: 'bg-[var(--status-info-bg)]',
    text: 'text-[var(--status-info-text)]',
    dot: 'bg-[var(--status-info-dot)]',
    description: 'Sent from Gmail compose; awaiting server-side confirmation.',
  },
  SENT: {
    label: 'Sent',
    bg: 'bg-[var(--status-success-bg)]',
    text: 'text-[var(--status-success-text)]',
    dot: 'bg-[var(--status-success-dot)]',
    description: 'Confirmed sent by server-side evidence.',
  },
  FAILED: {
    label: 'Failed',
    bg: 'bg-[var(--status-danger-bg)]',
    text: 'text-[var(--status-danger-text)]',
    dot: 'bg-[var(--status-danger-dot)]',
    description: 'Send attempt did not complete.',
  },
  EXPIRED: {
    label: 'Expired',
    bg: 'bg-[var(--status-neutral-bg)]',
    text: 'text-[var(--status-neutral-text)]',
    dot: 'bg-[var(--status-neutral-dot)]',
    description: 'Tracking retention window elapsed.',
  },
};

export const CLASSIFICATION_SPECS: Record<EventClassification, BadgeSpec> = {
  RECORDED: {
    label: 'Opened (likely human)',
    bg: 'bg-[var(--status-success-bg)]',
    text: 'text-[var(--status-success-text)]',
    dot: 'bg-[var(--status-success-dot)]',
    description: 'Standard pixel request without proxy or scanner signatures.',
  },
  LIKELY_PROXY: {
    label: 'Email client prefetch',
    bg: 'bg-[var(--status-warning-bg)]',
    text: 'text-[var(--status-warning-text)]',
    dot: 'bg-[var(--status-warning-dot)]',
    description: 'Matches image proxy or caching fetcher characteristics.',
  },
  SUSPECTED_SCANNER: {
    label: 'Security scanner',
    bg: 'bg-[var(--status-danger-bg)]',
    text: 'text-[var(--status-danger-text)]',
    dot: 'bg-[var(--status-danger-dot)]',
    description: 'Matches automated security scanner or link-prefetcher patterns.',
  },
};

const CAMPAIGN_STATUS_SPECS: Record<CampaignStatus, Omit<BadgeSpec, 'description'>> = {
  ACTIVE: {
    label: 'Active',
    bg: 'bg-[var(--status-success-bg)]',
    text: 'text-[var(--status-success-text)]',
    dot: 'bg-[var(--status-success-dot)]',
  },
  COMPLETED: {
    label: 'Completed',
    bg: 'bg-[var(--status-info-bg)]',
    text: 'text-[var(--status-info-text)]',
    dot: 'bg-[var(--status-info-dot)]',
  },
  ARCHIVED: {
    label: 'Archived',
    bg: 'bg-[var(--status-neutral-bg)]',
    text: 'text-[var(--status-neutral-text)]',
    dot: 'bg-[var(--status-neutral-dot)]',
  },
};

const REMINDER_STATUS_SPECS: Record<ReminderStatus, Omit<BadgeSpec, 'description'>> = {
  PENDING: {
    label: 'Pending',
    bg: 'bg-[var(--status-warning-bg)]',
    text: 'text-[var(--status-warning-text)]',
    dot: 'bg-[var(--status-warning-dot)]',
  },
  COMPLETED: {
    label: 'Completed',
    bg: 'bg-[var(--status-success-bg)]',
    text: 'text-[var(--status-success-text)]',
    dot: 'bg-[var(--status-success-dot)]',
  },
  CANCELLED: {
    label: 'Cancelled',
    bg: 'bg-[var(--status-neutral-bg)]',
    text: 'text-[var(--status-neutral-text)]',
    dot: 'bg-[var(--status-neutral-dot)]',
  },
};

function StatusPill({
  label,
  bg,
  text,
  dot,
  title,
}: {
  label: string;
  bg: string;
  text: string;
  dot: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] px-2 py-0.5 text-[12px] font-medium whitespace-nowrap ${bg} ${text}`}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} aria-hidden="true" />
      {label}
    </span>
  );
}

export function TrackingStatusBadge({ status }: { status: TrackingStatus }) {
  const spec = TRACKING_STATUS_SPECS[status];
  return (
    <StatusPill
      label={spec.label}
      bg={spec.bg}
      text={spec.text}
      dot={spec.dot}
      title={spec.description}
    />
  );
}

export function ClassificationBadge({ classification }: { classification: EventClassification }) {
  const spec = CLASSIFICATION_SPECS[classification];
  return (
    <StatusPill
      label={spec.label}
      bg={spec.bg}
      text={spec.text}
      dot={spec.dot}
      title={spec.description}
    />
  );
}

export function CampaignStatusBadge({ status }: { status: CampaignStatus }) {
  const spec = CAMPAIGN_STATUS_SPECS[status];
  return <StatusPill label={spec.label} bg={spec.bg} text={spec.text} dot={spec.dot} />;
}

export function ReminderStatusBadge({ status }: { status: ReminderStatus }) {
  const spec = REMINDER_STATUS_SPECS[status];
  return <StatusPill label={spec.label} bg={spec.bg} text={spec.text} dot={spec.dot} />;
}

export function EngagementSignal({
  firstRecordedAt,
  eventCount = 0,
}: {
  firstRecordedAt: string | null | undefined;
  eventCount?: number;
}) {
  const hasActivity = Boolean(firstRecordedAt) || eventCount > 0;
  const count = eventCount > 0 ? eventCount : hasActivity ? 1 : 0;

  if (!hasActivity) {
    return (
      <span
        title="No pixel requests have been recorded yet."
        className="inline-flex items-center gap-1.5 text-[12px] text-[var(--text-muted)]"
      >
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--status-neutral-dot)]"
          aria-hidden="true"
        />
        No activity
      </span>
    );
  }

  return (
    <span
      title="Count of recorded pixel requests. Email image proxies and security scanners can also trigger pixel loads, so open the email detail drawer to inspect signal types."
      className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[var(--text-primary)] tabular-nums"
    >
      <span
        className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--status-success-dot)]"
        aria-hidden="true"
      />
      {count} {count === 1 ? 'likely open' : 'likely opens'}
    </span>
  );
}
