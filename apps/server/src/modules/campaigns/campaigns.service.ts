import type {
  Campaign,
  CampaignAnalyticsResponse,
  CampaignComparisonItem,
  CampaignStatus,
  CreateCampaignRequest,
  DailyActivityPoint,
  EventClassificationCounts,
  PaginatedCampaignsResponse,
  PaginatedTrackedEmailsResponse,
  ReminderStatusCounts,
  TrackingStatus,
  TrackingStatusCounts,
  UpdateCampaignRequest,
} from '@mailtrack/shared';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../middleware/errorHandler.js';
import { listTrackedEmails } from '../tracking/tracking.service.js';

function toCampaignDTO(campaign: {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  status: CampaignStatus;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  _count?: { trackedEmails?: number };
}): Campaign {
  return {
    id: campaign.id,
    userId: campaign.userId,
    name: campaign.name,
    description: campaign.description,
    status: campaign.status,
    archivedAt: campaign.archivedAt ? campaign.archivedAt.toISOString() : null,
    createdAt: campaign.createdAt.toISOString(),
    updatedAt: campaign.updatedAt.toISOString(),
    ...(typeof campaign._count?.trackedEmails === 'number'
      ? { emailCount: campaign._count.trackedEmails }
      : {}),
  };
}

export async function createCampaign(
  userId: string,
  input: CreateCampaignRequest,
): Promise<Campaign> {
  const created = await prisma.campaign.create({
    data: {
      userId,
      name: input.name.trim(),
      description: input.description?.trim() ? input.description.trim() : null,
      status: 'ACTIVE',
    },
    include: {
      _count: { select: { trackedEmails: true } },
    },
  });

  return toCampaignDTO(created);
}

export async function listCampaigns(
  userId: string,
  params: {
    page: number;
    limit: number;
    search?: string;
    status?: CampaignStatus;
  },
): Promise<PaginatedCampaignsResponse> {
  const skip = (params.page - 1) * params.limit;
  const searchTerm = params.search?.trim();

  const where: Prisma.CampaignWhereInput = {
    userId,
    ...(params.status ? { status: params.status } : {}),
    ...(searchTerm
      ? {
          OR: [
            { name: { contains: searchTerm, mode: 'insensitive' } },
            { description: { contains: searchTerm, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.campaign.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: params.limit,
      include: {
        _count: { select: { trackedEmails: true } },
      },
    }),
    prisma.campaign.count({ where }),
  ]);

  return {
    items: items.map(toCampaignDTO),
    total,
    page: params.page,
    limit: params.limit,
    totalPages: Math.max(1, Math.ceil(total / params.limit)),
  };
}

export async function getCampaignById(userId: string, campaignId: string): Promise<Campaign> {
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, userId },
    include: {
      _count: { select: { trackedEmails: true } },
    },
  });

  if (!campaign) {
    throw new AppError(404, 'Campaign not found', 'NOT_FOUND');
  }

  return toCampaignDTO(campaign);
}

export async function updateCampaign(
  userId: string,
  campaignId: string,
  input: UpdateCampaignRequest,
): Promise<Campaign> {
  const existing = await prisma.campaign.findFirst({
    where: { id: campaignId, userId },
  });

  if (!existing) {
    throw new AppError(404, 'Campaign not found', 'NOT_FOUND');
  }

  if (existing.status === 'ARCHIVED') {
    throw new AppError(409, 'Archived campaigns cannot be edited', 'CAMPAIGN_ARCHIVED');
  }

  const updated = await prisma.campaign.update({
    where: { id: existing.id },
    data: {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.description !== undefined
        ? { description: input.description?.trim() ? input.description.trim() : null }
        : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
    },
    include: {
      _count: { select: { trackedEmails: true } },
    },
  });

  return toCampaignDTO(updated);
}

export async function archiveCampaign(userId: string, campaignId: string): Promise<Campaign> {
  const existing = await prisma.campaign.findFirst({
    where: { id: campaignId, userId },
    include: {
      _count: { select: { trackedEmails: true } },
    },
  });

  if (!existing) {
    throw new AppError(404, 'Campaign not found', 'NOT_FOUND');
  }

  if (existing.status === 'ARCHIVED') {
    return toCampaignDTO(existing);
  }

  const updated = await prisma.campaign.update({
    where: { id: existing.id },
    data: {
      status: 'ARCHIVED',
      archivedAt: new Date(),
    },
    include: {
      _count: { select: { trackedEmails: true } },
    },
  });

  return toCampaignDTO(updated);
}

