/**
 * Imports exercises & solutions from the content folder (manifest.json + Markdown + assets/).
 *
 *   npm run practice:import -- "C:\…\content" --dry-run          (report only, nothing saved)
 *   npm run practice:import -- "C:\…\content" --only class-10     (one class)
 *   npm run practice:import -- "C:\…\content" --publish           (students see it straight away)
 *
 * Unchanged files are skipped, so it can be run again after more content is fetched.
 * Needs DATABASE_URL and the STORAGE_* variables for the live site.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { parsePracticePage, type PracticeSection } from "../src/lib/practice-parse";
import { createDatabase } from "../src/server/db/connect";
import { knownHashes, matchAppChapter, placeItem, pruneEmptyChapters, savePracticeSet, type ManifestItem, type StoredSet } from "../src/server/practice";
import { fileStore, usesCloudStorage } from "../src/server/storage";

/** Bump when the parser changes, so every page is re-imported. */
const PARSER_VERSION = "5";
const TYPES: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", svg: "image/svg+xml" };

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { "dry-run": { type: "boolean" }, only: { type: "string" }, publish: { type: "boolean" }, force: { type: "boolean" } },
});

const sha = (data: string | Uint8Array) => createHash("sha1").update(data).digest("hex");

async function pool<T>(items: T[], size: number, fn: (t: T, i: number) => Promise<void>) {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        await fn(items[i]!, i);
      }
    }),
  );
}

