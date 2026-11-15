import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import * as campaignsController from './campaigns.controller.js';

export const campaignsRouter = Router();

campaignsRouter.use(requireAuth);
campaignsRouter.post('/', campaignsController.create);
campaignsRouter.get('/', campaignsController.list);
campaignsRouter.get('/:id', campaignsController.getById);
campaignsRouter.patch('/:id', campaignsController.update);
campaignsRouter.post('/:id/archive', campaignsController.archive);
campaignsRouter.get('/:id/emails', campaignsController.listEmails);
campaignsRouter.get('/:id/analytics', campaignsController.analytics);
