import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { AppError } from '../../middleware/errorHandler.js';
import { TRANSPARENT_1X1_PNG } from '../../utils/pngPixel.js';
import * as trackingService from './tracking.service.js';

const RECIPIENT_EMAIL_REGEX = /^[^\s@<>",;]+@[^\s@<>",;]+\.[^\s@<>",;]{2,}$/;

function isValidRecipientReference(value: string): boolean {
  const parts = value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length > 0 && parts.every((part) => RECIPIENT_EMAIL_REGEX.test(part));
}

const registerTrackingSchema = z.object({
  recipientReference: z
    .string()
    .trim()
    .min(1)
    .max(320)
    .refine(isValidRecipientReference, 'Recipient must contain valid email address(es)'),
  subject: z.string().trim().max(255).optional(),
});

const updateStatusSchema = z.object({
  status: z.enum(['DISPATCHED', 'SENT', 'FAILED']),
});

const assignCampaignSchema = z.object({
  campaignId: z.string().uuid().nullable(),
});

const isoDateSchema = z
  .string()
  .trim()
  .refine((value) => !Number.isNaN(Date.parse(value)), 'Invalid ISO date')
  .transform((value) => new Date(value));

const listQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    search: z.string().trim().max(200).optional(),
    status: z.enum(['PENDING', 'DISPATCHED', 'SENT', 'FAILED', 'EXPIRED']).optional(),
    from: isoDateSchema.optional(),
    to: isoDateSchema.optional(),
  })
  .refine((q) => !q.from || !q.to || q.from <= q.to, {
    message: 'Start date (from) must be before or equal to end date (to)',
  });

const eventsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    classification: z.enum(['RECORDED', 'LIKELY_PROXY', 'SUSPECTED_SCANNER']).optional(),
    from: isoDateSchema.optional(),
    to: isoDateSchema.optional(),
  })
  .refine((q) => !q.from || !q.to || q.from <= q.to, {
    message: 'Start date (from) must be before or equal to end date (to)',
  });

const MAX_ANALYTICS_RANGE_MS = 366 * 24 * 60 * 60 * 1000;

const analyticsQuerySchema = z
  .object({
    days: z.coerce.number().int().min(1).max(90).default(30),
    from: isoDateSchema.optional(),
    to: isoDateSchema.optional(),
  })
  .refine((q) => !q.from || !q.to || q.from <= q.to, {
    message: 'Start date (from) must be before or equal to end date (to)',
  })
  .refine(
    (q) => {
      if (!q.from) return true;
      const end = q.to ?? new Date();
      return end.getTime() - q.from.getTime() <= MAX_ANALYTICS_RANGE_MS;
    },
    {
      message: 'Analytics date range cannot exceed 366 days',
    },
  );

export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = registerTrackingSchema.parse(req.body);
    const result = await trackingService.registerTracking(req.user!.id, input);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = updateStatusSchema.parse(req.body);
    if (input.status === 'SENT') {
      throw new AppError(
        403,
        'Extension/client requests cannot mark a record SENT without server-verified submission evidence',
        'SENT_CONFIRMATION_REQUIRES_TRUSTED_EVIDENCE',
      );
    }
    const updated = await trackingService.updateTrackingStatus(
      req.user!.id,
      String(req.params.id),
      { status: input.status },
    );
    res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
}

export async function assignCampaign(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const input = assignCampaignSchema.parse(req.body);
    const updated = await trackingService.assignTrackedEmailCampaign(
      req.user!.id,
      String(req.params.id),
      input.campaignId,
    );
    res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
}

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const query = listQuerySchema.parse(req.query);
    const result = await trackingService.listTrackedEmails(req.user!.id, query);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function getById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const email = await trackingService.getTrackedEmailForOwner(
      req.user!.id,
      String(req.params.id),
    );
    res.status(200).json(email);
  } catch (err) {
    next(err);
  }
}

export async function listEvents(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const query = eventsQuerySchema.parse(req.query);
    const result = await trackingService.listTrackingEvents(req.user!.id, query);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function analytics(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const query = analyticsQuerySchema.parse(req.query);
    const result = await trackingService.getTrackingAnalytics(req.user!.id, query);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export function servePixel(req: Request, res: Response): void {
  const rawToken = String(req.params.token ?? '');
  const userAgent =
    typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined;

  res.set({
    'Content-Type': 'image/png',
    'Content-Length': String(TRANSPARENT_1X1_PNG.length),
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
    Pragma: 'no-cache',
    Expires: '0',
    'Cross-Origin-Resource-Policy': 'cross-origin',
  });

  res.status(200).send(TRANSPARENT_1X1_PNG);

  void trackingService.recordPixelEvent({ rawToken, userAgent }).catch((err: unknown) => {
    // Log operational failure without ever logging raw tracking tokens
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[PixelIngestError]', { message });
  });
}
