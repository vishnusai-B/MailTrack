import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockCampaignCreate,
  mockCampaignFindMany,
  mockCampaignCount,
  mockCampaignFindFirst,
  mockCampaignUpdate,
  mockReminderCreate,
  mockReminderFindMany,
  mockReminderCount,
  mockReminderFindFirst,
  mockReminderUpdate,
  mockEmailFindFirst,
  mockEmailFindMany,
  mockEmailCount,
  mockEmailUpdate,
  mockEmailGroupBy,
  mockEventFindMany,
  mockEventCount,
  mockEventGroupBy,
} = vi.hoisted(() => ({
  mockCampaignCreate: vi.fn(),
  mockCampaignFindMany: vi.fn(),
  mockCampaignCount: vi.fn(),
  mockCampaignFindFirst: vi.fn(),
  mockCampaignUpdate: vi.fn(),
  mockReminderCreate: vi.fn(),
  mockReminderFindMany: vi.fn(),
  mockReminderCount: vi.fn(),
  mockReminderFindFirst: vi.fn(),
  mockReminderUpdate: vi.fn(),
  mockEmailFindFirst: vi.fn(),
  mockEmailFindMany: vi.fn(),
  mockEmailCount: vi.fn(),
  mockEmailUpdate: vi.fn(),
  mockEmailGroupBy: vi.fn(),
  mockEventFindMany: vi.fn(),
  mockEventCount: vi.fn(),
  mockEventGroupBy: vi.fn(),
}));

vi.mock('../src/lib/prisma.js', () => {
  const prismaMock = {
    campaign: {
      create: mockCampaignCreate,
      findMany: mockCampaignFindMany,
      count: mockCampaignCount,
      findFirst: mockCampaignFindFirst,
      update: mockCampaignUpdate,
    },
    followUpReminder: {
      create: mockReminderCreate,
      findMany: mockReminderFindMany,
      count: mockReminderCount,
      findFirst: mockReminderFindFirst,
      update: mockReminderUpdate,
    },
    trackedEmail: {
      findFirst: mockEmailFindFirst,
      findMany: mockEmailFindMany,
      count: mockEmailCount,
      update: mockEmailUpdate,
      groupBy: mockEmailGroupBy,
    },
    trackingEvent: {
      findMany: mockEventFindMany,
      count: mockEventCount,
      groupBy: mockEventGroupBy,
    },
    $transaction: vi.fn(),
    $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
    $disconnect: vi.fn(),
  };
  prismaMock.$transaction.mockImplementation(
    async (fn: (tx: typeof prismaMock) => Promise<unknown>) => fn(prismaMock),
  );
  return {
    prisma: prismaMock,
    checkDatabaseConnection: vi.fn().mockResolvedValue(true),
  };
});

import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { buildCsv, sanitizeCsvCell } from '../src/utils/csv.js';

function authHeader(userId: string, email: string): string {
  const token = jwt.sign({ sub: userId, email }, env.JWT_ACCESS_SECRET, {
    algorithm: 'HS256',
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
    expiresIn: '15m',
  });
  return `Bearer ${token}`;
}

const UUID_1 = '11111111-1111-4111-8111-111111111111';
const UUID_2 = '22222222-2222-4222-8222-222222222222';

