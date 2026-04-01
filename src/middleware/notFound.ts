/**
 * notFound.ts — Catch-all handler for unmatched routes.
 *
 * Registered after all routers so it only fires when nothing else matched.
 * Returns a structured 404 so clients get the same shape as every other error.
 */
import { Request, Response } from 'express';
import { errorResponse } from '../utils/ApiResponse';

export function notFound(req: Request, res: Response): void {
  res
    .status(404)
    .json(errorResponse(`Route not found: ${req.method} ${req.originalUrl}`));
}
