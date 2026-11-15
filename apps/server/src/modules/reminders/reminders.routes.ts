import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import * as remindersController from './reminders.controller.js';

export const remindersRouter = Router();

remindersRouter.use(requireAuth);
remindersRouter.post('/', remindersController.create);
remindersRouter.get('/', remindersController.list);
remindersRouter.get('/:id', remindersController.getById);
remindersRouter.patch('/:id', remindersController.update);
remindersRouter.post('/:id/complete', remindersController.complete);
remindersRouter.post('/:id/cancel', remindersController.cancel);
