import "server-only";
import { createDatabase, type Database } from "./connect";

/**
 * The app's database.
 *
 * - `DATABASE_URL` set (Vercel + Neon): Postgres over the network.
 * - Not set (local development): an embedded Postgres (PGlite) stored in
 *   `frontend/.data/pglite`, created and migrated on first use. No install needed.
 */
const globalForDb = globalThis as unknown as { __kvDb?: Promise<Database> };

export function getDb(): Promise<Database> {
  globalForDb.__kvDb ??= createDatabase({ url: process.env.DATABASE_URL, dataDir: ".data/pglite" }).catch((err) => {
    globalForDb.__kvDb = undefined; // try again on the next request
    throw err;
  });
  return globalForDb.__kvDb;
}

export type { Database } from "./connect";
