/**
 * Imports the content team's video sheets from the command line (same rules as
 * Admin → Videos & textbooks → Import).
 *
 *   npm run content:import -- "Class4.xlsx" "class 9.xlsx" [--class 9] [--medium ta]
 *
 * Uses DATABASE_URL when set, otherwise the local database in .data/pglite
 * (stop `npm run dev` first). Prints what was linked and what needs checking.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { planImport, saveImport, subjectsFor } from "../src/server/content";
import { createDatabase } from "../src/server/db/connect";
import { parseVideoFile } from "../src/server/video-import";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { class: { type: "string" }, medium: { type: "string" } },
});

async function main() {
  if (!positionals.length) {
    console.error('Usage: npm run content:import -- <file.xlsx> [...] [--class N] [--medium en|ta]');
    process.exit(1);
  }
  const db = await createDatabase({ url: process.env.DATABASE_URL, dataDir: ".data/pglite" });
  for (const file of positionals) {
    const buf = readFileSync(file);
    const data = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
    const parsed = await parseVideoFile(data, {
      standard: values.class ? Number(values.class) : null,
      medium: values.medium === "ta" ? "ta" : "en",
      subjectsFor,
    });
    const planned = await planImport(db, parsed.units);
    const saved = await saveImport(db, planned, path.basename(file));
    const check = planned.filter((u) => u.match === "order" || u.match === null).length;
    console.log(`${path.basename(file)}: ${saved.units} units, ${saved.videos} videos; ${check} units to check; ${parsed.issues.length} links not imported`);
    for (const i of parsed.issues) console.log(`   ${i.sheet} row ${i.row}: ${i.reason} ${i.text}`);
  }
  process.exit(0);
}
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
