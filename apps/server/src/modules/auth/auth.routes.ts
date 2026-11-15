import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { authRateLimiter, failedLoginRateLimiter } from '../../middleware/rateLimiter.js';
import * as authController from './auth.controller.js';

export const authRouter = Router();

authRouter.post('/register', authRateLimiter, authController.register);
authRouter.post('/login', authRateLimiter, failedLoginRateLimiter, authController.login);
authRouter.post('/refresh', authRateLimiter, authController.refresh);
authRouter.post('/logout', authRateLimiter, authController.logout);
authRouter.get('/me', requireAuth, authController.me);
