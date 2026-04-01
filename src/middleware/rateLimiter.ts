/**
 * rateLimiter.ts — Configures express-rate-limit instances.
 *
 * WHY multiple limiters: Different endpoints need different windows.
 *   - globalRateLimiter  → applied to every route (broad protection)
 *   - authRateLimiter    → stricter, for login / register (brute-force guard)
 *
 * Both are exported so app.ts or individual routers can mount them.
 */
import rateLimit from 'express-rate-limit';
import { errorResponse } from '../utils/ApiResponse';

/** Applied globally — 100 requests per 15 minutes per IP. */
export const globalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,  // Return RateLimit-* headers (RFC 6585)
  legacyHeaders: false,   // Disable X-RateLimit-* headers
  message: errorResponse('Too many requests — please try again later.'),
});

/**
 * Stricter limiter for auth routes (login, register, reset-password).
 * 10 attempts per 15 minutes per IP.
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: errorResponse('Too many auth attempts — please try again later.'),
});
