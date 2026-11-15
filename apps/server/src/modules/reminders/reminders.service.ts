import type {
  CreateReminderRequest,
  FollowUpReminder,
  PaginatedRemindersResponse,
  ReminderFilter,
  ReminderStatus,
  TrackingStatus,
  UpdateReminderRequest,
} from '@mailtrack/shared';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../middleware/errorHandler.js';

function toReminderDTO(reminder: {
  id: string;
  userId: string;
  trackedEmailId: string;
  dueAt: Date;
  note: string | null;
  status: ReminderStatus;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  trackedEmail?: {
    id: string;
    subject: string | null;
    recipientReference: string;
    status: TrackingStatus;
  };
}): FollowUpReminder {
  return {
    id: reminder.id,
    userId: reminder.userId,
    trackedEmailId: reminder.trackedEmailId,
    dueAt: reminder.dueAt.toISOString(),
    note: reminder.note,
    status: reminder.status,
    completedAt: reminder.completedAt ? reminder.completedAt.toISOString() : null,
    createdAt: reminder.createdAt.toISOString(),
    updatedAt: reminder.updatedAt.toISOString(),
    ...(reminder.trackedEmail
      ? {
          trackedEmail: {
            id: reminder.trackedEmail.id,
            subject: reminder.trackedEmail.subject,
            recipientReference: reminder.trackedEmail.recipientReference,
            status: reminder.trackedEmail.status,
          },
        }
      : {}),
  };
}

function isPrismaUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: unknown }).code === 'P2002'
  );
}

export async function createReminder(
  userId: string,
  input: CreateReminderRequest,
): Promise<FollowUpReminder> {
  const email = await prisma.trackedEmail.findFirst({
    where: { id: input.trackedEmailId, userId },
    select: { id: true },
  });

  if (!email) {
    throw new AppError(404, 'Tracked email not found', 'NOT_FOUND');
  }

  const dueAt = new Date(input.dueAt);
  if (Number.isNaN(dueAt.getTime())) {
    throw new AppError(400, 'Invalid reminder due date', 'INVALID_DUE_DATE');
  }

  try {
    const created = await prisma.$transaction(async (tx) => {
      // Prevent duplicate PENDING reminder for the same email & timestamp
      const existing = await tx.followUpReminder.findFirst({
        where: {
          userId,
          trackedEmailId: email.id,
          status: 'PENDING',
          dueAt,
        },
        select: { id: true },
      });

      if (existing) {
        throw new AppError(
          409,
          'A pending reminder for this email at the same time already exists',
          'DUPLICATE_REMINDER',
        );
      }

      return tx.followUpReminder.create({
        data: {
          userId,
          trackedEmailId: email.id,
          dueAt,
          note: input.note?.trim() ? input.note.trim() : null,
          status: 'PENDING',
        },
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
      });
    });

    return toReminderDTO(created);
  } catch (err) {
    if (isPrismaUniqueViolation(err)) {
      throw new AppError(
        409,
        'A pending reminder for this email at the same time already exists',
        'DUPLICATE_REMINDER',
      );
    }
    throw err;
  }
}

