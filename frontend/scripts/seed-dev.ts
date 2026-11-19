/**
 * Local development only: creates an admin, a teacher and a few students in the
 * embedded database (.data/pglite) and writes their logins to .data/dev-logins.txt.
 * Refuses to run against DATABASE_URL. Stop `npm run dev` first.
 *
 *   npm run db:seed-dev
 */
import { writeFileSync } from "node:fs";
import { createDatabase } from "../src/server/db/connect";
import { countUsers, createStaff, createStudent, type NewLogin } from "../src/server/people";

async function main() {
  if (process.env.DATABASE_URL) throw new Error("seed-dev is for the local database only. Unset DATABASE_URL.");
  const db = await createDatabase({ dataDir: ".data/pglite" });
  if ((await countUsers(db)) > 0) {
    console.log("Users already exist; nothing seeded. Logins are in .data/dev-logins.txt.");
    process.exit(0);
  }
  const logins: (NewLogin & { role: string; standard?: number })[] = [];
  logins.push(await createStaff(db, { role: "admin", displayName: "Office Admin", username: "admin" }));
  logins.push(await createStaff(db, { role: "teacher", displayName: "Lakshmi (Teacher)", username: "teacher" }));
  for (const s of [
    { displayName: "Priya Devi", standard: 7, medium: "ta" as const },
    { displayName: "Arun Kumar", standard: 10, medium: "en" as const },
    { displayName: "Kavin", standard: 11, medium: "en" as const, groupId: "cs" },
    { displayName: "Meena", standard: 4, medium: "ta" as const },
  ]) {
    logins.push({ ...(await createStudent(db, s, null)), role: "student" });
  }
  const text = [
    "Local development logins (not for production). Created by scripts/seed-dev.ts.",
    "",
    ...logins.map((l) => `${l.role.padEnd(8)} ${l.username.padEnd(16)} ${l.password}   ${l.displayName}${l.standard ? ` (Class ${l.standard})` : ""}`),
    "",
  ].join("\n");
  writeFileSync(".data/dev-logins.txt", text, "utf8");
  console.log(`Seeded ${logins.length} users. Logins written to .data/dev-logins.txt`);
  process.exit(0);
}
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
