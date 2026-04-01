/**
 * logger.ts — Pino-based structured logger (application events).
 *
 * WHY pino over winston:
 *   - ~5x faster: JSON serialisation runs in a worker thread (pino-pretty)
 *     so the hot path is non-blocking.
 *   - JSON-first: log aggregators (Datadog, CloudWatch, ELK) ingest it
 *     directly — no transform plugins needed.
 *   - Single well-maintained package for both app logs and HTTP logs
 *     (via pino-http companion, used in requestLogger.ts).
 *
 * In DEVELOPMENT:  pino-pretty formats logs as coloured, human-readable text.
 * In PRODUCTION:   raw newline-delimited JSON → stdout → log aggregator.
 *
 * Log level ladder (lowest → highest):
 *   trace  debug  info  warn  error  fatal
 * Default: 'debug' in dev (everything), 'info' in prod (suppress debug noise).
 *
 * This logger is for APPLICATION events: DB connect, startup, service errors.
 * HTTP request/response logs are handled separately in requestLogger.ts.
 */
import pino from 'pino';
import { env } from '../config/env';

const isDev = env.NODE_ENV !== 'production';

export const logger = pino({
  level: isDev ? 'debug' : 'info',

  // Development: pipe through pino-pretty (runs in a worker thread — no
  // performance hit on the main thread). Production: raw JSON to stdout.
  ...(isDev
    ? {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:HH:MM:ss.l',
            ignore: 'pid,hostname',
            messageKey: 'msg',
          },
        },
      }
    : {}),
});
