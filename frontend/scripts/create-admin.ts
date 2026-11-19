/**
 * Creates an admin login. Run once after deploying, or locally:
 *
 *   npm run admin:create -- --username head --name "Head Office"
 *
 * Uses DATABASE_URL when set, otherwise the local database in .data/pglite
 * (stop `npm run dev` first: the local database can be open in one program at a time).
 * Prints the password once. Add --password to choose one (10+ characters).
 */
import { parseArgs } from "node:util";
import { createDatabase } from "../src/server/db/connect";
import { createStaff, InputError } from "../src/server/people";

const { values } = parseArgs({
  options: { username: { type: "string" }, name: { type: "string" }, password: { type: "string" }, role: { type: "string" } },
});

async function main() {
  if (!values.username || !values.name) {
    console.error('Usage: npm run admin:create -- --username <name> --name "<display name>" [--password <pw>] [--role teacher]');
    process.exit(1);
  }
  const db = await createDatabase({ url: process.env.DATABASE_URL, dataDir: ".data/pglite" });
  try {
    const login = await createStaff(db, {
      role: values.role === "teacher" ? "teacher" : "admin",
      displayName: values.name,
      username: values.username,
      password: values.password,
    });
    console.log(`Created ${login.role}: ${login.username}`);
    console.log(`Password (shown once): ${login.password}`);
  } catch (err) {
    console.error(err instanceof InputError ? `Not created: ${err.code}` : err);
    process.exit(1);
  }
  process.exit(0);
}
void main();
