import type {
  ActivityEventItem,
  DailyActivityPoint,
  DashboardAnalyticsResponse,
  EventClassification,
  EventClassificationCounts,
  PaginatedTrackedEmailsResponse,
  PaginatedTrackingEventsResponse,
  RegisterTrackingRequest,
  RegisterTrackingResponse,
  TrackedEmail,
  TrackedEmailDetail,
  TrackingStatus,
  TrackingStatusCounts,
  UpdateTrackingStatusRequest,
} from '@mailtrack/shared';
import type { Prisma } from '@prisma/client';
import { env } from '../../config/env.js';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../middleware/errorHandler.js';
import { generateTrackingToken, hashTrackingToken } from '../../utils/tokens.js';
import { classifyTrackingRequest } from './classifier.js';

const MAX_EVENTS_PER_MINUTE_PER_EMAIL = 30;
const TOKEN_FORMAT_REGEX = /^[A-Za-z0-9_-]{20,128}$/;

function getPendingTtlMs(): number {
  return env.PENDING_TTL_HOURS * 60 * 60 * 1000;
}

function getDispatchedTtlMs(): number {
  return env.DISPATCHED_TTL_HOURS * 60 * 60 * 1000;
}

function toTrackedEmailDTO(email: {
  id: string;
  userId: string;
  campaignId?: string | null;
  campaign?: { name: string } | null;
  trackingTokenHash: string;
  subject: string | null;
  recipientReference: string;
  status: TrackedEmail['status'];
  sentAt: Date | null;
  expiresAt: Date | null;
  firstRecordedAt: Date | null;
  createdAt: Date;
  _count?: { events?: number };
  events?: Array<{ occurredAt: Date }>;
}): TrackedEmail {
  const dto: TrackedEmail = {
    id: email.id,
    userId: email.userId,
    ...(email.campaignId !== undefined ? { campaignId: email.campaignId } : {}),
    ...(email.campaign ? { campaignName: email.campaign.name } : {}),
    trackingTokenHash: email.trackingTokenHash,
    subject: email.subject,
    recipientReference: email.recipientReference,
    status: email.status,
    sentAt: email.sentAt ? email.sentAt.toISOString() : null,
    expiresAt: email.expiresAt ? email.expiresAt.toISOString() : null,
    firstRecordedAt: email.firstRecordedAt ? email.firstRecordedAt.toISOString() : null,
    createdAt: email.createdAt.toISOString(),
  };

  if (typeof email._count?.events === 'number') {
    dto.eventCount = email._count.events;
  }

  if (Array.isArray(email.events)) {
    dto.lastRecordedAt = email.events[0] ? email.events[0].occurredAt.toISOString() : null;
  }

  return dto;
}

export async function registerTracking(
  userId: string,
  input: RegisterTrackingRequest,
): Promise<RegisterTrackingResponse> {
  const rawToken = generateTrackingToken();
  const trackingTokenHash = hashTrackingToken(rawToken);
  const expiresAt = new Date(Date.now() + getPendingTtlMs());

  const created = await prisma.trackedEmail.create({
    data: {
      userId,
      trackingTokenHash,
      recipientReference: input.recipientReference,
      subject: input.subject ? input.subject.slice(0, 255) : null,
      status: 'PENDING',
      sentAt: null,
      expiresAt,
    },
    select: { id: true },
  });

  const domain = env.TRACKING_DOMAIN.replace(/\/+$/, '');
  return {
    trackingId: created.id,
    pixelUrl: `${domain}/api/track/${rawToken}`,
  };
}

const CLIENT_ALLOWED_TRANSITIONS: Record<
  TrackedEmail['status'],
  ReadonlySet<UpdateTrackingStatusRequest['status']>
> = {
  PENDING: new Set(['DISPATCHED', 'FAILED']),
  DISPATCHED: new Set(['FAILED']),
  SENT: new Set(),
  FAILED: new Set(),
  EXPIRED: new Set(),
};

/**
 * Updates lifecycle status from untrusted client/extension signals (DISPATCHED or FAILED only).
 * Cannot transition a record to SENT; SENT requires trusted server-side submission evidence.
 */
