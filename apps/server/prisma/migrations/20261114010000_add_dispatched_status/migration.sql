-- Non-destructive enum extension for uncertain DOM send dispatch state
ALTER TYPE "TrackingStatus" ADD VALUE IF NOT EXISTS 'DISPATCHED';
