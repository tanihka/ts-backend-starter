/**
 * ApiResponse.ts — Standardised JSON response envelope.
 *
 * WHY: Every response the API sends should have a consistent shape so that
 * clients can write one generic handler instead of guessing field names.
 *
 * Shape:
 *   { success, message, data?, meta? }
 *
 * `meta` carries pagination info, totals, etc. — anything that is about the
 * response rather than the payload itself.
 */

export interface ApiResponseShape<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  meta?: Record<string, unknown>;
}

/** Build a successful response object. */
export function successResponse<T>(
  message: string,
  data?: T,
  meta?: Record<string, unknown>
): ApiResponseShape<T> {
  return { success: true, message, data, meta };
}

/** Build an error response object (used internally by the error handler). */
export function errorResponse(
  message: string
): ApiResponseShape<never> {
  return { success: false, message };
}