export async function listCampaignEmails(
  userId: string,
  campaignId: string,
  params: {
    page: number;
    limit: number;
    search?: string;
    status?: TrackingStatus;
  },
): Promise<PaginatedTrackedEmailsResponse> {
  await getCampaignById(userId, campaignId);
  return listTrackedEmails(userId, {
    ...params,
    campaignId,
  });
}

function toUtcDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function getCampaignAnalytics(
  userId: string,
  campaignId: string,
  params: {
    days: number;
    from?: Date;
    to?: Date;
  },
): Promise<CampaignAnalyticsResponse> {
  const campaign = await getCampaignById(userId, campaignId);

  const now = new Date();
  const toDate = params.to ?? now;
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

  const [
    statusGroups,
    classificationGroups,
    rangeEvents,
    upcomingCount,
    overdueCount,
    completedCount,
    cancelledCount,
    topCampaigns,
  ] = await Promise.all([
    prisma.trackedEmail.groupBy({
      by: ['status'],
      where: { userId, campaignId },
      _count: { _all: true },
    }),
    prisma.trackingEvent.groupBy({
      by: ['classification'],
      where: {
        trackedEmail: { userId, campaignId },
        occurredAt: { gte: fromDate, lte: toDate },
      },
      _count: { _all: true },
    }),
    prisma.trackingEvent.findMany({
      where: {
        trackedEmail: { userId, campaignId },
        occurredAt: { gte: fromDate, lte: toDate },
      },
      select: {
        occurredAt: true,
        classification: true,
      },
      orderBy: { occurredAt: 'asc' },
    }),
    prisma.followUpReminder.count({
      where: {
        userId,
        status: 'PENDING',
        dueAt: { gte: now },
        trackedEmail: { userId, campaignId },
      },
    }),
    prisma.followUpReminder.count({
      where: {
        userId,
        status: 'PENDING',
        dueAt: { lt: now },
        trackedEmail: { userId, campaignId },
      },
    }),
    prisma.followUpReminder.count({
      where: {
        userId,
        status: 'COMPLETED',
        trackedEmail: { userId, campaignId },
      },
    }),
    prisma.followUpReminder.count({
      where: {
        userId,
        status: 'CANCELLED',
        trackedEmail: { userId, campaignId },
      },
    }),
    prisma.campaign.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 6,
      select: {
        id: true,
        name: true,
        status: true,
        _count: { select: { trackedEmails: true } },
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
    statusCounts[row.status] = row._count._all;
    statusCounts.totalEmails += row._count._all;
  }

  const classificationCounts: EventClassificationCounts = {
    RECORDED: 0,
    LIKELY_PROXY: 0,
    SUSPECTED_SCANNER: 0,
    totalEvents: 0,
  };

  for (const row of classificationGroups) {
    classificationCounts[row.classification] = row._count._all;
    classificationCounts.totalEvents += row._count._all;
  }

  const reminderCounts: ReminderStatusCounts = {
    upcoming: upcomingCount,
    overdue: overdueCount,
    completed: completedCount,
    cancelled: cancelledCount,
  };

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
    const bucket = dailyMap.get(key);
    if (!bucket) continue;
    bucket.totalEvents += 1;
    if (ev.classification === 'RECORDED') bucket.recorded += 1;
    else if (ev.classification === 'LIKELY_PROXY') bucket.likelyProxy += 1;
    else if (ev.classification === 'SUSPECTED_SCANNER') bucket.suspectedScanner += 1;
  }

  const dailyActivity = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));

  // Bounded comparison event counts for top 6 user campaigns
  const comparisonIds = topCampaigns.map((c) => c.id);
  const eventCountsByCampaign = new Map<string, number>();
  if (comparisonIds.length > 0) {
    const counts = await Promise.all(
      comparisonIds.map(async (id) => ({
        id,
        count: await prisma.trackingEvent.count({
          where: { trackedEmail: { userId, campaignId: id } },
        }),
      })),
    );
    for (const item of counts) {
      eventCountsByCampaign.set(item.id, item.count);
    }
  }

  const comparison: CampaignComparisonItem[] = topCampaigns.map((c) => ({
    id: c.id,
    name: c.name,
    status: c.status,
    totalEmails: c._count.trackedEmails,
    totalEvents: eventCountsByCampaign.get(c.id) ?? 0,
  }));

  return {
    campaign,
    rangeDays: dailyActivity.length,
    from: fromDate.toISOString(),
    to: toDate.toISOString(),
    statusCounts,
    classificationCounts,
    reminderCounts,
    dailyActivity,
    comparison,
  };
}
