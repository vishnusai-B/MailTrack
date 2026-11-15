import { createApp } from './app.js';
import { env } from './config/env.js';
import { startCleanupScheduler } from './lib/cleanupScheduler.js';
import { prisma } from './lib/prisma.js';
import { expireAbandonedTrackingRecords } from './modules/tracking/tracking.service.js';

const SHUTDOWN_TIMEOUT_MS = 10_000;

const app = createApp();

const server = app.listen(env.PORT, () => {
  console.log(`[mailtrack-server] listening on port ${env.PORT} (env=${env.NODE_ENV})`);
});

const cleanupScheduler = startCleanupScheduler({
  intervalMs: env.CLEANUP_INTERVAL_MS,
  runCleanup: () => expireAbandonedTrackingRecords(),
});

let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;

  console.log(`[mailtrack-server] received ${signal}, shutting down...`);
  cleanupScheduler.stop();

  const forceTimer = setTimeout(() => {
    console.error('[mailtrack-server] graceful shutdown timed out, forcing exit');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);

  if (typeof forceTimer.unref === 'function') {
    forceTimer.unref();
  }

  server.close(async () => {
    clearTimeout(forceTimer);
    try {
      await prisma.$disconnect();
    } catch (err) {
      console.error('[mailtrack-server] error disconnecting Prisma:', err);
    }
    process.exit(0);
  });

  if (typeof server.closeIdleConnections === 'function') {
    server.closeIdleConnections();
  }
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
