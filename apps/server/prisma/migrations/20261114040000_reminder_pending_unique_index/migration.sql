-- Enforce uniqueness for pending follow-up reminders on the same tracked email and due timestamp
CREATE UNIQUE INDEX "FollowUpReminder_unique_pending_per_email_idx"
ON "FollowUpReminder"("trackedEmailId", "dueAt")
WHERE "status" = 'PENDING';
