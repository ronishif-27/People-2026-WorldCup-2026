/**
 * services/jwt.service.ts
 * Signs and verifies JWT access tokens.
 *
 * Token lifetime: 24 hours (product spec — users should not need to re-login
 * within a single day of match watching).
 */

import jwt from 'jsonwebtoken';
import { config } from '../config.js';

export interface JwtPayload {
  userId: string;
  email: string;
  role: 'USER' | 'ADMIN';
  /** Issued-at timestamp (added automatically by jsonwebtoken) */
  iat?: number;
  /** Expiry timestamp */
  exp?: number;
}

/**
 * Signs a new JWT access token with a 24-hour expiry.
 */
export function signToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, config.JWT_SECRET, {
    expiresIn: config.JWT_EXPIRES_IN as unknown as number, // '24h' — cast required for jsonwebtoken v9 types
    algorithm: 'HS256',
  });
}

/**
 * Verifies and decodes a JWT.
 * Throws JsonWebTokenError or TokenExpiredError if invalid.
 */
export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, config.JWT_SECRET, {
    algorithms: ['HS256'],
  }) as JwtPayload;
}
