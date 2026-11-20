/**
 * Sets every chapter's textbook pages from a CSV:
 *   chapter_id,medium,pdf_file,start_page,end_page,confidence,note
 * (pdf_file is relative to the textbooks folder, e.g. c10-math\en\book.pdf).
 *
 *   npm run pages:import -- "C:\…\textbooks\page-ranges\pages.csv" --dry-run
 *   npm run pages:import -- "C:\…\pages.csv"                 (high and medium confidence)
 *   npm run pages:import -- "C:\…\pages.csv" --include-low   (also low confidence)
 *
 * The book is found by the title the folder upload gave it, so upload the
 * textbooks first. Needs DATABASE_URL for the live site.
 */
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { textbookTitle } from "../src/lib/textbook-title";
import { findChapter, listChapterPages, listTextbooks, setChapterPages } from "../src/server/content";
import { createDatabase } from "../src/server/db/connect";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { "dry-run": { type: "boolean" }, "include-low": { type: "boolean" } },
});

/** Minimal CSV reader (quoted fields, commas and doubled quotes inside quotes). */
function readCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const src = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!;
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((f) => f.trim())) rows.push(row);
      row = [];
    } else field += ch;
  }
  row.push(field);
  if (row.some((f) => f.trim())) rows.push(row);
  const [head, ...body] = rows;
  return body.map((r) => Object.fromEntries(head!.map((h, i) => [h.trim(), (r[i] ?? "").trim()])));
}

async function main() {
  const file = positionals[0];
  if (!file) {
    console.error('Usage: npm run pages:import -- "<pages.csv>" [--dry-run] [--include-low]');
    process.exit(1);
  }
  const rows = readCsv(readFileSync(file, "utf8"));
  const db = await createDatabase({ url: process.env.DATABASE_URL, dataDir: ".data/pglite" });
  const books = new Map<string, Awaited<ReturnType<typeof listTextbooks>>>();
  const problems: string[] = [];
  let saved = 0;
  let skippedLow = 0;

  for (const r of rows) {
    const where = `${r.chapter_id} ${r.medium}`;
    if (r.confidence === "low" && !values["include-low"]) {
      skippedLow++;
      continue;
    }
    const found = findChapter(r.chapter_id ?? "");
    const medium = r.medium === "ta" ? "ta" : r.medium === "en" ? "en" : null;
    const start = Number(r.start_page);
    const end = Number(r.end_page);
    if (!found || !medium) {
      problems.push(`${where}: unknown chapter or medium`);
      continue;
    }
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start) {
      problems.push(`${where}: bad pages ${r.start_page}–${r.end_page}`);
      continue;
    }
    const subjectId = found.subject.id;
    if (!books.has(subjectId)) books.set(subjectId, await listTextbooks(db, subjectId));
    const leaf = (r.pdf_file ?? "").split(/[\\/]/).pop() ?? "";
    const want = textbookTitle(subjectId, medium, leaf).title.toLowerCase();
    const book = books.get(subjectId)!.find((b) => b.medium === medium && b.title.toLowerCase() === want);
    if (!book) {
      problems.push(`${where}: no uploaded book "${textbookTitle(subjectId, medium, leaf).title}"`);
      continue;
    }
    if (book.pages && end > book.pages) {
      problems.push(`${where}: pages ${start}–${end} but the book has ${book.pages}`);
      continue;
    }
    if (values["dry-run"]) {
      saved++;
      continue;
    }
    // One book per chapter and medium: clear any other book of the same medium set before.
    const current = (await listChapterPages(db, subjectId)).filter((p) => p.chapterId === r.chapter_id && p.textbookId !== book.id);
    for (const p of current) {
      const other = books.get(subjectId)!.find((b) => b.id === p.textbookId);
      if (other?.medium === medium) await setChapterPages(db, r.chapter_id!, p.textbookId, null, null);
    }
    await setChapterPages(db, r.chapter_id!, book.id, start, end);
    saved++;
  }

  console.log(`${values["dry-run"] ? "Would set" : "Set"} pages for ${saved} chapter/medium rows. ${skippedLow ? `${skippedLow} low-confidence rows skipped (--include-low to add them).` : ""}`);
  if (problems.length) {
    console.log(`\n${problems.length} rows not set:`);
    for (const p of problems.slice(0, 80)) console.log(`  ${p}`);
    if (problems.length > 80) console.log(`  … and ${problems.length - 80} more`);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
