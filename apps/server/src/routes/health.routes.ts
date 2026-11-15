import { Router } from 'express';
import type { HealthCheckResponse } from '@mailtrack/shared';
import { checkDatabaseConnection } from '../lib/prisma.js';

export const healthRouter = Router();

healthRouter.get('/', async (_req, res) => {
  const dbConnected = await checkDatabaseConnection();

  const payload: HealthCheckResponse = {
    status: dbConnected ? 'ok' : 'degraded',
    service: 'mailtrack-server',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    database: dbConnected ? 'connected' : 'disconnected',
  };

  res.status(dbConnected ? 200 : 503).json(payload);
});
