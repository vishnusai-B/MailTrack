import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { buildCsv } from '../../utils/csv.js';
import * as campaignsService from '../campaigns/campaigns.service.js';

const MAX_EXPORT_ROWS = 5000;

const isoDateSchema = z
  .string()
  .trim()
  .refine((value) => !Number.isNaN(Date.parse(value)), 'Invalid ISO date')
  .transform((value) => new Date(value));

const emailExportQuerySchema = z
  .object({
    search: z.string().trim().max(200).optional(),
    status: z.enum(['PENDING', 'DISPATCHED', 'SENT', 'FAILED', 'EXPIRED']).optional(),
    campaignId: z.string().uuid().optional(),
    from: isoDateSchema.optional(),
    to: isoDateSchema.optional(),
  })
  .refine((q) => !q.from || !q.to || q.from <= q.to, {
    message: 'Start date (from) must be before or equal to end date (to)',
  });

const campaignExportQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  status: z.enum(['ACTIVE', 'COMPLETED', 'ARCHIVED']).optional(),
});

const eventsExportQuerySchema = z
  .object({
    classification: z.enum(['RECORDED', 'LIKELY_PROXY', 'SUSPECTED_SCANNER']).optional(),
    campaignId: z.string().uuid().optional(),
    from: isoDateSchema.optional(),
    to: isoDateSchema.optional(),
  })
  .refine((q) => !q.from || !q.to || q.from <= q.to, {
    message: 'Start date (from) must be before or equal to end date (to)',
  });

function sendCsv(res: Response, filename: string, csv: string): void {
  res.set({
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Cache-Control': 'no-store',
  });
  res.status(200).send(csv);
}

export async function exportEmails(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const query = emailExportQuerySchema.parse(req.query);
    const searchTerm = query.search?.trim();

    const rows = await prisma.trackedEmail.findMany({
      where: {
        userId: req.user!.id,
        ...(query.status ? { status: query.status } : {}),
        ...(query.campaignId ? { campaignId: query.campaignId } : {}),
        ...(query.from || query.to
          ? {
              createdAt: {
                ...(query.from ? { gte: query.from } : {}),
                ...(query.to ? { lte: query.to } : {}),
              },
            }
          : {}),
        ...(searchTerm
          ? {
              OR: [
                { recipientReference: { contains: searchTerm, mode: 'insensitive' } },
                { subject: { contains: searchTerm, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: MAX_EXPORT_ROWS,
      select: {
        id: true,
        recipientReference: true,
        subject: true,
        status: true,
        createdAt: true,
        sentAt: true,
        expiresAt: true,
        firstRecordedAt: true,
        campaign: { select: { name: true } },
        _count: { select: { events: true } },
      },
    });

    const csv = buildCsv(
      [
        'ID',
        'Recipient',
        'Subject',
        'Campaign',
        'Status',
        'Recorded Pixel Events',
        'Created At (UTC)',
        'Sent At (UTC)',
        'Expires At (UTC)',
        'First Recorded At (UTC)',
      ],
      rows.map((r) => [
        r.id,
        r.recipientReference,
        r.subject ?? '',
        r.campaign?.name ?? '',
        r.status,
        r._count?.events ?? 0,
        r.createdAt,
        r.sentAt,
        r.expiresAt,
        r.firstRecordedAt,
      ]),
    );

    sendCsv(res, 'mailtrack-emails.csv', csv);
  } catch (err) {
    next(err);
  }
}

export async function exportCampaigns(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const query = campaignExportQuerySchema.parse(req.query);
    const searchTerm = query.search?.trim();

    const rows = await prisma.campaign.findMany({
      where: {
        userId: req.user!.id,
        ...(query.status ? { status: query.status } : {}),
        ...(searchTerm
          ? {
              OR: [
                { name: { contains: searchTerm, mode: 'insensitive' } },
                { description: { contains: searchTerm, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: MAX_EXPORT_ROWS,
      select: {
        id: true,
        name: true,
        description: true,
        status: true,
        createdAt: true,
        archivedAt: true,
        _count: { select: { trackedEmails: true } },
      },
    });

    const csv = buildCsv(
      [
        'ID',
        'Name',
        'Description',
        'Status',
        'Tracked Emails',
        'Created At (UTC)',
        'Archived At (UTC)',
      ],
      rows.map((c) => [
        c.id,
        c.name,
        c.description ?? '',
        c.status,
        c._count?.trackedEmails ?? 0,
        c.createdAt,
        c.archivedAt,
      ]),
    );

    sendCsv(res, 'mailtrack-campaigns.csv', csv);
  } catch (err) {
    next(err);
  }
}

export async function exportCampaignAnalytics(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const days = z.coerce.number().int().min(1).max(90).default(30).parse(req.query.days);
    const analytics = await campaignsService.getCampaignAnalytics(
      req.user!.id,
      String(req.params.id),
      { days },
    );

    const csv = buildCsv(
      [
        'Date (UTC)',
        'Campaign',
        'Total Recorded Pixel Events',
        'RECORDED',
        'LIKELY_PROXY',
        'SUSPECTED_SCANNER',
      ],
      analytics.dailyActivity.map((d) => [
        d.date,
        analytics.campaign.name,
        d.totalEvents,
        d.recorded,
        d.likelyProxy,
        d.suspectedScanner,
      ]),
    );

    sendCsv(res, `mailtrack-campaign-${analytics.campaign.id}-analytics.csv`, csv);
  } catch (err) {
    next(err);
  }
}

export async function exportEvents(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const query = eventsExportQuerySchema.parse(req.query);

    const rows = await prisma.trackingEvent.findMany({
      where: {
        trackedEmail: {
          userId: req.user!.id,
          ...(query.campaignId ? { campaignId: query.campaignId } : {}),
        },
        ...(query.classification ? { classification: query.classification } : {}),
        ...(query.from || query.to
          ? {
              occurredAt: {
                ...(query.from ? { gte: query.from } : {}),
                ...(query.to ? { lte: query.to } : {}),
              },
            }
          : {}),
      },
      orderBy: { occurredAt: 'desc' },
      take: MAX_EXPORT_ROWS,
      select: {
        id: true,
        eventType: true,
        classification: true,
        occurredAt: true,
        trackedEmail: {
          select: {
            id: true,
            recipientReference: true,
            subject: true,
            status: true,
          },
        },
      },
    });

    const csv = buildCsv(
      [
        'Event ID',
        'Occurred At (UTC)',
        'Event Type',
        'Classification',
        'Tracked Email ID',
        'Recipient',
        'Subject',
        'Email Status',
      ],
      rows.map((ev) => [
        ev.id,
        ev.occurredAt,
        ev.eventType,
        ev.classification,
        ev.trackedEmail.id,
        ev.trackedEmail.recipientReference,
        ev.trackedEmail.subject ?? '',
        ev.trackedEmail.status,
      ]),
    );

    sendCsv(res, 'mailtrack-activity-events.csv', csv);
  } catch (err) {
    next(err);
  }
}
