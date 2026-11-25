/**
 * Uploads a whole folder of textbooks laid out as
 *
 *   <folder>/<subject id>/<en|ta>/term-1.pdf | volume-1.pdf | book.pdf
 *   e.g. textbooks/c4-science/ta/term-1.pdf, textbooks/c12-physics/en/volume-2.pdf
 *
 *   npm run textbook:upload-folder -- "C:\path\to\textbooks"
 *   npm run textbook:upload-folder -- "C:\path\to\textbooks" --only c4      (just Class 4)
 *   npm run textbook:upload-folder -- "C:\path\to\textbooks" --dry-run     (list, upload nothing)
 *
 * Books already uploaded (same subject, medium and title) are skipped, so the
 * command can simply be run again if the connection drops.
 * Needs DATABASE_URL and the STORAGE_* variables for the live site.
 */
import { randomUUID } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { textbookTitle } from "../src/lib/textbook-title";
import { addTextbook, findSubject, listTextbooks } from "../src/server/content";
import { createDatabase } from "../src/server/db/connect";
import { isPdf, pdfPageCount } from "../src/server/pdf";
import { fileStore, usesCloudStorage } from "../src/server/storage";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { only: { type: "string" }, "dry-run": { type: "boolean" } },
});


type Job = { file: string; subjectId: string; medium: "en" | "ta"; term: number | null; title: string };

function plan(root: string): Job[] {
  const jobs: Job[] = [];
  for (const subjectId of readdirSync(root).sort()) {
    if (!statSync(path.join(root, subjectId)).isDirectory()) continue;
    if (values.only && !subjectId.startsWith(`${values.only}-`) && subjectId !== values.only) continue;
    if (!findSubject(subjectId)) {
      console.warn(`! Skipped folder ${subjectId}: not a subject in the app`);
      continue;
    }
    for (const medium of ["en", "ta"] as const) {
      const dir = path.join(root, subjectId, medium);
      if (!existsSync(dir)) continue;
      for (const leaf of readdirSync(dir).filter((f) => f.toLowerCase().endsWith(".pdf")).sort()) {
        const { title, term } = textbookTitle(subjectId, medium, leaf);
        jobs.push({ file: path.join(dir, leaf), subjectId, medium, term, title });
      }
    }
  }
  return jobs;
}

async function main() {
  const root = positionals[0];
  if (!root || !existsSync(root)) {
    console.error('Usage: npm run textbook:upload-folder -- "<textbooks folder>" [--only c4] [--dry-run]');
    process.exit(1);
  }
  const jobs = plan(root);
  console.log(`${jobs.length} books found. Storage: ${usesCloudStorage() ? "Backblaze B2 (cloud)" : "local folder .data/files"}`);
  if (values["dry-run"]) {
    for (const j of jobs) console.log(`  ${j.subjectId}/${j.medium}  ${j.title}`);
    process.exit(0);
  }
  if (process.env.DATABASE_URL && !usesCloudStorage()) {
    console.error("DATABASE_URL is the live database but the STORAGE_* variables are not all set: the books would stay on this PC.");
    process.exit(1);
  }
  const db = await createDatabase({ url: process.env.DATABASE_URL, dataDir: ".data/pglite" });
  const store = await fileStore();
  const known = new Map<string, Set<string>>();
  let uploaded = 0;
  let skipped = 0;
  for (const [i, job] of jobs.entries()) {
    if (!known.has(job.subjectId)) {
      known.set(job.subjectId, new Set((await listTextbooks(db, job.subjectId)).map((b) => `${b.medium}|${b.title}`)));
    }
    const prefix = `[${i + 1}/${jobs.length}] ${job.title}`;
    if (known.get(job.subjectId)!.has(`${job.medium}|${job.title}`)) {
      console.log(`${prefix} — already uploaded, skipped`);
      skipped++;
      continue;
    }
    const data = new Uint8Array(readFileSync(job.file));
    if (!isPdf(data)) {
      console.warn(`${prefix} — not a PDF, skipped`);
      continue;
    }
    process.stdout.write(`${prefix} (${(data.byteLength / 1048576).toFixed(1)} MB)… `);
    const key = `textbooks/${job.subjectId}/${job.medium}/${randomUUID()}.pdf`;
    await store.put(key, data, "application/pdf");
    const book = await addTextbook(
      db,
      { subjectId: job.subjectId, medium: job.medium, term: job.term, title: job.title, storageKey: key, sizeBytes: data.byteLength, pages: pdfPageCount(data) },
      null,
    );
    known.get(job.subjectId)!.add(`${job.medium}|${job.title}`);
    uploaded++;
    console.log(`done (#${book.id}, ${book.pages ?? "?"} pages)`);
  }
  console.log(`Finished: ${uploaded} uploaded, ${skipped} already there. Next: set each chapter's pages in Admin → Videos & textbooks.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