async function main() {
  const root = positionals[0];
  if (!root || !existsSync(path.join(root, "manifest.json"))) {
    console.error('Usage: npm run practice:import -- "<content folder with manifest.json>" [--dry-run] [--only class-10] [--publish]');
    process.exit(1);
  }
  const dry = Boolean(values["dry-run"]);
  if (!dry && process.env.DATABASE_URL && !usesCloudStorage()) {
    console.error("DATABASE_URL is the live database but the STORAGE_* variables are not all set: the files would stay on this PC. Set STORAGE_ENDPOINT, STORAGE_BUCKET, STORAGE_KEY_ID and STORAGE_SECRET.");
    process.exit(1);
  }
  const manifest = JSON.parse(readFileSync(path.join(root, "manifest.json"), "utf8")) as { items: ManifestItem[] };
  const items = manifest.items.filter((i) => i.status === "done" && (!values.only || i.relative_path.startsWith(values.only)));
  console.log(`${items.length} pages. ${dry ? "DRY RUN — nothing is saved." : `Storage: ${usesCloudStorage() ? "Backblaze B2" : "local folder"}`}`);

  const db = dry ? null : await createDatabase({ url: process.env.DATABASE_URL, dataDir: ".data/pglite" });
  const store = dry ? null : await fileStore();
  const hashes = db ? await knownHashes(db) : new Map<string, string>();
  const uploaded = new Set<string>();

  const skipped = new Map<string, number>();
  const unmatched = new Map<string, string>();
  const perSubject = new Map<string, { sets: number; items: number }>();
  let saved = 0;
  let unchanged = 0;
  let images = 0;
  let missingImages = 0;

  // Pass 1: read, parse and place every page, and work out its app chapter.
  type Rec = { it: ManifestItem; file: string; md: string; page: ReturnType<typeof parsePracticePage>; placed: Exclude<ReturnType<typeof placeItem>, { skip: string }>; appChapterId: string | null };
  const recs: Rec[] = [];
  const skip = (why: string) => skipped.set(why, (skipped.get(why) ?? 0) + 1);
  for (const it of items) {
    const file = path.join(root, it.relative_path);
    if (!existsSync(file)) {
      skip("file missing");
      continue;
    }
    const md = readFileSync(file, "utf8");
    const page = parsePracticePage(md, it.file_name);
    if (!page.itemCount) {
      skip(`no questions (${it.file_name})`);
      continue;
    }
    const placed = placeItem(it, /^##\s+(.+)$/m.exec(md)?.[1] ?? "");
    if ("skip" in placed) {
      skip(placed.skip);
      continue;
    }
    recs.push({ it, file, md, page, placed, appChapterId: matchAppChapter(placed) });
  }
  // Tamil-medium titles are in Tamil: use the link of the same chapter in English medium.
  const twin = (r: Rec) => [r.placed.subjectId, r.placed.term ?? 0, r.placed.book ?? "-", r.placed.number].join("|");
  const english = new Map<string, string>();
  for (const r of recs) if (r.placed.medium === "en" && r.appChapterId) english.set(twin(r), r.appChapterId);
  for (const r of recs) if (r.placed.medium === "ta" && !r.appChapterId) r.appChapterId = english.get(twin(r)) ?? null;

  // Tamil / English lessons: number them within their unit (1.1, 1.2 …) in manifest order when the page doesn't.
  const seen = new Map<string, number>();
  for (const r of recs) {
    if (!r.placed.lesson) continue;
    const k = (seen.get(r.placed.key) ?? 0) + 1;
    seen.set(r.placed.key, k);
    r.page = { ...r.page, kind: "bookback", number: `${r.placed.number}.${r.placed.lesson.sub ?? k}`, title: r.placed.lesson.title };
  }

  // Pass 2: save.
  await pool(recs, 6, async ({ it, file, md, page, placed, appChapterId }, i) => {
    if (!appChapterId) unmatched.set(placed.key, `${placed.subjectId} ${placed.medium ?? ""} ${placed.term ? `T${placed.term} ` : ""}${placed.book ? `${placed.book} ` : ""}Ch ${placed.number}: ${placed.title}`);
    const stat = perSubject.get(`${placed.subjectId} ${placed.medium ?? "—"}`) ?? { sets: 0, items: 0 };
    stat.sets++;
    stat.items += page.itemCount;
    perSubject.set(`${placed.subjectId} ${placed.medium ?? "—"}`, stat);
    if (dry || !db || !store) return;

    const contentHash = sha(`${PARSER_VERSION}|${md}`);
    if (!values.force && hashes.get(it.relative_path) === contentHash) {
      unchanged++;
      return;
    }

    // Images: upload each once (named by content), and point the text at our copy.
    const dir = path.dirname(file);
    const urls = new Map<string, string>();
    for (const ref of page.assets) {
      const local = path.join(dir, ref);
      if (!existsSync(local)) {
        missingImages++;
        continue;
      }
      const data = new Uint8Array(readFileSync(local));
      const ext = (path.extname(local).slice(1) || "png").toLowerCase();
      const name = `${sha(data).slice(0, 20)}.${ext}`;
      if (!uploaded.has(name)) {
        uploaded.add(name);
        // Images are named by their content: one already in storage never needs uploading again.
        if ((await store.size(`practice/assets/${name}`)) === null) {
          await store.put(`practice/assets/${name}`, data, TYPES[ext] ?? "application/octet-stream");
          images++;
        }
      }
      urls.set(ref, `/api/practice/asset/${name}`);
    }
    const fix = (s: string) => s.replace(/!\[\]\(([^)\s]+)\)/g, (m, ref: string) => (urls.has(ref) ? `![](${urls.get(ref)})` : ""));
    const sections: PracticeSection[] = page.sections.map((s) => ({
      ...s,
      note: s.note ? fix(s.note) : undefined,
      items: s.items.map((q) => ({ ...q, q: fix(q.q), a: fix(q.a), mcq: q.mcq ? { ...q.mcq, options: q.mcq.options.map((o) => ({ ...o, text: fix(o.text) })) } : undefined })),
    }));
    const stored: StoredSet = { title: page.title, sections };
    const storageKey = `practice/sets/${sha(it.relative_path).slice(0, 24)}.json`;
    await store.put(storageKey, new TextEncoder().encode(JSON.stringify(stored)), "application/json");
    await savePracticeSet(db, {
      placed,
      appChapterId,
      kind: page.kind,
      number: page.number,
      title: page.title,
      itemCount: page.itemCount,
      mcqCount: page.mcqCount,
      storageKey,
      contentHash,
      sourcePath: it.relative_path,
      publish: Boolean(values.publish),
    });
    saved++;
    if ((i + 1) % 100 === 0) console.log(`  … ${i + 1}/${items.length}`);
  });

  console.log("\nBy subject (pages, questions):");
  for (const [k, v] of [...perSubject].sort()) console.log(`  ${k.padEnd(24)} ${String(v.sets).padStart(4)} pages  ${String(v.items).padStart(6)} questions`);
  if (skipped.size) {
    console.log("\nSkipped:");
    for (const [k, v] of [...skipped].sort((a, b) => b[1] - a[1])) console.log(`  ${v} × ${k}`);
  }
  if (unmatched.size) {
    console.log(`\n${unmatched.size} book chapters not linked to an app chapter (link them in Admin → Exercises):`);
    for (const v of [...unmatched.values()].sort().slice(0, 60)) console.log(`  ${v}`);
    if (unmatched.size > 60) console.log(`  … and ${unmatched.size - 60} more`);
  }
  if (db) console.log(`\nRemoved ${await pruneEmptyChapters(db)} empty chapters.`);
  if (!dry) console.log(`\nSaved ${saved} pages, ${unchanged} unchanged, ${images} images uploaded, ${missingImages} images missing.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
