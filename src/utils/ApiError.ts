/**
 * ApiError.ts — Custom operational error.
 *
 * WHY a custom class:
 *  - Lets the global error handler distinguish "known" errors (wrong input,
 *    not found, unauthorised) from unexpected programmer bugs.
 *  - Carries an HTTP status code so handlers don't need to hardcode numbers.
 *  - isOperational = true → safe to send message to the client.
 *  - isOperational = false → programming bug, hide message in production.
 */
export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(statusCode: number, message: string, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;

    // Restore the prototype chain broken by extending built-in Error.
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}
