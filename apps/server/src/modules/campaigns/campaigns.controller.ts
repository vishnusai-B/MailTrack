import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import * as campaignsService from './campaigns.service.js';

const createCampaignSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional(),
});

const updateCampaignSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  status: z.enum(['ACTIVE', 'COMPLETED']).optional(),
});

const listCampaignsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(200).optional(),
  status: z.enum(['ACTIVE', 'COMPLETED', 'ARCHIVED']).optional(),
});

const listCampaignEmailsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(15),
  search: z.string().trim().max(200).optional(),
  status: z.enum(['PENDING', 'DISPATCHED', 'SENT', 'FAILED', 'EXPIRED']).optional(),
});

const isoDateSchema = z
  .string()
  .trim()
  .refine((value) => !Number.isNaN(Date.parse(value)), 'Invalid ISO date')
  .transform((value) => new Date(value));

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
    { message: 'Analytics date range cannot exceed 366 days' },
  );

export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = createCampaignSchema.parse(req.body);
    const created = await campaignsService.createCampaign(req.user!.id, input);
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
}

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const query = listCampaignsQuerySchema.parse(req.query);
    const result = await campaignsService.listCampaigns(req.user!.id, query);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function getById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const campaign = await campaignsService.getCampaignById(req.user!.id, String(req.params.id));
    res.status(200).json(campaign);
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = updateCampaignSchema.parse(req.body);
    const updated = await campaignsService.updateCampaign(
      req.user!.id,
      String(req.params.id),
      input,
    );
    res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
}

export async function archive(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const archived = await campaignsService.archiveCampaign(req.user!.id, String(req.params.id));
    res.status(200).json(archived);
  } catch (err) {
    next(err);
  }
}

export async function listEmails(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const query = listCampaignEmailsQuerySchema.parse(req.query);
    const result = await campaignsService.listCampaignEmails(
      req.user!.id,
      String(req.params.id),
      query,
    );
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function analytics(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const query = analyticsQuerySchema.parse(req.query);
    const result = await campaignsService.getCampaignAnalytics(
      req.user!.id,
      String(req.params.id),
      query,
    );
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}
