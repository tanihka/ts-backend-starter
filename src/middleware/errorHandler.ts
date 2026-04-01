/**
 * errorHandler.ts — Global Express error handler.
 *
 * Must be registered LAST with app.use() — Express identifies a 4-argument
 * middleware as an error handler.
 *
 * Strategy:
 *  - ApiError (operational) → send its message + status to the client.
 *  - Unknown error          → log full details server-side; send generic
 *                             "Internal server error" in production (never
 *                             leak stack traces or DB details to clients).
 */
import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/ApiError';
import { errorResponse } from '../utils/ApiResponse';
import { logger } from '../utils/logger';
import { env } from '../config/env';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  // next must be declared even if unused — Express requires all 4 params
  // to recognise this as an error-handling middleware.
  _next: NextFunction
): void {
  if (err instanceof ApiError && err.isOperational) {
    res.status(err.statusCode).json(errorResponse(err.message));
    return;
  }

  // Unexpected / programmer error
  logger.error({ err }, 'Unhandled error');

  res.status(500).json(
    errorResponse(
      env.NODE_ENV === 'production'
        ? 'Internal server error'
        : err.message
    )
  );
}