describe('Phase 7: Campaigns, Reminders, CSV Export & Analytics (Mocked Prisma)', () => {
  const app = createApp();
  const now = new Date('2026-11-14T10:00:00.000Z');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Campaign Management', () => {
    it('creates, lists, updates, and archives campaigns scoped to authenticated user', async () => {
      const auth = authHeader('user-1', 'u1@example.com');
      const campaignRow = {
        id: UUID_1,
        userId: 'user-1',
        name: 'Q4 Outreach',
        description: 'Enterprise prospects',
        status: 'ACTIVE' as const,
        archivedAt: null,
        createdAt: now,
        updatedAt: now,
        _count: { trackedEmails: 2 },
      };

      mockCampaignCreate.mockResolvedValue(campaignRow);
      const created = await request(app)
        .post('/api/campaigns')
        .set('Authorization', auth)
        .send({ name: 'Q4 Outreach', description: 'Enterprise prospects' });
      expect(created.status).toBe(201);
      expect(created.body.name).toBe('Q4 Outreach');
      expect(created.body.emailCount).toBe(2);

      mockCampaignFindMany.mockResolvedValue([campaignRow]);
      mockCampaignCount.mockResolvedValue(1);
      const listed = await request(app)
        .get('/api/campaigns?search=Q4&status=ACTIVE')
        .set('Authorization', auth);
      expect(listed.status).toBe(200);
      expect(listed.body.items).toHaveLength(1);
      expect(mockCampaignFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: 'user-1', status: 'ACTIVE' }),
        }),
      );

      mockCampaignFindFirst.mockResolvedValue(campaignRow);
      mockCampaignUpdate.mockResolvedValue({ ...campaignRow, name: 'Q4 Outreach v2' });
      const updated = await request(app)
        .patch(`/api/campaigns/${UUID_1}`)
        .set('Authorization', auth)
        .send({ name: 'Q4 Outreach v2' });
      expect(updated.status).toBe(200);
      expect(updated.body.name).toBe('Q4 Outreach v2');

      mockCampaignUpdate.mockResolvedValue({
        ...campaignRow,
        status: 'ARCHIVED',
        archivedAt: now,
      });
      const archived = await request(app)
        .post(`/api/campaigns/${UUID_1}/archive`)
        .set('Authorization', auth);
      expect(archived.status).toBe(200);
      expect(archived.body.status).toBe('ARCHIVED');
    });

    it('enforces cross-user isolation on campaign access and email assignment', async () => {
      const user2Auth = authHeader('user-2', 'u2@example.com');

      mockCampaignFindFirst.mockResolvedValue(null);
      const crossGet = await request(app)
        .get(`/api/campaigns/${UUID_1}`)
        .set('Authorization', user2Auth);
      expect(crossGet.status).toBe(404);

      // Assign tracked email to campaign: success for owner
      const user1Auth = authHeader('user-1', 'u1@example.com');
      mockEmailFindFirst.mockResolvedValueOnce({ id: UUID_2, userId: 'user-1' });
      mockCampaignFindFirst.mockResolvedValueOnce({ id: UUID_1, status: 'ACTIVE' });
      mockEmailUpdate.mockResolvedValueOnce({
        id: UUID_2,
        userId: 'user-1',
        campaignId: UUID_1,
        campaign: { name: 'Q4 Outreach' },
        trackingTokenHash: 'hash',
        subject: 'Deck',
        recipientReference: 'lead@acme.com',
        status: 'DISPATCHED',
        sentAt: null,
        expiresAt: null,
        firstRecordedAt: null,
        createdAt: now,
      });

      const assigned = await request(app)
        .patch(`/api/tracking/emails/${UUID_2}/campaign`)
        .set('Authorization', user1Auth)
        .send({ campaignId: UUID_1 });
      expect(assigned.status).toBe(200);
      expect(assigned.body.campaignId).toBe(UUID_1);

      // Reject assigning another user's tracked email
      mockEmailFindFirst.mockResolvedValueOnce(null);
      const crossAssign = await request(app)
        .patch(`/api/tracking/emails/${UUID_2}/campaign`)
        .set('Authorization', user2Auth)
        .send({ campaignId: UUID_1 });
      expect(crossAssign.status).toBe(404);
    });
  });

  describe('Follow-up Reminders', () => {
    it('creates, lists, reschedules, completes, and cancels reminders with validation and ownership', async () => {
      const auth = authHeader('user-1', 'u1@example.com');
      const dueAt = new Date('2026-11-20T14:00:00.000Z');
      const reminderRow = {
        id: UUID_1,
        userId: 'user-1',
        trackedEmailId: UUID_2,
        dueAt,
        note: 'Follow up on proposal',
        status: 'PENDING' as const,
        completedAt: null,
        createdAt: now,
        updatedAt: now,
        trackedEmail: {
          id: UUID_2,
          subject: 'Proposal',
          recipientReference: 'buyer@corp.com',
          status: 'DISPATCHED' as const,
        },
      };

      // Reject invalid due date
      const badDate = await request(app)
        .post('/api/reminders')
        .set('Authorization', auth)
        .send({ trackedEmailId: UUID_2, dueAt: 'not-a-date' });
      expect(badDate.status).toBe(400);

      // Create reminder
      mockEmailFindFirst.mockResolvedValueOnce({ id: UUID_2 });
      mockReminderFindFirst.mockResolvedValueOnce(null);
      mockReminderCreate.mockResolvedValueOnce(reminderRow);
      const created = await request(app).post('/api/reminders').set('Authorization', auth).send({
        trackedEmailId: UUID_2,
        dueAt: dueAt.toISOString(),
        note: 'Follow up on proposal',
      });
      expect(created.status).toBe(201);
      expect(created.body.status).toBe('PENDING');

      // List reminders
      mockReminderFindMany.mockResolvedValueOnce([reminderRow]);
      mockReminderCount.mockResolvedValueOnce(1);
      const listed = await request(app)
        .get('/api/reminders?filter=upcoming')
        .set('Authorization', auth);
      expect(listed.status).toBe(200);
      expect(listed.body.items).toHaveLength(1);

      // Reschedule
      const newDue = '2026-11-25T15:00:00.000Z';
      mockReminderFindFirst.mockResolvedValueOnce(reminderRow);
      mockReminderUpdate.mockResolvedValueOnce({ ...reminderRow, dueAt: new Date(newDue) });
      const rescheduled = await request(app)
        .patch(`/api/reminders/${UUID_1}`)
        .set('Authorization', auth)
        .send({ dueAt: newDue });
      expect(rescheduled.status).toBe(200);
      expect(rescheduled.body.dueAt).toBe(newDue);

      // Complete
      mockReminderFindFirst.mockResolvedValueOnce(reminderRow);
      mockReminderUpdate.mockResolvedValueOnce({
        ...reminderRow,
        status: 'COMPLETED',
        completedAt: now,
      });
      const completed = await request(app)
        .post(`/api/reminders/${UUID_1}/complete`)
        .set('Authorization', auth);
      expect(completed.status).toBe(200);
      expect(completed.body.status).toBe('COMPLETED');

      // Cancel
      mockReminderFindFirst.mockResolvedValueOnce(reminderRow);
      mockReminderUpdate.mockResolvedValueOnce({ ...reminderRow, status: 'CANCELLED' });
      const cancelled = await request(app)
        .post(`/api/reminders/${UUID_1}/cancel`)
        .set('Authorization', auth);
      expect(cancelled.status).toBe(200);
      expect(cancelled.body.status).toBe('CANCELLED');

      // Cross-user reminder access rejected
      mockReminderFindFirst.mockResolvedValueOnce(null);
      const crossReminder = await request(app)
        .get(`/api/reminders/${UUID_1}`)
        .set('Authorization', authHeader('user-2', 'u2@example.com'));
      expect(crossReminder.status).toBe(404);
    });
  });

  describe('CSV Export & Formula Injection Protection', () => {
    it('escapes quotes/commas and neutralizes CSV formula injection', () => {
      expect(sanitizeCsvCell('=CMD("calc")')).toBe('"\'=CMD(""calc"")"');
      expect(sanitizeCsvCell('+1234')).toBe("'+1234");
      expect(sanitizeCsvCell('-SUM(A1:A2)')).toBe("'-SUM(A1:A2)");
      expect(sanitizeCsvCell('@malicious')).toBe("'@malicious");
      expect(sanitizeCsvCell('Hello, "World"')).toBe('"Hello, ""World"""');

      const emptyCsv = buildCsv(['Col1', 'Col2'], []);
      expect(emptyCsv).toBe('Col1,Col2');
    });

    it('exports user-scoped emails without raw tokens or IP addresses and handles empty exports', async () => {
      const auth = authHeader('user-1', 'u1@example.com');
      mockEmailFindMany.mockResolvedValueOnce([
        {
          id: UUID_2,
          recipientReference: '=evil@example.com',
          subject: 'Hello, World',
          status: 'DISPATCHED',
          createdAt: now,
          sentAt: null,
          expiresAt: null,
          firstRecordedAt: null,
          campaign: { name: 'Q4 Outreach' },
          _count: { events: 1 },
        },
      ]);

      const res = await request(app).get('/api/exports/emails').set('Authorization', auth);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.headers['content-disposition']).toContain('mailtrack-emails.csv');
      expect(res.text).toContain('ID,Recipient,Subject,Campaign,Status');
      expect(res.text).toContain("'=evil@example.com");
      expect(res.text).toContain('"Hello, World"');
      expect(res.text).not.toContain('trackingToken');
      expect(res.text).not.toContain('ipAddress');

      // Empty export returns header row cleanly
      mockEmailFindMany.mockResolvedValueOnce([]);
      const emptyRes = await request(app).get('/api/exports/emails').set('Authorization', auth);
      expect(emptyRes.status).toBe(200);
      expect(emptyRes.text.split('\r\n')).toHaveLength(1);
    });
  });

  describe('Campaign Analytics', () => {
    it('returns campaign-scoped status, classification, reminder, and comparison counts', async () => {
      const auth = authHeader('user-1', 'u1@example.com');
      mockCampaignFindFirst.mockResolvedValueOnce({
        id: UUID_1,
        userId: 'user-1',
        name: 'Q4 Outreach',
        description: null,
        status: 'ACTIVE',
        archivedAt: null,
        createdAt: now,
        updatedAt: now,
        _count: { trackedEmails: 3 },
      });
      mockEmailGroupBy.mockResolvedValueOnce([
        { status: 'DISPATCHED', _count: { _all: 2 } },
        { status: 'PENDING', _count: { _all: 1 } },
      ]);
      mockEventGroupBy.mockResolvedValueOnce([
        { classification: 'RECORDED', _count: { _all: 4 } },
        { classification: 'LIKELY_PROXY', _count: { _all: 1 } },
      ]);
      mockEventFindMany.mockResolvedValueOnce([
        { occurredAt: new Date(), classification: 'RECORDED' },
      ]);
      mockReminderCount
        .mockResolvedValueOnce(2) // upcoming
        .mockResolvedValueOnce(1) // overdue
        .mockResolvedValueOnce(3) // completed
        .mockResolvedValueOnce(0); // cancelled
      mockCampaignFindMany.mockResolvedValueOnce([
        {
          id: UUID_1,
          name: 'Q4 Outreach',
          status: 'ACTIVE',
          _count: { trackedEmails: 3 },
        },
      ]);
      mockEventCount.mockResolvedValueOnce(5);

      const res = await request(app)
        .get(`/api/campaigns/${UUID_1}/analytics?days=7`)
        .set('Authorization', auth);

      expect(res.status).toBe(200);
      expect(res.body.statusCounts.totalEmails).toBe(3);
      expect(res.body.statusCounts.SENT).toBe(0);
      expect(res.body.classificationCounts.totalEvents).toBe(5);
      expect(res.body.reminderCounts).toEqual({
        upcoming: 2,
        overdue: 1,
        completed: 3,
        cancelled: 0,
      });
      expect(res.body.comparison).toHaveLength(1);
    });
  });

  describe('Phase 7 Audit: Security, Concurrency & Edge Cases', () => {
    it('enforces campaign ownership and blocks assigning emails to archived campaigns or another user', async () => {
      const auth = authHeader('user-1', 'u1@example.com');

      // Cross-user campaign read -> 404
      mockCampaignFindFirst.mockResolvedValueOnce(null);
      const getOther = await request(app)
        .get(`/api/campaigns/${UUID_1}`)
        .set('Authorization', auth);
      expect(getOther.status).toBe(404);
      expect(mockCampaignFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: UUID_1, userId: 'user-1' } }),
      );

      // Assign another user's email -> 404
      mockEmailFindFirst.mockResolvedValueOnce(null);
      const assignOtherEmail = await request(app)
        .patch(`/api/tracking/emails/${UUID_2}/campaign`)
        .set('Authorization', auth)
        .send({ campaignId: UUID_1 });
      expect(assignOtherEmail.status).toBe(404);

      // Assign own email to archived campaign -> 409
      mockEmailFindFirst.mockResolvedValueOnce({ id: UUID_2 });
      mockCampaignFindFirst.mockResolvedValueOnce({ id: UUID_1, status: 'ARCHIVED' });
      const assignArchived = await request(app)
        .patch(`/api/tracking/emails/${UUID_2}/campaign`)
        .set('Authorization', auth)
        .send({ campaignId: UUID_1 });
      expect(assignArchived.status).toBe(409);
      expect(assignArchived.body.code).toBe('CAMPAIGN_ARCHIVED');
    });

    it('maps concurrent P2002 reminder creation to 409 and rejects invalid transitions & cross-user access', async () => {
      const auth = authHeader('user-1', 'u1@example.com');

      // Concurrent duplicate reminder triggers P2002 from DB unique index
      mockEmailFindFirst.mockResolvedValueOnce({ id: UUID_2 });
      mockReminderFindFirst.mockResolvedValueOnce(null);
      mockReminderCreate.mockRejectedValueOnce({ code: 'P2002' });

      const dupRes = await request(app).post('/api/reminders').set('Authorization', auth).send({
        trackedEmailId: UUID_2,
        dueAt: '2026-11-20T10:00:00.000Z',
        note: 'Concurrent reminder',
      });
      expect(dupRes.status).toBe(409);
      expect(dupRes.body.code).toBe('DUPLICATE_REMINDER');

      // Invalid transition: completing a CANCELLED reminder -> 409
      mockReminderFindFirst.mockResolvedValueOnce({
        id: UUID_1,
        userId: 'user-1',
        trackedEmailId: UUID_2,
        dueAt: now,
        note: null,
        status: 'CANCELLED',
        completedAt: null,
        createdAt: now,
        updatedAt: now,
      });
      const completeCancelled = await request(app)
        .post(`/api/reminders/${UUID_1}/complete`)
        .set('Authorization', auth);
      expect(completeCancelled.status).toBe(409);
      expect(completeCancelled.body.code).toBe('INVALID_REMINDER_TRANSITION');

      // Overdue UTC boundary filtering uses dueAt < now
      mockReminderFindMany.mockResolvedValueOnce([]);
      mockReminderCount.mockResolvedValueOnce(0);
      const overdueRes = await request(app)
        .get('/api/reminders?filter=overdue')
        .set('Authorization', auth);
      expect(overdueRes.status).toBe(200);
      expect(mockReminderFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'user-1',
            status: 'PENDING',
            dueAt: { lt: expect.any(Date) },
          }),
        }),
      );

      // Cross-user reminder access -> 404
      mockReminderFindFirst.mockResolvedValueOnce(null);
      const otherRem = await request(app)
        .get(`/api/reminders/${UUID_1}`)
        .set('Authorization', auth);
      expect(otherRem.status).toBe(404);
    });

    it('neutralizes leading whitespace & control-char CSV formula payloads and enforces export ownership', async () => {
      expect(sanitizeCsvCell('  =CMD("calc")')).toBe('"\'  =CMD(""calc"")"');
      expect(sanitizeCsvCell('\n=1+1')).toBe('"\'\n=1+1"');
      expect(sanitizeCsvCell('\u0000+SUM(A1)')).toBe("'\u0000+SUM(A1)");

      const auth = authHeader('user-1', 'u1@example.com');
      mockCampaignFindFirst.mockResolvedValueOnce(null);
      const otherExport = await request(app)
        .get(`/api/exports/campaigns/${UUID_1}/analytics`)
        .set('Authorization', auth);
      expect(otherExport.status).toBe(404);
    });
  });
});
