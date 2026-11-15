import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import * as exportsController from './exports.controller.js';

export const exportsRouter = Router();

exportsRouter.use(requireAuth);
exportsRouter.get('/emails', exportsController.exportEmails);
exportsRouter.get('/campaigns', exportsController.exportCampaigns);
exportsRouter.get('/campaigns/:id/analytics', exportsController.exportCampaignAnalytics);
exportsRouter.get('/events', exportsController.exportEvents);
