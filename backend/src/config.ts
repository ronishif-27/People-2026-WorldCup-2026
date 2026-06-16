/**
 * config.ts
 * Validates all required environment variables at startup.
 * The server will NOT start if any required var is missing.
 */

import { z } from 'zod';
import dotenv from 'dotenv';

// Load .env file in development (Cloud Run injects vars directly in production)
dotenv.config({ path: '../.env.local' });
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const envSchema = z.object({
  // Server
  PORT: z.string().default('8080').transform(Number),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  FRONTEND_URL: z.string().url(),

  // Firebase / Firestore
  FIREBASE_PROJECT_ID: z.string().default('ai-innovation-484111'),
  // GOOGLE_APPLICATION_CREDENTIALS is read directly by firebase-admin SDK from env

  // JWT
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('24h'),

  // Google OAuth
  GOOGLE_CLIENT_ID: z.string().min(1, 'GOOGLE_CLIENT_ID is required'),
  GOOGLE_CLIENT_SECRET: z.string().min(1, 'GOOGLE_CLIENT_SECRET is required'),
  GOOGLE_CALLBACK_URL: z.string().url(),

  // HiBob
  HIBOB_SERVICE_USER_ID: z.string().min(1, 'HIBOB_SERVICE_USER_ID is required'),
  HIBOB_SERVICE_USER_TOKEN: z.string().min(1, 'HIBOB_SERVICE_USER_TOKEN is required'),

  // Football Data API (football-data.org)
  FOOTBALL_DATA_API_KEY: z.string().default(''),

  // Admin accounts — comma-separated emails granted ADMIN role on first login
  ADMIN_EMAILS: z.string().default(''),
});

const parseResult = envSchema.safeParse(process.env);

if (!parseResult.success) {
  console.error('❌  Missing or invalid environment variables:\n');
  parseResult.error.issues.forEach((issue) => {
    console.error(`   • ${issue.path.join('.')}: ${issue.message}`);
  });
  console.error('\nCheck backend/.env.example for the full list of required variables.\n');
  process.exit(1);
}

export const config = parseResult.data;

/** List of emails that receive ADMIN role on first login */
export const adminEmails: Set<string> = new Set(
  config.ADMIN_EMAILS
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
);
