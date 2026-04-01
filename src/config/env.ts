/**
 * env.ts — Single source of truth for all environment variables.
 *
 * WHY: Centralising env access means:
 *  1. The app crashes at startup (not mid-request) if a required var is missing.
 *  2. Every consumer gets a typed value, not `string | undefined`.
 *  3. One file to audit for config — no scattered `process.env` calls.
 */
import dotenv from 'dotenv';

// Load .env into process.env before any validation runs.
dotenv.config();

/** Throws immediately if a required env var is absent or empty. */
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `[Config] Missing required environment variable: "${name}". ` +
        'Check your .env file against .env.example.'
    );
  }
  return value;
}

export const env = {
  NODE_ENV: (process.env['NODE_ENV'] ?? 'development') as
    | 'development'
    | 'production'
    | 'test',
  PORT: parseInt(process.env['PORT'] ?? '3000', 10),
  MONGODB_URI: requireEnv('MONGODB_URI'),

  // CORS — comma-separated list of allowed origins.
  // Example: "https://momkidcare.com,https://app.momkidcare.com"
  // In development this defaults to localhost:5173 (Vite dev server).
  // NEVER set this to "*" in production — that disables Same-Origin protection.
  ALLOWED_ORIGINS: (process.env['ALLOWED_ORIGINS'] ?? 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
} as const;
