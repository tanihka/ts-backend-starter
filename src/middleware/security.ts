/**
 * security.ts — Centralised security middleware factory.
 *
 * Every function here returns a configured middleware (or array of middleware)
 * that app.ts mounts in order. Keeping all security config in one file means:
 *  - One place to audit the security posture of the entire application.
 *  - Easy to tighten any layer without hunting across files.
 *  - Reviewers can verify the full chain at a glance.
 *
 * ── Layers (in mount order) ──────────────────────────────────────────────────
 *  1. configureHelmet    — HTTP security headers
 *  2. configureCors      — Cross-Origin Resource Sharing policy
 *  3. mongoSanitize      — NoSQL injection prevention
 *  4. sanitizeBody       — XSS / prototype-pollution guard on JSON body keys
 *
 * Request size limits are set directly on express.json() in app.ts (10 kb).
 * That is intentional: the body parser must enforce limits before any
 * middleware reads req.body, so it belongs at the parser call site.
 */

import helmet from 'helmet';
import cors, { CorsOptions } from 'cors';
import mongoSanitize from 'express-mongo-sanitize';
import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';

// ─────────────────────────────────────────────────────────────────────────────
// 1. HELMET — HTTP Security Headers
// ─────────────────────────────────────────────────────────────────────────────
/**
 * WHY: Browsers trust HTTP headers. Helmet instructs the browser to refuse
 * dangerous behaviours regardless of what the page content says.
 *
 * Real-world attacks each header blocks:
 *
 * contentSecurityPolicy
 *   Attack: Stored XSS — attacker injects <script src="https://evil.com/steal.js">
 *   Defence: CSP tells the browser "only execute scripts from our own origin".
 *   Note: `upgrade-insecure-requests` forces all subresources over HTTPS even
 *   if they are hardcoded as http://.
 *
 * crossOriginEmbedderPolicy
 *   Attack: Spectre-class CPU side-channel — attacker embeds your page in an
 *   iframe and reads memory via SharedArrayBuffer timing.
 *   Defence: Prevents cross-origin resources being loaded without explicit
 *   opt-in (CORP / COEP headers on the resource).
 *   Note: Disabled here because many CDN-hosted assets (fonts, images) do not
 *   yet send CORP headers. Enable it when you control all subresources.
 *
 * hsts (HTTP Strict Transport Security)
 *   Attack: SSL-strip — attacker MITM downgrades you from HTTPS to HTTP.
 *   Defence: Browser remembers "always use HTTPS for this domain" for 1 year.
 *   includeSubDomains: covers api.momkidcare.com, admin.momkidcare.com, etc.
 *
 * noSniff (X-Content-Type-Options: nosniff)
 *   Attack: MIME-sniff — attacker uploads a file named "photo.jpg" that
 *   contains JavaScript. IE/Chrome used to execute it anyway.
 *   Defence: Browser must honour the declared Content-Type.
 *
 * frameguard (X-Frame-Options: DENY)
 *   Attack: Clickjacking — attacker wraps your app in a transparent iframe
 *   and tricks users into clicking "Transfer money" thinking they click elsewhere.
 *   Defence: Browser refuses to render your page inside any frame.
 *
 * xXssProtection
 *   Set to false — the legacy X-XSS-Protection header is disabled in modern
 *   browsers and can itself cause XSS via its filtering mechanism in IE.
 *   CSP (above) is the correct, modern defence.
 *
 * hidePoweredBy
 *   Attack: Fingerprinting — "X-Powered-By: Express" tells bots exactly which
 *   CVE list to try. Removing it does not stop a determined attacker but
 *   eliminates automated opportunistic scans.
 */
