/**
 * db.ts — MongoDB connection singleton.
 *
 * WHY a singleton: MongoClient manages its own internal connection pool.
 * Creating multiple clients wastes sockets. One client, one pool, shared
 * across the entire application via getDB().
 */
import { MongoClient, Db } from 'mongodb';
import { env } from './env';

let client: MongoClient | null = null;
let db: Db | null = null;

/**
 * Connect to MongoDB. Safe to call once at startup.
 * Returns the Db instance for convenience.
 */
export async function connectDB(): Promise<Db> {
  if (db !== null) return db;

  client = new MongoClient(env.MONGODB_URI);
  await client.connect();

  // Derive the DB name from the URI path, or fall back to 'providerapp'.
  db = client.db();

  console.log('[DB] Connected to MongoDB');
  return db;
}

/**
 * Returns the active Db instance.
 * Throws if connectDB() has not been called yet — this prevents
 * silent failures where a service runs without a real DB connection.
 */
export function getDB(): Db {
  if (db === null) {
    throw new Error('[DB] Database not initialised. Call connectDB() first.');
  }
  return db;
}

/** Gracefully close the connection (used during shutdown). */
export async function closeDB(): Promise<void> {
  if (client !== null) {
    await client.close();
    client = null;
    db = null;
    console.log('[DB] Connection closed');
  }
}
