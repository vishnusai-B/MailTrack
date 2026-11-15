import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import * as remindersService from './reminders.service.js';

const isoDateStringSchema = z
  .string()
  .trim()
  .refine((value) => !Number.isNaN(Date.parse(value)), 'Invalid ISO date');

const createReminderSchema = z.object({
  trackedEmailId: z.string().uuid(),
  dueAt: isoDateStringSchema,
  note: z.string().trim().max(300).optional(),
});

const updateReminderSchema = z.object({
  dueAt: isoDateStringSchema.optional(),
  note: z.string().trim().max(300).nullable().optional(),
});

const listRemindersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  filter: z.enum(['upcoming', 'overdue', 'completed', 'cancelled', 'all']).default('upcoming'),
  campaignId: z.string().uuid().optional(),
  trackedEmailId: z.string().uuid().optional(),
});

export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = createReminderSchema.parse(req.body);
    const created = await remindersService.createReminder(req.user!.id, input);
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
}

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const query = listRemindersQuerySchema.parse(req.query);
    const result = await remindersService.listReminders(req.user!.id, query);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function getById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const reminder = await remindersService.getReminderById(req.user!.id, String(req.params.id));
    res.status(200).json(reminder);
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = updateReminderSchema.parse(req.body);
    const updated = await remindersService.updateReminder(
      req.user!.id,
      String(req.params.id),
      input,
    );
    res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
}

export async function complete(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const completed = await remindersService.completeReminder(req.user!.id, String(req.params.id));
    res.status(200).json(completed);
  } catch (err) {
    next(err);
  }
}

export async function cancel(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const cancelled = await remindersService.cancelReminder(req.user!.id, String(req.params.id));
    res.status(200).json(cancelled);
  } catch (err) {
    next(err);
  }
}
