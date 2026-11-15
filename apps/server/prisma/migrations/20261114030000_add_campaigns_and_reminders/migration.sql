-- Additive migration for Campaign Management and Follow-Up Reminders
-- Preserves all existing User, RefreshToken, TrackedEmail, and TrackingEvent records.

CREATE TYPE "CampaignStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'ARCHIVED');
CREATE TYPE "ReminderStatus" AS ENUM ('PENDING', 'COMPLETED', 'CANCELLED');

CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "CampaignStatus" NOT NULL DEFAULT 'ACTIVE',
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FollowUpReminder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "trackedEmailId" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "status" "ReminderStatus" NOT NULL DEFAULT 'PENDING',
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FollowUpReminder_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "TrackedEmail" ADD COLUMN "campaignId" TEXT;

CREATE INDEX "TrackedEmail_userId_campaignId_idx" ON "TrackedEmail"("userId", "campaignId");
CREATE INDEX "Campaign_userId_status_idx" ON "Campaign"("userId", "status");
CREATE INDEX "Campaign_userId_createdAt_idx" ON "Campaign"("userId", "createdAt" DESC);
CREATE INDEX "FollowUpReminder_userId_status_dueAt_idx" ON "FollowUpReminder"("userId", "status", "dueAt");
CREATE INDEX "FollowUpReminder_trackedEmailId_status_idx" ON "FollowUpReminder"("trackedEmailId", "status");

ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrackedEmail" ADD CONSTRAINT "TrackedEmail_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FollowUpReminder" ADD CONSTRAINT "FollowUpReminder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FollowUpReminder" ADD CONSTRAINT "FollowUpReminder_trackedEmailId_fkey" FOREIGN KEY ("trackedEmailId") REFERENCES "TrackedEmail"("id") ON DELETE CASCADE ON UPDATE CASCADE;