export async function updateTrackingStatus(
  userId: string,
  trackingId: string,
  input: UpdateTrackingStatusRequest,
): Promise<TrackedEmail> {
  const existing = await prisma.trackedEmail.findFirst({
    where: { id: trackingId, userId },
  });

  if (!existing) {
    throw new AppError(404, 'Tracked email not found', 'NOT_FOUND');
  }

  if (existing.status === 'EXPIRED') {
    throw new AppError(409, 'Tracking record has expired', 'TRACKING_EXPIRED');
  }

  const now = new Date();
  if (
    (existing.status === 'PENDING' || existing.status === 'DISPATCHED') &&
    existing.expiresAt &&
    existing.expiresAt < now
  ) {
    await prisma.trackedEmail.updateMany({
      where: { id: existing.id, status: existing.status },
      data: { status: 'EXPIRED' },
    });
    throw new AppError(409, 'Tracking record has expired', 'TRACKING_EXPIRED');
  }

  if (existing.status === input.status) {
    return toTrackedEmailDTO(existing);
  }

  if (!CLIENT_ALLOWED_TRANSITIONS[existing.status].has(input.status)) {
    throw new AppError(
      409,
      `Cannot transition tracking record from ${existing.status} to ${input.status}`,
      'INVALID_LIFECYCLE_TRANSITION',
    );
  }

  const nextExpiresAt =
    input.status === 'DISPATCHED' ? new Date(now.getTime() + getDispatchedTtlMs()) : null;

  const updated = await prisma.trackedEmail.update({
    where: { id: existing.id },
    data: {
      status: input.status,
      sentAt: null,
      expiresAt: nextExpiresAt,
    },
  });

  return toTrackedEmailDTO(updated);
}

export interface TrustedSubmissionEvidence {
  provider: 'GMAIL_API';
  externalMessageId: string;
  sentAt?: Date;
}

/**
 * Trusted server-side operation to confirm SENT status only when verifiable
 * submission evidence (e.g., Gmail API messages.send response) is provided.
 */
export async function confirmTrackingSent(
  userId: string,
  trackingId: string,
  evidence: TrustedSubmissionEvidence,
): Promise<TrackedEmail> {
  if (evidence.provider !== 'GMAIL_API' || !evidence.externalMessageId.trim()) {
    throw new AppError(
      403,
      'Valid server-verified submission evidence is required to confirm SENT',
      'INSUFFICIENT_SUBMISSION_EVIDENCE',
    );
  }

  const existing = await prisma.trackedEmail.findFirst({
    where: { id: trackingId, userId },
  });

  if (!existing) {
    throw new AppError(404, 'Tracked email not found', 'NOT_FOUND');
  }

  if (existing.status === 'SENT') {
    return toTrackedEmailDTO(existing);
  }

  if (existing.status !== 'PENDING' && existing.status !== 'DISPATCHED') {
    throw new AppError(
      409,
      `Cannot confirm SENT from terminal status ${existing.status}`,
      'INVALID_LIFECYCLE_TRANSITION',
    );
  }

  const now = new Date();
  if (existing.expiresAt && existing.expiresAt < now) {
    await prisma.trackedEmail.updateMany({
      where: { id: existing.id, status: existing.status },
      data: { status: 'EXPIRED' },
    });
    throw new AppError(409, 'Tracking record has expired', 'TRACKING_EXPIRED');
  }

  const updated = await prisma.trackedEmail.update({
    where: { id: existing.id },
    data: {
      status: 'SENT',
      sentAt: evidence.sentAt ?? now,
      expiresAt: null,
    },
  });

  return toTrackedEmailDTO(updated);
}

/**
 * Atomically expires abandoned PENDING and DISPATCHED records past their UTC expiresAt.
 * SENT and FAILED records are never expired. Safe under concurrent execution.
 */
export async function expireAbandonedTrackingRecords(now: Date = new Date()): Promise<number> {
  const result = await prisma.trackedEmail.updateMany({
    where: {
      status: { in: ['PENDING', 'DISPATCHED'] },
      expiresAt: { lt: now },
    },
    data: {
      status: 'EXPIRED',
    },
  });
  return result.count;
}

