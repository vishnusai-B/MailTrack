import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import * as authService from './auth.service.js';

const registerSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(128),
  name: z.string().trim().min(1).max(100).optional(),
});

const loginSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(1).max(128),
});

const refreshSchema = z.object({
  refreshToken: z.string().trim().min(20).max(512),
});

const logoutSchema = z.object({
  refreshToken: z.string().trim().min(20).max(512).optional(),
});

export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = registerSchema.parse(req.body);
    const result = await authService.registerUser(input);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = loginSchema.parse(req.body);
    const result = await authService.loginUser(input);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function me(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await authService.getUserById(req.user!.id);
    res.status(200).json({ user });
  } catch (err) {
    next(err);
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = refreshSchema.parse(req.body);
    const result = await authService.refreshAuthSession(input.refreshToken);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = logoutSchema.parse(req.body ?? {});
    await authService.revokeRefreshToken(input.refreshToken);
    res.status(200).json({ ok: true });
  } catch (err) {
    next(err);
  }
}
