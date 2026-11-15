import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { pixelRateLimiter, registerTrackingRateLimiter } from '../../middleware/rateLimiter.js';
import * as trackingController from './tracking.controller.js';

export const trackingRegistrationRouter = Router();
trackingRegistrationRouter.use(requireAuth);
trackingRegistrationRouter.post(
  '/register',
  registerTrackingRateLimiter,
  trackingController.register,
);
trackingRegistrationRouter.get('/emails', trackingController.list);
trackingRegistrationRouter.get('/emails/:id', trackingController.getById);
trackingRegistrationRouter.patch('/emails/:id/status', trackingController.updateStatus);
trackingRegistrationRouter.patch('/emails/:id/campaign', trackingController.assignCampaign);
trackingRegistrationRouter.get('/events', trackingController.listEvents);
trackingRegistrationRouter.get('/analytics', trackingController.analytics);

export const pixelRouter = Router();
pixelRouter.get('/:token', pixelRateLimiter, trackingController.servePixel);
