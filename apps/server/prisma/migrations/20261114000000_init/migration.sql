-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "TrackingStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "EventClassification" AS ENUM ('RECORDED', 'LIKELY_PROXY', 'SUSPECTED_SCANNER');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT NOT NULL,
    "defaultTrackingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrackedEmail" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "trackingTokenHash" TEXT NOT NULL,
    "subject" TEXT,
    "recipientReference" TEXT NOT NULL,
    "status" "TrackingStatus" NOT NULL DEFAULT 'PENDING',
    "sentAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "firstRecordedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrackedEmail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrackingEvent" (
    "id" TEXT NOT NULL,
    "trackedEmailId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL DEFAULT 'PIXEL_REQUEST',
    "classification" "EventClassification" NOT NULL DEFAULT 'RECORDED',
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrackingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "TrackedEmail_trackingTokenHash_key" ON "TrackedEmail"("trackingTokenHash");

-- CreateIndex
CREATE INDEX "TrackedEmail_userId_idx" ON "TrackedEmail"("userId");

-- CreateIndex
CREATE INDEX "TrackedEmail_userId_sentAt_idx" ON "TrackedEmail"("userId", "sentAt" DESC);

-- CreateIndex
CREATE INDEX "TrackedEmail_status_expiresAt_idx" ON "TrackedEmail"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "TrackingEvent_trackedEmailId_idx" ON "TrackingEvent"("trackedEmailId");

-- CreateIndex
CREATE INDEX "TrackingEvent_occurredAt_idx" ON "TrackingEvent"("occurredAt");

-- CreateIndex
CREATE INDEX "TrackingEvent_trackedEmailId_occurredAt_idx" ON "TrackingEvent"("trackedEmailId", "occurredAt" ASC);

-- AddForeignKey
ALTER TABLE "TrackedEmail" ADD CONSTRAINT "TrackedEmail_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackingEvent" ADD CONSTRAINT "TrackingEvent_trackedEmailId_fkey" FOREIGN KEY ("trackedEmailId") REFERENCES "TrackedEmail"("id") ON DELETE CASCADE ON UPDATE CASCADE;
