/**
 * requestLogger.ts — Structured HTTP request / response logger.
 *
 * ── Why pino-http ────────────────────────────────────────────────────────────
 * Morgan logs at request time — it never knows the final status code or how
 * long the response actually took. pino-http hooks into the response 'finish'
 * event, so every log line contains the complete picture:
 *   requestId · method · url · statusCode · responseTime(ms)
 *
 * ── Why requestId ────────────────────────────────────────────────────────────
 * A unique ID per request is the single most important instrument in a
 * distributed system. When one user action triggers DB queries, third-party
 * API calls, and cache lookups, the requestId threads all those log lines
 * together. Without it, debugging production incidents means searching
 * timestamps by hand — like sorting grains of sand.
 *
 * We use Node's built-in crypto.randomUUID() — cryptographically random
 * UUIDs require zero extra packages and are globally unique.
 *
 * ── Log level selection ───────────────────────────────────────────────────────
 * Pino-http chooses the level after the response finishes:
 *   5xx or thrown error → 'error'   (PagerDuty-worthy)
 *   4xx                 → 'warn'    (client mistake, worth monitoring)
 *   everything else     → 'info'
 *
 * ── What gets logged ─────────────────────────────────────────────────────────
 * Request:   { requestId, method, url }
 * Response:  { statusCode, responseTime }
 * Serialised as JSON in production; pretty-printed in development.
 */
import { randomUUID } from 'crypto';
import { Request, Response, NextFunction } from 'express';
import pinoHttp from 'pino-http';
import { logger } from '../utils/logger';

const httpLogger = pinoHttp({
  // Share the same pino instance as the app logger so all logs go to the
  // same stream and honour the same log level.
  logger,

  // Generate a UUID v4 for every incoming request.
  // pino-http stores it on req.id and automatically includes it in the
  // log line — no manual wiring required.
  genReqId: () => randomUUID(),

  // Select the log level AFTER the response has finished, when all info is
  // available (status code, errors). The default pino-http behaviour always
  // uses 'info', which means 500 errors look the same as 200s in your logs.
  customLogLevel: (_req, res, err) => {
    if (err !== undefined || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },

  // Control exactly which fields appear under the 'req' and 'res' keys.
  // Stripping headers prevents accidentally logging Authorization tokens or
  // cookies into your log aggregator.
  serializers: {
    req(req) {
      return {
        id: req.id,
        method: req.method,
        url: req.url,
      };
    },
    res(res) {
      return {
        statusCode: res.statusCode,
      };
    },
  },
});

/**
 * Composite Express middleware:
 *   1. pino-http attaches req.id (UUID), req.log (child logger), and
 *      registers the response listener that emits the final log line.
 *   2. We copy req.id → req.requestId so controllers and services can read
 *      it with a predictable name (e.g., to forward it in downstream calls
 *      or include it in API error responses).
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  httpLogger(req, res, () => {
    req.requestId = String(req.id);
    next();
  });
}
