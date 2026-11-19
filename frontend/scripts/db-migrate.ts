/**
 * Applies the SQL migrations in drizzle/ to DATABASE_URL (Neon on Vercel).
 * Runs before each production build (see "vercel-build" in package.json).
 * The local database (PGlite) migrates itself on start, so this is skipped without a URL.
 */
import path from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.log("DATABASE_URL not set: skipping migrations (local database migrates itself).");
    return;
  }
  const pool = new Pool({ connectionString: url, max: 1 });
  await migrate(drizzle(pool), { migrationsFolder: path.join(process.cwd(), "drizzle") });
  await pool.end();
  console.log("Migrations applied.");
}
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
