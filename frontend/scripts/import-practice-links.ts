/**
 * Links exercise chapters (from the guide content) to app chapters, from a CSV:
 *   guide_key,…,app_chapter_id,…,confidence,…
 * guide_key is the practice chapter key the exercise import made.
 *
 *   npm run practice:links -- "C:\…\textbooks\practice-links.csv" --dry-run
 *   npm run practice:links -- "C:\…\practice-links.csv"                (high and medium confidence)
 *   npm run practice:links -- "C:\…\practice-links.csv" --include-low
 *   npm run practice:links -- "C:\…\practice-links.csv" --force        (also replace links set by hand in Admin)
 *
 * Run it after practice:import. Links are kept when the content is imported again.
 * Needs DATABASE_URL for the live site.
 */
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { eq } from "drizzle-orm";
import { readCsv } from "../src/lib/csv";
import { findSubject } from "../src/server/content";
import { createDatabase } from "../src/server/db/connect";
import { practiceChapters } from "../src/server/db/schema";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { "dry-run": { type: "boolean" }, "include-low": { type: "boolean" }, force: { type: "boolean" } },
});

async function main() {
  const file = positionals[0];
  if (!file) {
    console.error('Usage: npm run practice:links -- "<practice-links.csv>" [--dry-run] [--include-low] [--force]');
    process.exit(1);
  }
  const rows = readCsv(readFileSync(file, "utf8"));
  const db = await createDatabase({ url: process.env.DATABASE_URL, dataDir: ".data/pglite" });
  const chapters = new Map(
    (await db.select({ id: practiceChapters.id, key: practiceChapters.key, subjectId: practiceChapters.subjectId, appChapterId: practiceChapters.appChapterId, manual: practiceChapters.appChapterManual }).from(practiceChapters)).map((c) => [c.key, c]),
  );
  const problems: string[] = [];
  let linked = 0;
  let same = 0;
  let low = 0;
  let manual = 0;

  for (const r of rows) {
    const key = r.guide_key ?? "";
    const target = r.app_chapter_id ?? "";
    if (r.confidence === "low" && !values["include-low"]) {
      low++;
      continue;
    }
    const ch = chapters.get(key);
    if (!ch) {
      problems.push(`${key}: not in the database (run practice:import first)`);
      continue;
    }
    if (!target || !findSubject(ch.subjectId)?.chapters.some((c) => c.id === target)) {
      problems.push(`${key}: "${target}" is not a chapter of ${ch.subjectId}`);
      continue;
    }
    if (ch.appChapterId === target) {
      same++;
      continue;
    }
    if (ch.manual && !values.force) {
      manual++;
      continue;
    }
    if (!values["dry-run"]) await db.update(practiceChapters).set({ appChapterId: target, appChapterManual: true }).where(eq(practiceChapters.id, ch.id));
    linked++;
  }

  const unlinked = [...chapters.values()].filter((c) => !c.appChapterId).length;
  console.log(`${values["dry-run"] ? "Would link" : "Linked"} ${linked} chapters; ${same} already right.`);
  if (low) console.log(`${low} low-confidence rows skipped (--include-low to add them).`);
  if (manual) console.log(`${manual} chapters linked by hand in Admin were kept (--force to replace).`);
  if (!values["dry-run"]) console.log(`Chapters with no link before this run: ${unlinked}.`);
  if (problems.length) {
    console.log(`\n${problems.length} rows not used:`);
    for (const p of problems.slice(0, 60)) console.log(`  ${p}`);
    if (problems.length > 60) console.log(`  … and ${problems.length - 60} more`);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
