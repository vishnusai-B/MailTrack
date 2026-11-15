export interface CleanupSchedulerHandle {
  stop: () => void;
  trigger: () => Promise<void>;
}

export interface CleanupSchedulerOptions {
  intervalMs: number;
  runCleanup: () => Promise<number>;
  logger?: Pick<Console, 'info' | 'error'>;
}

/**
 * Periodically invokes abandoned tracking record expiration within a single server process.
 * Multi-replica deployments may run this concurrently; `expireAbandonedTrackingRecords` uses
 * an atomic `updateMany` with status + UTC `expiresAt` guards so concurrent runs remain safe.
 */
export function startCleanupScheduler(options: CleanupSchedulerOptions): CleanupSchedulerHandle {
  const logger = options.logger ?? console;
  let inFlight = false;
  let stopped = false;

  const trigger = async (): Promise<void> => {
    if (stopped || inFlight) {
      return;
    }
    inFlight = true;
    try {
      const expiredCount = await options.runCleanup();
      if (expiredCount > 0) {
        logger.info(`[mailtrack-cleanup] expired ${expiredCount} abandoned tracking record(s)`);
      }
    } catch (err) {
      logger.error('[mailtrack-cleanup] scheduled cleanup failed:', err);
    } finally {
      inFlight = false;
    }
  };

  const timer = setInterval(() => {
    void trigger();
  }, options.intervalMs);

  if (typeof timer.unref === 'function') {
    timer.unref();
  }

  return {
    stop: () => {
      stopped = true;
      clearInterval(timer);
    },
    trigger,
  };
}
