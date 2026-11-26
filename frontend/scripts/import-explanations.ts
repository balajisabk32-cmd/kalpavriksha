/**
 * Loads chapter explanations from a folder of <chapter id>.<en|ta>.json files
 * (the explanation shape in src/lib/explanation.ts).
 *
 *   npm run explanations:import -- "C:\…\explanations" --dry-run   (check every file, save nothing)
 *   npm run explanations:import -- "C:\…\explanations"             (save as drafts for teachers to review)
 *   npm run explanations:import -- "C:\…\explanations" --publish   (students see them straight away)
 *   add --force to replace explanations already in the app (e.g. ones a teacher edited)
 *
 * Needs DATABASE_URL for the live site.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { findChapter } from "../src/server/content";
import { createDatabase } from "../src/server/db/connect";
import { getExplanation, parseExplanation, saveExplanation } from "../src/server/explanations";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { "dry-run": { type: "boolean" }, publish: { type: "boolean" }, force: { type: "boolean" } },
});

async function main() {
  const dir = positionals[0];
  if (!dir) {
    console.error('Usage: npm run explanations:import -- "<folder>" [--dry-run] [--publish] [--force]');
    process.exit(1);
  }
  const files = readdirSync(dir).filter((f) => /\.(en|ta)\.json$/.test(f)).sort();
  const db = values["dry-run"] ? null : await createDatabase({ url: process.env.DATABASE_URL, dataDir: ".data/pglite" });
  const problems: string[] = [];
  let saved = 0;
  let kept = 0;

  for (const f of files) {
    const [, chapterId, medium] = /^(.+)\.(en|ta)\.json$/.exec(f)!;
    if (!findChapter(chapterId!)) {
      problems.push(`${f}: no such chapter in the app`);
      continue;
    }
    const raw = readFileSync(path.join(dir, f), "utf8");
    const parsed = parseExplanation(raw);
    if (!parsed.ok) {
      problems.push(`${f}: ${parsed.error}`);
      continue;
    }
    if (!db) {
      saved++;
      continue;
    }
    if (!values.force && (await getExplanation(db, chapterId!, medium as "en" | "ta"))) {
      kept++;
      continue;
    }
    await saveExplanation(db, { chapterId: chapterId!, medium: medium as "en" | "ta", raw, publish: Boolean(values.publish), userId: null });
    saved++;
  }

  const verb = values["dry-run"] ? "Valid" : values.publish ? "Published" : "Saved as drafts";
  console.log(`${files.length} files. ${verb}: ${saved}.${kept ? ` Already in the app, kept: ${kept} (--force to replace).` : ""}`);
  if (problems.length) {
    console.log(`\n${problems.length} files not used:`);
    for (const p of problems.slice(0, 60)) console.log(`  ${p}`);
    if (problems.length > 60) console.log(`  … and ${problems.length - 60} more`);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