export async function listReminders(
  userId: string,
  params: {
    page: number;
    limit: number;
    filter: ReminderFilter;
    campaignId?: string;
    trackedEmailId?: string;
  },
): Promise<PaginatedRemindersResponse> {
  const skip = (params.page - 1) * params.limit;
  const now = new Date();

  let statusFilter: Prisma.FollowUpReminderWhereInput = {};
  if (params.filter === 'upcoming') {
    statusFilter = { status: 'PENDING', dueAt: { gte: now } };
  } else if (params.filter === 'overdue') {
    statusFilter = { status: 'PENDING', dueAt: { lt: now } };
  } else if (params.filter === 'completed') {
    statusFilter = { status: 'COMPLETED' };
  } else if (params.filter === 'cancelled') {
    statusFilter = { status: 'CANCELLED' };
  }

  const where: Prisma.FollowUpReminderWhereInput = {
    userId,
    ...statusFilter,
    ...(params.trackedEmailId ? { trackedEmailId: params.trackedEmailId } : {}),
    ...(params.campaignId ? { trackedEmail: { userId, campaignId: params.campaignId } } : {}),
  };

  const orderBy: Prisma.FollowUpReminderOrderByWithRelationInput =
    params.filter === 'completed' || params.filter === 'cancelled'
      ? { updatedAt: 'desc' }
      : { dueAt: 'asc' };

  const [items, total] = await Promise.all([
    prisma.followUpReminder.findMany({
      where,
      orderBy,
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
    prisma.followUpReminder.count({ where }),
  ]);

  return {
    items: items.map(toReminderDTO),
    total,
    page: params.page,
    limit: params.limit,
    totalPages: Math.max(1, Math.ceil(total / params.limit)),
  };
}

export async function getReminderById(
  userId: string,
  reminderId: string,
): Promise<FollowUpReminder> {
  const reminder = await prisma.followUpReminder.findFirst({
    where: { id: reminderId, userId },
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
  });

  if (!reminder) {
    throw new AppError(404, 'Reminder not found', 'NOT_FOUND');
  }

  return toReminderDTO(reminder);
}

export async function updateReminder(
  userId: string,
  reminderId: string,
  input: UpdateReminderRequest,
): Promise<FollowUpReminder> {
  const existing = await prisma.followUpReminder.findFirst({
    where: { id: reminderId, userId },
  });

  if (!existing) {
    throw new AppError(404, 'Reminder not found', 'NOT_FOUND');
  }

  if (existing.status !== 'PENDING') {
    throw new AppError(
      409,
      `Cannot update a ${existing.status.toLowerCase()} reminder`,
      'INVALID_REMINDER_TRANSITION',
    );
  }

  let nextDueAt: Date | undefined;
  if (input.dueAt !== undefined) {
    nextDueAt = new Date(input.dueAt);
    if (Number.isNaN(nextDueAt.getTime())) {
      throw new AppError(400, 'Invalid reminder due date', 'INVALID_DUE_DATE');
    }
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      if (nextDueAt !== undefined) {
        const duplicate = await tx.followUpReminder.findFirst({
          where: {
            userId,
            trackedEmailId: existing.trackedEmailId,
            status: 'PENDING',
            dueAt: nextDueAt,
            id: { not: existing.id },
          },
          select: { id: true },
        });
        if (duplicate) {
          throw new AppError(
            409,
            'A pending reminder for this email at the same time already exists',
            'DUPLICATE_REMINDER',
          );
        }
      }

      return tx.followUpReminder.update({
        where: { id: existing.id },
        data: {
          ...(nextDueAt !== undefined ? { dueAt: nextDueAt } : {}),
          ...(input.note !== undefined
            ? { note: input.note?.trim() ? input.note.trim() : null }
            : {}),
        },
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
      });
    });

    return toReminderDTO(updated);
  } catch (err) {
    if (isPrismaUniqueViolation(err)) {
      throw new AppError(
        409,
        'A pending reminder for this email at the same time already exists',
        'DUPLICATE_REMINDER',
      );
    }
    throw err;
  }
}

export async function completeReminder(
  userId: string,
  reminderId: string,
): Promise<FollowUpReminder> {
  const existing = await prisma.followUpReminder.findFirst({
    where: { id: reminderId, userId },
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
  });

  if (!existing) {
    throw new AppError(404, 'Reminder not found', 'NOT_FOUND');
  }

  if (existing.status === 'COMPLETED') {
    return toReminderDTO(existing);
  }

  if (existing.status === 'CANCELLED') {
    throw new AppError(409, 'Cannot complete a cancelled reminder', 'INVALID_REMINDER_TRANSITION');
  }

  const updated = await prisma.followUpReminder.update({
    where: { id: existing.id },
    data: {
      status: 'COMPLETED',
      completedAt: new Date(),
    },
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
  });

  return toReminderDTO(updated);
}

export async function cancelReminder(
  userId: string,
  reminderId: string,
): Promise<FollowUpReminder> {
  const existing = await prisma.followUpReminder.findFirst({
    where: { id: reminderId, userId },
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
  });

  if (!existing) {
    throw new AppError(404, 'Reminder not found', 'NOT_FOUND');
  }

  if (existing.status === 'CANCELLED') {
    return toReminderDTO(existing);
  }

  if (existing.status === 'COMPLETED') {
    throw new AppError(409, 'Cannot cancel a completed reminder', 'INVALID_REMINDER_TRANSITION');
  }

  const updated = await prisma.followUpReminder.update({
    where: { id: existing.id },
    data: { status: 'CANCELLED' },
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
  });

  return toReminderDTO(updated);
}
