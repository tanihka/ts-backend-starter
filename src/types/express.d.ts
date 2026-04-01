/**
 * types/express.d.ts — Augment the Express Request type.
 *
 * WHY: When middleware attaches custom properties to `req`, TypeScript will
 * complain that the property doesn't exist unless we declare it here.
 * This single declaration propagates full type safety across the entire app —
 * no `(req as any)` casts anywhere.
 *
 * HOW TO USE: Add new properties as you build features.
 *
 *   import type { AuthUser } from '../features/auth/auth.types';
 *
 *   declare global {
 *     namespace Express {
 *       interface Request {
 *         user?: AuthUser;
 *       }
 *     }
 *   }
 */

declare global {
  namespace Express {
    interface Request {
      /**
       * Unique UUID assigned to every request by requestLogger middleware.
       * Use this to correlate log lines for a single request — especially
       * across async operations and downstream service calls.
       * Set by: src/middleware/requestLogger.ts
       */
      requestId: string;

      // user?: import('../features/auth/auth.types').AuthUser;
    }
  }
}


// This empty export makes TypeScript treat the file as a module (required
// for global augmentation to work correctly alongside other .d.ts files).
export {};
