/**
 * Uploads textbook PDFs from this computer (any size) and records them.
 *
 *   npm run textbook:upload -- --subject c4-science --medium ta --term 1 "Science T1 TM.pdf"
 *   npm run textbook:upload -- --subject c12-math --medium en "Maths Vol1.pdf" "Maths Vol2.pdf"
 *
 * --subject  the app subject id (shown in the address bar on Admin → Videos & textbooks → subject)
 * --medium   en or ta          --term  1, 2 or 3 (leave out for a whole-year book)
 * --title    optional; defaults to the file name
 *
 * Needs DATABASE_URL and the STORAGE_* variables (Backblaze B2) for the live site;
 * without them it uses the local database and the local folder.
 */
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { addTextbook, findSubject } from "../src/server/content";
import { createDatabase } from "../src/server/db/connect";
import { isPdf, pdfPageCount } from "../src/server/pdf";
import { fileStore, usesCloudStorage } from "../src/server/storage";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { subject: { type: "string" }, medium: { type: "string" }, term: { type: "string" }, title: { type: "string" } },
});

async function main() {
  const subjectId = values.subject ?? "";
  const medium = values.medium === "ta" ? "ta" : values.medium === "en" ? "en" : null;
  if (!positionals.length || !findSubject(subjectId) || !medium) {
    console.error('Usage: npm run textbook:upload -- --subject c4-science --medium en|ta [--term 1] [--title "…"] <file.pdf> [...]');
    if (subjectId && !findSubject(subjectId)) console.error(`Unknown subject: ${subjectId}`);
    process.exit(1);
  }
  const term = values.term ? Number(values.term) : null;
  console.log(`Storage: ${usesCloudStorage() ? "Backblaze B2 (cloud)" : "local folder .data/files"}`);
  const db = await createDatabase({ url: process.env.DATABASE_URL, dataDir: ".data/pglite" });
  const store = await fileStore();
  for (const file of positionals) {
    const data = new Uint8Array(readFileSync(file));
    if (!isPdf(data)) {
      console.error(`Skipped (not a PDF): ${file}`);
      continue;
    }
    const key = `textbooks/${subjectId}/${medium}/${randomUUID()}.pdf`;
    process.stdout.write(`Uploading ${path.basename(file)} (${(data.byteLength / 1048576).toFixed(1)} MB)… `);
    await store.put(key, data, "application/pdf");
    const title = positionals.length === 1 && values.title ? values.title : path.basename(file).replace(/\.pdf$/i, "");
    const book = await addTextbook(
      db,
      { subjectId, medium, term: term && term >= 1 && term <= 3 ? term : null, title, storageKey: key, sizeBytes: data.byteLength, pages: pdfPageCount(data) },
      null,
    );
    console.log(`done. Textbook #${book.id}, ${book.pages ?? "?"} pages.`);
  }
  console.log("Set each chapter's pages in Admin → Videos & textbooks → the subject.");
  process.exit(0);
}
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