export async function recordPixelEvent(params: {
  rawToken: string;
  userAgent: string | undefined;
}): Promise<void> {
  const token = params.rawToken.trim();
  if (!TOKEN_FORMAT_REGEX.test(token)) {
    return;
  }

  const trackingTokenHash = hashTrackingToken(token);
  const email = await prisma.trackedEmail.findUnique({
    where: { trackingTokenHash },
    select: {
      id: true,
      status: true,
      sentAt: true,
      expiresAt: true,
      firstRecordedAt: true,
    },
  });

  if (!email) {
    return;
  }

  if (email.status === 'FAILED' || email.status === 'EXPIRED') {
    return;
  }

  const now = new Date();
  if (
    (email.status === 'PENDING' || email.status === 'DISPATCHED') &&
    email.expiresAt &&
    email.expiresAt < now
  ) {
    await prisma.trackedEmail.updateMany({
      where: { id: email.id, status: email.status },
      data: { status: 'EXPIRED' },
    });
    return;
  }

  const oneMinuteAgo = new Date(now.getTime() - 60_000);
  const recentCount = await prisma.trackingEvent.count({
    where: {
      trackedEmailId: email.id,
      occurredAt: { gte: oneMinuteAgo },
    },
  });

  if (recentCount >= MAX_EVENTS_PER_MINUTE_PER_EMAIL) {
    return;
  }

  const classification = classifyTrackingRequest(params.userAgent, email.sentAt, now);

  await prisma.$transaction([
    prisma.trackingEvent.create({
      data: {
        trackedEmailId: email.id,
        eventType: 'PIXEL_REQUEST',
        classification,
        occurredAt: now,
      },
    }),
    ...(email.firstRecordedAt === null
      ? [
          prisma.trackedEmail.updateMany({
            where: { id: email.id, firstRecordedAt: null },
            data: { firstRecordedAt: now },
          }),
        ]
      : []),
  ]);
}

function buildDateRangeFilter(from?: Date, to?: Date): Prisma.DateTimeFilter | undefined {
  if (!from && !to) {
    return undefined;
  }
  const filter: Prisma.DateTimeFilter = {};
  if (from) filter.gte = from;
  if (to) filter.lte = to;
  return filter;
}

