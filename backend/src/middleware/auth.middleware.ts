/**
 * middleware/auth.middleware.ts — Firestore edition
 * JWT Bearer token validation. No DB lookup needed here — all claims are in the token.
 */

import { Request, Response, NextFunction } from 'express';
import { verifyToken, JwtPayload } from '../services/jwt.service.js';
import jwt from 'jsonwebtoken';
const { JsonWebTokenError, TokenExpiredError } = jwt;

declare global {
  namespace Express {
    interface Request { user?: JwtPayload; }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authorization header with Bearer token is required.' });
    return;
  }
  try {
    req.user = verifyToken(authHeader.slice(7));
    next();
  } catch (err) {
    if (err instanceof TokenExpiredError) {
      res.status(401).json({ error: 'TOKEN_EXPIRED', message: 'Your session has expired. Please sign in again.' });
    } else if (err instanceof JsonWebTokenError) {
      res.status(401).json({ error: 'INVALID_TOKEN', message: 'Invalid authentication token.' });
    } else {
      res.status(500).json({ error: 'AUTH_ERROR', message: 'Authentication failed.' });
    }
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user || req.user.role !== 'ADMIN') {
    res.status(403).json({ error: 'FORBIDDEN', message: 'This endpoint requires administrator access.' });
    return;
  }
  next();
}
