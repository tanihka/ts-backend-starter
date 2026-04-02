/**
 * server.ts — Application entry point.
 *
 * Responsibilities (in order):
 *   1. Connect to MongoDB.
 *   2. Start the HTTP server.
 *   3. Register OS signal handlers for graceful shutdown.
 *   4. Handle unhandled promise rejections (last safety net).
 *
 * Nothing else belongs here. Business logic lives in services/,
 * middleware lives in middleware/, routing lives in routes/.
 */
import { connectDB, closeDB, connectMongoose } from './config/db';
import { setupCollections } from './db/setupCollection';
import { env } from './config/env';
import { logger } from './utils/logger';
import app from './app';

async function bootstrap(): Promise<void> {
  // 1. Database first — if this fails, no point starting the HTTP server.
  const db = await connectDB();
  await connectMongoose();
  await setupCollections(db);

  // 2. Start listening.
  const server = app.listen(env.PORT, () => {
    logger.info(`Server running in "${env.NODE_ENV}" mode on port ${env.PORT}`);
  });

  // 3. Graceful shutdown — gives in-flight requests time to finish.
  const shutdown = (signal: string) => async (): Promise<void> => {
    logger.info(`${signal} received — shutting down gracefully...`);
    server.close(async () => {
      await closeDB();
      logger.info('HTTP server closed. Process exiting.');
      process.exit(0);
    });

    // Force-kill after 10 seconds if requests are stuck.
    setTimeout(() => {
      logger.error('Graceful shutdown timed out — forcing exit.');
      process.exit(1);
    }, 10_000).unref(); // .unref() so the timer doesn't prevent natural exit
  };

  process.on('SIGTERM', shutdown('SIGTERM')); // sent by Docker / Kubernetes
  process.on('SIGINT', shutdown('SIGINT'));   // Ctrl+C in the terminal

  // 4. Catch unhandled promise rejections (e.g., a service forgot await).
  process.on('unhandledRejection', (reason: unknown) => {
    logger.error({ reason }, 'Unhandled promise rejection');
    // Treat as fatal — exit and let the process manager restart cleanly.
    server.close(() => process.exit(1));
  });
}

bootstrap().catch((err: unknown) => {
  // Runs if connectDB() or app.listen() itself throws.
  console.error('[FATAL] Failed to start server:', err);
  process.exit(1);
});