export async function listTrackedEmails(
  userId: string,
  params: {
    page: number;
    limit: number;
    search?: string;
    status?: TrackingStatus;
    campaignId?: string;
    from?: Date;
    to?: Date;
  },
): Promise<PaginatedTrackedEmailsResponse> {
  const skip = (params.page - 1) * params.limit;
  const searchTerm = params.search?.trim();
  const createdAtFilter = buildDateRangeFilter(params.from, params.to);

  const where: Prisma.TrackedEmailWhereInput = {
    userId,
    ...(params.status ? { status: params.status } : {}),
    ...(params.campaignId ? { campaignId: params.campaignId } : {}),
    ...(createdAtFilter ? { createdAt: createdAtFilter } : {}),
    ...(searchTerm
      ? {
          OR: [
            { recipientReference: { contains: searchTerm, mode: 'insensitive' } },
            { subject: { contains: searchTerm, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.trackedEmail.findMany({
      where,
      orderBy: [{ sentAt: 'desc' }, { createdAt: 'desc' }],
      skip,
      take: params.limit,
      include: {
        campaign: { select: { name: true } },
        _count: { select: { events: true } },
        events: {
          select: { occurredAt: true },
          orderBy: { occurredAt: 'desc' },
          take: 1,
        },
      },
    }),
    prisma.trackedEmail.count({ where }),
  ]);

  return {
    items: items.map(toTrackedEmailDTO),
    total,
    page: params.page,
    limit: params.limit,
    totalPages: Math.max(1, Math.ceil(total / params.limit)),
  };
}

export async function assignTrackedEmailCampaign(
  userId: string,
  trackingId: string,
  campaignId: string | null,
): Promise<TrackedEmail> {
  const email = await prisma.trackedEmail.findFirst({
    where: { id: trackingId, userId },
  });
  if (!email) {
    throw new AppError(404, 'Tracked email not found', 'NOT_FOUND');
  }

  if (campaignId !== null) {
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, userId },
      select: { id: true, status: true },
    });
    if (!campaign) {
      throw new AppError(404, 'Campaign not found', 'NOT_FOUND');
    }
    if (campaign.status === 'ARCHIVED') {
      throw new AppError(409, 'Cannot assign emails to an archived campaign', 'CAMPAIGN_ARCHIVED');
    }
  }

  const updated = await prisma.trackedEmail.update({
    where: { id: email.id },
    data: { campaignId },
    include: { campaign: { select: { name: true } } },
  });

  return toTrackedEmailDTO(updated);
}

export async function getTrackedEmailForOwner(
  userId: string,
  emailId: string,
): Promise<TrackedEmailDetail> {
  const email = await prisma.trackedEmail.findFirst({
    where: { id: emailId, userId },
    include: {
      campaign: { select: { name: true } },
      events: {
        orderBy: { occurredAt: 'asc' },
      },
    },
  });

  if (!email) {
    throw new AppError(404, 'Tracked email not found', 'NOT_FOUND');
  }

  const events = email.events.map((ev) => ({
    id: ev.id,
    trackedEmailId: ev.trackedEmailId,
    eventType: ev.eventType,
    classification: ev.classification,
    occurredAt: ev.occurredAt.toISOString(),
    createdAt: ev.createdAt.toISOString(),
  }));

  return {
    ...toTrackedEmailDTO({
      id: email.id,
      userId: email.userId,
      campaignId: email.campaignId,
      campaign: email.campaign,
      trackingTokenHash: email.trackingTokenHash,
      subject: email.subject,
      recipientReference: email.recipientReference,
      status: email.status,
      sentAt: email.sentAt,
      expiresAt: email.expiresAt,
      firstRecordedAt: email.firstRecordedAt,
      createdAt: email.createdAt,
    }),
    eventCount: events.length,
    lastRecordedAt: events.length > 0 ? events[events.length - 1]!.occurredAt : null,
    events,
  };
}

function toActivityEventItem(ev: {
  id: string;
  trackedEmailId: string;
  eventType: string;
  classification: EventClassification;
  occurredAt: Date;
  createdAt: Date;
  trackedEmail: {
    id: string;
    subject: string | null;
    recipientReference: string;
    status: TrackingStatus;
  };
}): ActivityEventItem {
  return {
    id: ev.id,
    trackedEmailId: ev.trackedEmailId,
    eventType: ev.eventType,
    classification: ev.classification,
    occurredAt: ev.occurredAt.toISOString(),
    createdAt: ev.createdAt.toISOString(),
    trackedEmail: {
      id: ev.trackedEmail.id,
      subject: ev.trackedEmail.subject,
      recipientReference: ev.trackedEmail.recipientReference,
      status: ev.trackedEmail.status,
    },
  };
}

export async function listTrackingEvents(
  userId: string,
  params: {
    page: number;
    limit: number;
    classification?: EventClassification;
    from?: Date;
    to?: Date;
  },
): Promise<PaginatedTrackingEventsResponse> {
  const skip = (params.page - 1) * params.limit;
  const occurredAtFilter = buildDateRangeFilter(params.from, params.to);

  const where: Prisma.TrackingEventWhereInput = {
    trackedEmail: { userId },
    ...(params.classification ? { classification: params.classification } : {}),
    ...(occurredAtFilter ? { occurredAt: occurredAtFilter } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.trackingEvent.findMany({
      where,
      orderBy: { occurredAt: 'desc' },
      skip,
      take: params.limit,
      include: {
        trackedEmail: {
          select: {
            id: true,
            subject: true,
            recipientReference: true,
            status: true,
          },
        },
      },
    }),
    prisma.trackingEvent.count({ where }),
  ]);

  return {
    items: items.map(toActivityEventItem),
    total,
    page: params.page,
    limit: params.limit,
    totalPages: Math.max(1, Math.ceil(total / params.limit)),
  };
}

function toUtcDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function getTrackingAnalytics(
  userId: string,
  params: {
    days: number;
    from?: Date;
    to?: Date;
  },
): Promise<DashboardAnalyticsResponse> {
  const toDate = params.to ?? new Date();
  const fromDate =
    params.from ??
    new Date(
      Date.UTC(
        toDate.getUTCFullYear(),
        toDate.getUTCMonth(),
        toDate.getUTCDate() - (params.days - 1),
        0,
        0,
        0,
        0,
      ),
    );

  if (fromDate > toDate) {
    throw new AppError(
      400,
      'Start date (from) must be before or equal to end date (to)',
      'INVALID_DATE_RANGE',
    );
  }

  const [statusGroups, classificationGroups, rangeEvents, recentEvents] = await Promise.all([
    prisma.trackedEmail.groupBy({
      by: ['status'],
      where: { userId },
      _count: { _all: true },
    }),
    prisma.trackingEvent.groupBy({
      by: ['classification'],
      where: {
        trackedEmail: { userId },
        occurredAt: { gte: fromDate, lte: toDate },
      },
      _count: { _all: true },
    }),
    prisma.trackingEvent.findMany({
      where: {
        trackedEmail: { userId },
        occurredAt: { gte: fromDate, lte: toDate },
      },
      select: {
        occurredAt: true,
        classification: true,
      },
      orderBy: { occurredAt: 'asc' },
    }),
    prisma.trackingEvent.findMany({
      where: {
        trackedEmail: { userId },
      },
      orderBy: { occurredAt: 'desc' },
      take: 10,
      include: {
        trackedEmail: {
          select: {
            id: true,
            subject: true,
            recipientReference: true,
            status: true,
          },
        },
      },
    }),
  ]);

  const statusCounts: TrackingStatusCounts = {
    PENDING: 0,
    DISPATCHED: 0,
    SENT: 0,
    FAILED: 0,
    EXPIRED: 0,
    totalEmails: 0,
  };

  for (const row of statusGroups) {
    const count = row._count._all;
    statusCounts[row.status] = count;
    statusCounts.totalEmails += count;
  }

  const classificationCounts: EventClassificationCounts = {
    RECORDED: 0,
    LIKELY_PROXY: 0,
    SUSPECTED_SCANNER: 0,
    totalEvents: 0,
  };

  for (const row of classificationGroups) {
    const count = row._count._all;
    classificationCounts[row.classification] = count;
    classificationCounts.totalEvents += count;
  }

  const dailyMap = new Map<string, DailyActivityPoint>();
  const cursor = new Date(
    Date.UTC(fromDate.getUTCFullYear(), fromDate.getUTCMonth(), fromDate.getUTCDate()),
  );
  const endCursor = new Date(
    Date.UTC(toDate.getUTCFullYear(), toDate.getUTCMonth(), toDate.getUTCDate()),
  );

  while (cursor <= endCursor) {
    const key = toUtcDateKey(cursor);
    dailyMap.set(key, {
      date: key,
      totalEvents: 0,
      recorded: 0,
      likelyProxy: 0,
      suspectedScanner: 0,
    });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  for (const ev of rangeEvents) {
    const key = toUtcDateKey(ev.occurredAt);
    let bucket = dailyMap.get(key);
    if (!bucket) {
      bucket = {
        date: key,
        totalEvents: 0,
        recorded: 0,
        likelyProxy: 0,
        suspectedScanner: 0,
      };
      dailyMap.set(key, bucket);
    }
    bucket.totalEvents += 1;
    if (ev.classification === 'RECORDED') bucket.recorded += 1;
    else if (ev.classification === 'LIKELY_PROXY') bucket.likelyProxy += 1;
    else if (ev.classification === 'SUSPECTED_SCANNER') bucket.suspectedScanner += 1;
  }

  const dailyActivity = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));

  return {
    rangeDays: dailyActivity.length,
    from: fromDate.toISOString(),
    to: toDate.toISOString(),
    statusCounts,
    classificationCounts,
    dailyActivity,
    recentEvents: recentEvents.map(toActivityEventItem),
  };
}
