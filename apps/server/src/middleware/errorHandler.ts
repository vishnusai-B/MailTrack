import type { NextFunction, Request, Response } from 'express';
import type { ApiErrorResponse } from '@mailtrack/shared';
import { ZodError } from 'zod';
import { env } from '../config/env.js';

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response<ApiErrorResponse>,
  _next: NextFunction,
): void {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: err.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; '),
      code: 'VALIDATION_ERROR',
    });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.message,
      ...(err.code ? { code: err.code } : {}),
    });
    return;
  }

  if (env.NODE_ENV === 'production') {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[UnhandledError]', { message });
  } else {
    console.error('[UnhandledError]', err);
  }
  res.status(500).json({
    error: 'Internal server error',
    code: 'INTERNAL_ERROR',
  });
}
