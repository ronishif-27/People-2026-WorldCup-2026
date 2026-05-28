/**
 * middleware/auth.middleware.ts
 *
 * Express middleware that validates the JWT Bearer token on every
 * protected route.
 *
 * Usage:
 *   router.get('/protected', requireAuth, (req, res) => { ... });
 *   router.get('/admin-only', requireAuth, requireAdmin, (req, res) => { ... });
 */

import { Request, Response, NextFunction } from 'express';
import { verifyToken, JwtPayload } from '../services/jwt.service.js';
// jsonwebtoken is CJS — use default import with esModuleInterop, then destructure
import jwt from 'jsonwebtoken';
const { JsonWebTokenError, TokenExpiredError } = jwt;

// Extend Express Request so downstream handlers have req.user typed
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

/**
 * requireAuth — attaches req.user or returns 401.
 * Reads the JWT from the Authorization: Bearer <token> header.
 */
export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Authorization header with Bearer token is required.',
    });
    return;
  }

  const token = authHeader.slice(7); // strip "Bearer "

  try {
    req.user = verifyToken(token);
    next();
  } catch (err) {
    if (err instanceof TokenExpiredError) {
      res.status(401).json({
        error: 'TOKEN_EXPIRED',
        message: 'Your session has expired. Please sign in again.',
      });
    } else if (err instanceof JsonWebTokenError) {
      res.status(401).json({
        error: 'INVALID_TOKEN',
        message: 'Invalid authentication token.',
      });
    } else {
      res.status(500).json({
        error: 'AUTH_ERROR',
        message: 'Authentication failed.',
      });
    }
  }
}

/**
 * requireAdmin — must be chained AFTER requireAuth.
 * Returns 403 if the authenticated user is not an ADMIN.
 */
export function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.user || req.user.role !== 'ADMIN') {
    res.status(403).json({
      error: 'FORBIDDEN',
      message: 'This endpoint requires administrator access.',
    });
    return;
  }
  next();
}
