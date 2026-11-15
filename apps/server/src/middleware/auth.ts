import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError } from './errorHandler.js';

export interface AuthTokenPayload {
  sub: string;
  email: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
      };
    }
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    next(new AppError(401, 'Authentication required', 'UNAUTHORIZED'));
    return;
  }

  const token = header.slice(7).trim();
  if (!token) {
    next(new AppError(401, 'Authentication required', 'UNAUTHORIZED'));
    return;
  }

  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET, {
      algorithms: ['HS256'],
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
    }) as AuthTokenPayload;
    if (!decoded.sub || !decoded.email) {
      next(new AppError(401, 'Invalid authentication token', 'UNAUTHORIZED'));
      return;
    }
    req.user = { id: decoded.sub, email: decoded.email };
    next();
  } catch {
    next(new AppError(401, 'Invalid or expired authentication token', 'UNAUTHORIZED'));
  }
}