export function configureHelmet() {
  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"], // allow inline styles for now
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'", 'https:', 'data:'],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
    crossOriginEmbedderPolicy: false, // re-enable once all CDN resources support CORP
    hsts: {
      maxAge: 31_536_000,       // 1 year in seconds
      includeSubDomains: true,
      preload: true,
    },
    noSniff: true,
    frameguard: { action: 'deny' },
    xXssProtection: false,      // legacy header — CSP is the real XSS defence
    hidePoweredBy: true,        // removes X-Powered-By: Express
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. CORS — Cross-Origin Resource Sharing
// ─────────────────────────────────────────────────────────────────────────────
/**
 * WHY: Without a CORS policy, any website can make credentialed requests to
 * your API from a user's browser. That means:
 *   Attack: malicious.com loads in a victim's browser, calls
 *     POST /api/v1/bookings with the victim's session cookie.
 *   Defence: Browser checks the Origin header against your allowlist.
 *   If the origin isn't allowed, the browser blocks the response before JS
 *   can read it. The request still reaches the server — CORS is a browser
 *   control, not a server firewall. The defence is that the attacker's JS
 *   never sees the response body, making the attack useless for data theft.
 *
 * WHY allowlist over wildcard ("*"):
 *   "*" disables credentials (cookies, Authorization headers) with CORS.
 *   To allow both credentials and CORS you MUST name specific origins.
 *   Using "*" + credentials is a config error that CORS rejects outright.
 *
 * Preflight (OPTIONS) requests:
 *   Before a "complex" request (non-GET/POST, custom headers), the browser
 *   sends OPTIONS to ask "are you allowed?". We reply with the allowed methods
 *   and headers and cache the answer for 24 hours (86400s) so the browser
 *   doesn't preflight every single API call.
 */
const corsOptions: CorsOptions = {
  origin(requestOrigin, callback) {
    // Allow server-to-server calls (no Origin header) and requests from
    // the configured whitelist.
    if (requestOrigin === undefined || env.ALLOWED_ORIGINS.includes(requestOrigin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: origin "${requestOrigin}" is not allowed`));
    }
  },
  credentials: true,            // Allow cookies and Authorization headers
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  exposedHeaders: ['X-Request-ID'], // allow clients to read this response header
  maxAge: 86_400,               // cache preflight for 24 hours
};

export function configureCors() {
  return cors(corsOptions);
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. NOSQL INJECTION SANITIZATION
// ─────────────────────────────────────────────────────────────────────────────
/**
 * WHY: MongoDB operators like $gt, $where, $regex are valid JSON keys.
 * Without sanitization, an attacker can craft a body like:
 *
 *   POST /api/v1/auth/login
 *   { "email": { "$gt": "" }, "password": { "$gt": "" } }
 *
 * MongoDB evaluates "$gt": "" as "greater than empty string" — true for every
 * document — so the query returns the first user in the DB. Instant auth bypass.
 *
 * express-mongo-sanitize strips any key that starts with "$" or contains "."
 * from req.body, req.query, and req.params before the request reaches a route.
 *
 * replaceWith: "_" — instead of deleting the key (which would silently corrupt
 * data), replace the dangerous character so it's still visible in logs.
 */
export function configureMongoSanitize() {
  return mongoSanitize({ replaceWith: '_' });
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. XSS / PROTOTYPE POLLUTION — Body Key Sanitization
// ─────────────────────────────────────────────────────────────────────────────
/**
 * WHY prototype pollution: An attacker sends:
 *   { "__proto__": { "isAdmin": true } }
 * If your code does object spread or Object.assign with req.body, this
 * contaminates Object.prototype globally — every {} in the process suddenly
 * has isAdmin: true. This breaks auth checks silently.
 *
 * WHY XSS from stored data: If you save user input to MongoDB and later
 * render it in a template or mobile app without escaping:
 *   { "name": "<script>document.cookie='stolen='+document.cookie</script>" }
 * The script runs in every browser that loads that profile.
 *
 * Strategy: walk every string value in req.body recursively and:
 *   1. Block __proto__, constructor, prototype keys outright.
 *   2. Strip HTML tags from string values (< > replaced with entities).
 *
 * This is intentionally lightweight — not a full HTML sanitizer library.
 * Content that needs rich HTML (e.g., a description field) should use a
 * dedicated library (DOMPurify server-side via jsdom) at the service layer.
 */

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function sanitizeValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return value
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }
  if (value !== null && typeof value === 'object') {
    return sanitizeObject(value as Record<string, unknown>);
  }
  return value;
}

function sanitizeObject(obj: Record<string, unknown>): Record<string, unknown> {
  const clean: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    if (FORBIDDEN_KEYS.has(key)) continue; // drop prototype-pollution keys
    clean[key] = sanitizeValue(obj[key]);
  }
  return clean;
}

/**
 * Express middleware — sanitizes req.body in place after body parsing.
 * Must be mounted AFTER express.json() so req.body is already populated.
 */
export function sanitizeBody(req: Request, _res: Response, next: NextFunction): void {
  if (req.body !== null && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body as Record<string, unknown>);
  }
  next();
}
