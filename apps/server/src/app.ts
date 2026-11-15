import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env, parseOrigins } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { campaignsRouter } from './modules/campaigns/campaigns.routes.js';
import { exportsRouter } from './modules/exports/exports.routes.js';
import { remindersRouter } from './modules/reminders/reminders.routes.js';
import { pixelRouter, trackingRegistrationRouter } from './modules/tracking/tracking.routes.js';
import { healthRouter } from './routes/health.routes.js';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  const allowedOrigins = [
    ...parseOrigins(env.DASHBOARD_ORIGIN),
    ...parseOrigins(env.EXTENSION_ORIGIN),
  ];

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        if (env.NODE_ENV !== 'production' && origin.startsWith('chrome-extension://')) {
          return callback(null, true);
        }
        return callback(new Error('Origin not allowed by CORS'));
      },
      credentials: true,
    }),
  );

  app.use(express.json({ limit: '64kb' }));

  app.use('/health', healthRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/tracking', trackingRegistrationRouter);
  app.use('/api/campaigns', campaignsRouter);
  app.use('/api/reminders', remindersRouter);
  app.use('/api/exports', exportsRouter);
  app.use('/api/track', pixelRouter);

  app.use((_req, res) => {
    res.status(404).json({ error: 'Route not found', code: 'NOT_FOUND' });
  });

  app.use(errorHandler);

  return app;
}
