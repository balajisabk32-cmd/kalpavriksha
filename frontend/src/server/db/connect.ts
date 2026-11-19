import { mkdirSync } from "node:fs";
import path from "node:path";
import { drizzle as drizzlePg, type NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

export type Database = NodePgDatabase<typeof schema>;

const MIGRATIONS = path.join(process.cwd(), "drizzle");

/**
 * Opens the database. With a URL it uses node-postgres (Neon's pooled URL works).
 * Without one it opens PGlite — on disk at `dataDir`, or in memory when `dataDir`
 * is "memory" (tests) — and applies the migrations in `frontend/drizzle/`.
 *
 * PGlite's Drizzle driver has the same query API, so the rest of the server code
 * is written once against `Database`.
 */
export async function createDatabase(opts: { url?: string; dataDir: string }): Promise<Database> {
  if (opts.url) {
    const { Pool } = await import("pg");
    // Keep connections open between requests: opening one to the database costs several round trips.
    const pool = new Pool({ connectionString: opts.url, max: 5, idleTimeoutMillis: 60_000 });
    return drizzlePg(pool, { schema });
  }

  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  if (opts.dataDir !== "memory") mkdirSync(path.resolve(opts.dataDir), { recursive: true });
  const client = opts.dataDir === "memory" ? new PGlite() : new PGlite(path.resolve(opts.dataDir));
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: MIGRATIONS });
  return db as unknown as Database;
}
