/**
 * app.ts — Express application factory.
 *
 * WHY separate from server.ts:
 *   In server.ts you do: connectDB() → app.listen()
 *   Here you only configure Express itself.
 *
 * This means in tests you can:
 *   import app from './app';
 *   supertest(app).get('/api/v1/health')
 * ...without ever starting a real HTTP server or touching MongoDB.
 *
 * ── Middleware pipeline (order is load-bearing) ───────────────────────────────
 *  1. configureCors      — must be first so preflight OPTIONS requests are
 *                          answered before any other middleware runs.
 *  2. configureHelmet    — security headers on every response including errors.
 *  3. requestLogger      — log everything, including rate-limited/blocked requests.
 *  4. globalRateLimiter  — block flood before body is parsed (saves CPU).
 *  5. express.json()     — parse body only after rate-limit passes; 10 kb cap.
 *  6. configureMongoSanitize — strip $ / . operators from the parsed body.
 *  7. sanitizeBody       — scrub XSS tags + prototype-pollution keys from body.
 *  8. router             — feature routes.
 *  9. notFound()         — 404 catch-all, fires only if no router matched.
 * 10. errorHandler()     — must be last (4-arg Express error handler).
 */
import express from 'express';

import {
  configureHelmet,
  configureCors,
  configureMongoSanitize,
  sanitizeBody,
} from './middleware/security';
import { requestLogger } from './middleware/requestLogger';
import { globalRateLimiter } from './middleware/rateLimiter';
import { errorHandler } from './middleware/errorHandler';
import { notFound } from './middleware/notFound';
import router from './routes';

const app = express();

// ── 1. CORS ───────────────────────────────────────────────────────────────────
// First: OPTIONS preflight requests must get CORS headers before anything else.
app.use(configureCors());

// ── 2. Security headers ───────────────────────────────────────────────────────
app.use(configureHelmet());

// ── 3. Structured request logging + requestId injection ───────────────────────
app.use(requestLogger);

// ── 4. Global rate limiting ───────────────────────────────────────────────────
app.use(globalRateLimiter);

// ── 5. Body parsing ───────────────────────────────────────────────────────────
// 10 kb hard cap — large payloads are rejected before any processing happens.
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// ── 6. NoSQL injection sanitization ──────────────────────────────────────────
// Must run after body parsing — strips MongoDB operators ($gt, $where, etc.)
// from req.body, req.query, and req.params.
app.use(configureMongoSanitize());

// ── 7. XSS + prototype-pollution sanitization ────────────────────────────────
// Strips < > from string values, drops __proto__ / constructor keys.
app.use(sanitizeBody);

// ── 8. API routes ─────────────────────────────────────────────────────────────
app.use('/api/v1', router);

// ── 9. 404 — must come after all routers ─────────────────────────────────────
app.use(notFound);

// ── 10. Global error handler — must be last ───────────────────────────────────
app.use(errorHandler);

export default app;
