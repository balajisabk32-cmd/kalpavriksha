/**
 * Exercises & solutions: book-back questions, Exercise 1.1, 1.2 …, imported from
 * the content folder (see scripts/import-practice.ts). Questions live in file
 * storage as JSON; the database keeps the index and each student's progress.
 */
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { subjectLanguage } from "@/lib/subject-language";
import type { PracticeKind, PracticeSection } from "@/lib/practice-parse";
import { practiceOrder } from "@/lib/practice-parse";
import type { Database } from "./db/connect";
import { practiceChapters, practiceProgress, practiceSets, type Medium, type PracticeState } from "./db/schema";
import { findSubject, subjectsFor } from "./content";
import { InputError } from "./people";

/** Folder names in the content → app subject ids. */
const SUBJECTS: Record<string, string> = {
  maths: "math",
  science: "science",
  "social-science": "social",
  english: "english",
  tamil: "tamil",
  accountancy: "accountancy",
  "bio-botany": "biology",
  "bio-zoology": "biology",
  botany: "botany",
  zoology: "zoology",
  "business-maths": "business-math",
  chemistry: "chemistry",
  physics: "physics",
  commerce: "commerce",
  economics: "economics",
  "computer-applications": "comp-app",
  "computer-science": "comp-sci",
};
const BOOKS: Record<string, string> = { "bio-botany": "Bio-Botany", "bio-zoology": "Bio-Zoology" };

export type ManifestItem = {
  class_num: number;
  subject: string | null;
  chapter: string | null;
  chapter_folder: string | null;
  file_name: string;
  relative_path: string;
  medium: string | null;
  term: string | null;
  status: string;
};

export type PlacedItem = {
  key: string;
  standard: number;
  subjectId: string;
  medium: Medium | null;
  book: string | null;
  term: number | null;
  number: number;
  title: string;
  /** Tamil / English: the lesson within the unit (its title, and 1.x number when given). */
  lesson?: { title: string; sub: number | null };
};

/** Where a content file belongs, or why it can't be placed. */
export function placeItem(it: ManifestItem, firstHeading = ""): PlacedItem | { skip: string } {
  const folder = it.subject ?? "";
  const base = SUBJECTS[folder];
  if (!base) return { skip: `unknown subject "${folder}"` };
  const subjectId = `c${it.class_num}-${base}`;
  if (!findSubject(subjectId)) return { skip: `no ${subjectId} in the app` };
  const lang = subjectLanguage(subjectId);
  const medium: Medium | null = lang ? null : it.medium === "tamil-medium" ? "ta" : it.medium === "english-medium" ? "en" : null;
  if (!lang && !medium) return { skip: "no medium" };
  // Chapter: from the folder ("chapter-01-…") or, for one-file chapters, the file name.
  const chapterSlug = it.chapter_folder ?? it.file_name.replace(/\.md$/i, "");
  const num = Number(/chapter-(\d+)/.exec(chapterSlug)?.[1] ?? /Chapter\s*(\d+)/i.exec(it.chapter ?? "")?.[1] ?? 0);
  if (!num) return { skip: "no chapter number" };
  const term = it.term ? Number(/(\d)/.exec(it.term)?.[1]) || null : null;
  const title = (it.chapter ?? chapterSlug)
    .replace(/^Chapter\s*\d+\s*[:.-]?\s*/i, "")
    .replace(/^\d+(\.\d+)?\s+/, (m) => (lang === "ta" ? m : ""))
    .trim();
  const part = /\b(History|Geography|Civics|Economics)\b/i.exec(firstHeading)?.[1];
  const book = BOOKS[folder] ?? (part ? part[0]!.toUpperCase() + part.slice(1).toLowerCase() : null);
  if (lang) {
    // Tamil and English: each unit (இயல்) has several lessons (1.1 poem, 1.2 prose …), each its own file.
    const sub = /^Chapter\s*\d+\s*:\s*(\d+)\s+/i.exec(it.chapter ?? "")?.[1] ?? /chapter-\d+-(\d+)-/.exec(chapterSlug)?.[1];
    const lesson = (it.chapter ?? chapterSlug).replace(/^Chapter\s*\d+\s*:\s*(\d+\s+)?/i, "").trim();
    return {
      key: [subjectId, "-", term ?? 0, "-", `unit-${num}`].join("|"),
      standard: it.class_num,
      subjectId,
      medium: null,
      book: null,
      term,
      number: num,
      title: lang === "ta" ? `இயல் ${num}` : `Unit ${num}`,
      lesson: { title: sub ? `${num}.${sub} ${lesson}` : lesson, sub: sub ? Number(sub) : null },
    };
  }
  return {
    key: [subjectId, medium ?? "-", term ?? 0, book ?? "-", chapterSlug.replace(/\.md$/, "")].join("|"),
    standard: it.class_num,
    subjectId,
    medium,
    book,
    term,
    number: num,
    title: title || chapterSlug,
  };
}

const words = (s: string) =>
  new Set(
    s
      .toLowerCase()
      .replace(/\([^)]*\)/g, " ")
      .replace(/term\s*\d|ch(apter)?\s*\d+|unit\s*\d+|history|geography|civics|economics/g, " ")
      .split(/[^\p{L}\p{M}\d]+/u)
      .filter((w) => w.length > 2 && !["and", "the", "for", "with", "our", "its"].includes(w)),
  );

/**
 * The app chapter a book chapter most likely belongs to: by title words, then by
 * term and chapter number ("Term 2 - Ch 1"). Null when nothing is close enough.
 */
export function matchAppChapter(p: PlacedItem): string | null {
  const std = p.standard;
  const subject = subjectsFor(std).find((s) => s.id === p.subjectId);
  if (!subject) return null;
  const mine = words(p.title);
  let best: { id: string; score: number } | null = null;
  for (const ch of subject.chapters) {
    const theirs = new Set([...words(ch.title.en), ...words(ch.title.ta)]);
    let shared = 0;
    for (const w of mine) if (theirs.has(w)) shared++;
    let score = mine.size ? shared / mine.size : 0;
    // "Term 1 - Ch 2", "Unit 3", "இயல் 4", "Term 1 - History 2": the same term, book and number is a strong sign.
    const tag = /(?:Term\s*(\d)\s*-\s*)?(Ch|Unit|இயல்|பருவம்\s*\d\s*:?\s*இயல்|History|Geography|Civics|Economics)\s*(\d+)/i.exec(ch.title.en) ?? /(?:Term\s*(\d)\s*-\s*)?(இயல்)\s*(\d+)/.exec(ch.title.ta);
    if (tag) {
      const termOk = (tag[1] ? Number(tag[1]) : null) === p.term || (!tag[1] && !p.term);
      const bookWord = /history|geography|civics|economics/i.test(tag[2]!) ? tag[2]!.toLowerCase() : null;
      const bookOk = bookWord ? bookWord === p.book?.toLowerCase() : !p.book || p.book.startsWith("Bio");
      if (termOk && bookOk && Number(tag[3]) === p.number) score += 0.6;
    } else if (!p.term && !p.book && ch.chapterNumber === p.number) score += 0.3;
    if (!best || score > best.score) best = { id: ch.id, score };
  }
  return best && best.score >= 0.5 ? best.id : null;
}

export type SetInput = {
  placed: PlacedItem;
  appChapterId: string | null;
  kind: PracticeKind;
  number: string;
  title: string;
  itemCount: number;
  mcqCount: number;
  storageKey: string;
  contentHash: string;
  sourcePath: string;
  publish?: boolean;
};

/** Saves (or updates) a chapter and one of its sets. A link set by hand is kept. */
export async function savePracticeSet(db: Database, s: SetInput) {
  const p = s.placed;
  const [chapter] = await db
    .insert(practiceChapters)
    .values({
      key: p.key,
      standard: p.standard,
      subjectId: p.subjectId,
      medium: p.medium,
      book: p.book,
      term: p.term,
      number: p.number,
      title: p.title,
      appChapterId: s.appChapterId,
      status: s.publish ? "published" : "draft",
      position: (p.term ?? 0) * 1000 + p.number,
    })
    .onConflictDoUpdate({
      target: practiceChapters.key,
      set: {
        title: p.title,
        book: p.book,
        appChapterId: sql`case when ${practiceChapters.appChapterManual} then ${practiceChapters.appChapterId} else ${s.appChapterId} end`,
        ...(s.publish ? { status: "published" as const } : {}),
      },
    })
    .returning({ id: practiceChapters.id });
  const values = {
    chapterId: chapter!.id,
    kind: s.kind,
    number: s.number,
    title: s.title,
    position: practiceOrder(s.kind, s.number),
    itemCount: s.itemCount,
    mcqCount: s.mcqCount,
    storageKey: s.storageKey,
    contentHash: s.contentHash,
    updatedAt: new Date(),
  };
  await db.insert(practiceSets).values({ ...values, sourcePath: s.sourcePath }).onConflictDoUpdate({ target: practiceSets.sourcePath, set: values });
  return chapter!.id;
}

export async function knownHashes(db: Database): Promise<Map<string, string>> {
  const rows = await db.select({ p: practiceSets.sourcePath, h: practiceSets.contentHash }).from(practiceSets);
  return new Map(rows.map((r) => [r.p, r.h]));
}

// --- Reading ---------------------------------------------------------------

export type PracticeSetSummary = { id: number; kind: PracticeKind; number: string; title: string; itemCount: number; mcqCount: number; done: number; help: number };
export type PracticeChapterSummary = {
  id: number;
  book: string | null;
  term: number | null;
  number: number;
  title: string;
  appChapterId: string | null;
  status: "draft" | "published";
  sets: PracticeSetSummary[];
};

/**
 * A subject's chapters and their sets in textbook order, with the student's
 * progress. Students see published chapters in their medium only.
 */
export async function practiceForSubject(
  db: Database,
  opts: { subjectId: string; medium: Medium; userId: string; drafts: boolean; appChapterId?: string },
): Promise<PracticeChapterSummary[]> {
  const lang = subjectLanguage(opts.subjectId);
  const chapters = await db
    .select()
    .from(practiceChapters)
    .where(
      and(
        eq(practiceChapters.subjectId, opts.subjectId),
        lang ? sql`${practiceChapters.medium} is null` : eq(practiceChapters.medium, opts.medium),
        opts.drafts ? undefined : eq(practiceChapters.status, "published"),
        opts.appChapterId ? eq(practiceChapters.appChapterId, opts.appChapterId) : undefined,
      ),
    )
    .orderBy(asc(practiceChapters.book), asc(practiceChapters.position), asc(practiceChapters.id));
  if (!chapters.length) return [];
  const sets = await db
    .select()
    .from(practiceSets)
    .where(inArray(practiceSets.chapterId, chapters.map((c) => c.id)))
    .orderBy(asc(practiceSets.position), asc(practiceSets.id));
  const progress = sets.length
    ? await db
        .select({ setId: practiceProgress.setId, state: practiceProgress.state, n: sql<number>`count(*)::int` })
        .from(practiceProgress)
        .where(and(eq(practiceProgress.userId, opts.userId), inArray(practiceProgress.setId, sets.map((s) => s.id))))
        .groupBy(practiceProgress.setId, practiceProgress.state)
    : [];
  const count = (setId: number, states: PracticeState[]) => progress.filter((p) => p.setId === setId && states.includes(p.state)).reduce((n, p) => n + p.n, 0);
  return chapters.map((c) => ({
    id: c.id,
    book: c.book,
    term: c.term,
    number: c.number,
    title: c.title,
    appChapterId: c.appChapterId,
    status: c.status,
    sets: sets
      .filter((s) => s.chapterId === c.id)
      .map((s) => ({
        id: s.id,
        kind: s.kind,
        number: s.number,
        title: s.title,
        itemCount: s.itemCount,
        mcqCount: s.mcqCount,
        done: count(s.id, ["done", "right"]),
        help: count(s.id, ["help", "wrong"]),
      })),
  }));
}

export async function getPracticeSet(db: Database, setId: number) {
  const [row] = await db
    .select({ set: practiceSets, chapter: practiceChapters })
    .from(practiceSets)
    .innerJoin(practiceChapters, eq(practiceChapters.id, practiceSets.chapterId))
    .where(eq(practiceSets.id, setId))
    .limit(1);
  return row ?? null;
}

/** The sets just before and after one, in the same chapter, for Previous / Next. */
export async function neighbours(db: Database, chapterId: number, setId: number) {
  const rows = await db
    .select({ id: practiceSets.id, title: practiceSets.title })
    .from(practiceSets)
    .where(eq(practiceSets.chapterId, chapterId))
    .orderBy(asc(practiceSets.position), asc(practiceSets.id));
  const i = rows.findIndex((r) => r.id === setId);
  return { prev: rows[i - 1] ?? null, next: rows[i + 1] ?? null };
}

export async function setProgress(db: Database, userId: string, setId: number) {
  const rows = await db
    .select({ item: practiceProgress.item, state: practiceProgress.state })
    .from(practiceProgress)
    .where(and(eq(practiceProgress.userId, userId), eq(practiceProgress.setId, setId)));
  return Object.fromEntries(rows.map((r) => [r.item, r.state])) as Record<number, PracticeState>;
}

/** Records how a student did on one question (or clears it with null). */
export async function recordPractice(db: Database, userId: string, setId: number, item: number, state: PracticeState | null) {
  const [set] = await db.select({ n: practiceSets.itemCount }).from(practiceSets).where(eq(practiceSets.id, setId)).limit(1);
  if (!set || !Number.isInteger(item) || item < 0 || item >= set.n) throw new InputError("not_found");
  const where = and(eq(practiceProgress.userId, userId), eq(practiceProgress.setId, setId), eq(practiceProgress.item, item));
  if (state === null) {
    await db.delete(practiceProgress).where(where);
    return;
  }
  await db
    .insert(practiceProgress)
    .values({ userId, setId, item, state })
    .onConflictDoUpdate({ target: [practiceProgress.userId, practiceProgress.setId, practiceProgress.item], set: { state, updatedAt: new Date() } });
}

// --- Admin ------------------------------------------------------------------

/** Per class and subject: chapters, sets, questions, linked and published counts. */
export async function practiceCoverage(db: Database) {
  return db
    .select({
      standard: practiceChapters.standard,
      subjectId: practiceChapters.subjectId,
      medium: practiceChapters.medium,
      chapters: sql<number>`count(distinct ${practiceChapters.id})::int`,
      linked: sql<number>`count(distinct ${practiceChapters.id}) filter (where ${practiceChapters.appChapterId} is not null)::int`,
      published: sql<number>`count(distinct ${practiceChapters.id}) filter (where ${practiceChapters.status} = 'published')::int`,
      sets: sql<number>`count(${practiceSets.id})::int`,
      items: sql<number>`coalesce(sum(${practiceSets.itemCount}), 0)::int`,
    })
    .from(practiceChapters)
    .leftJoin(practiceSets, eq(practiceSets.chapterId, practiceChapters.id))
    .groupBy(practiceChapters.standard, practiceChapters.subjectId, practiceChapters.medium)
    .orderBy(asc(practiceChapters.standard), asc(practiceChapters.subjectId), asc(practiceChapters.medium));
}

export async function setSubjectPublished(db: Database, subjectId: string, medium: Medium | null, published: boolean) {
  await db
    .update(practiceChapters)
    .set({ status: published ? "published" : "draft" })
    .where(and(eq(practiceChapters.subjectId, subjectId), medium ? eq(practiceChapters.medium, medium) : sql`${practiceChapters.medium} is null`));
}

/** Links a book chapter to an app chapter by hand (or unlinks it). */
export async function linkPracticeChapter(db: Database, id: number, appChapterId: string | null) {
  const [row] = await db.select({ subjectId: practiceChapters.subjectId }).from(practiceChapters).where(eq(practiceChapters.id, id)).limit(1);
  if (!row) throw new InputError("not_found");
  if (appChapterId && !findSubject(row.subjectId)?.chapters.some((c) => c.id === appChapterId)) throw new InputError("not_found");
  await db.update(practiceChapters).set({ appChapterId, appChapterManual: true }).where(eq(practiceChapters.id, id));
}

export async function practiceChaptersForAdmin(db: Database, subjectId: string) {
  return db
    .select({
      id: practiceChapters.id,
      medium: practiceChapters.medium,
      book: practiceChapters.book,
      term: practiceChapters.term,
      number: practiceChapters.number,
      title: practiceChapters.title,
      appChapterId: practiceChapters.appChapterId,
      manual: practiceChapters.appChapterManual,
      status: practiceChapters.status,
      sets: sql<number>`(select count(*)::int from ${practiceSets} where ${practiceSets.chapterId} = ${practiceChapters.id})`,
      items: sql<number>`(select coalesce(sum(${practiceSets.itemCount}),0)::int from ${practiceSets} where ${practiceSets.chapterId} = ${practiceChapters.id})`,
    })
    .from(practiceChapters)
    .where(eq(practiceChapters.subjectId, subjectId))
    .orderBy(asc(practiceChapters.medium), asc(practiceChapters.book), asc(practiceChapters.position));
}

export type StoredSet = { title: string; sections: PracticeSection[] };

// --- Question bodies (JSON in file storage) ----------------------------------

const bodies = new Map<string, StoredSet>();

/** Reads a set's questions, keeping the most recent 300 in memory. */
export async function loadSetBody(storageKey: string): Promise<StoredSet | null> {
  const cached = bodies.get(storageKey);
  if (cached) return cached;
  const { fileStore } = await import("./storage");
  const file = await (await fileStore()).get(storageKey);
  if (!file) return null;
  const body = JSON.parse(await new Response(file.body).text()) as StoredSet;
  bodies.set(storageKey, body);
  if (bodies.size > 300) bodies.delete(bodies.keys().next().value!);
  return body;
}

/** Every subject of a class that has exercises, with totals and the student's progress. */
export async function practiceSubjects(db: Database, opts: { standard: number; medium: Medium; userId: string; drafts: boolean }) {
  const rows = await db
    .select({
      subjectId: practiceChapters.subjectId,
      medium: practiceChapters.medium,
      chapters: sql<number>`count(distinct ${practiceChapters.id})::int`,
      sets: sql<number>`count(${practiceSets.id})::int`,
      items: sql<number>`coalesce(sum(${practiceSets.itemCount}), 0)::int`,
      done: sql<number>`(select count(*)::int from ${practiceProgress} pp join ${practiceSets} ps on ps.id = pp.set_id join ${practiceChapters} pc on pc.id = ps.chapter_id
        where pp.user_id = ${opts.userId} and pp.state in ('done','right') and pc.subject_id = ${practiceChapters.subjectId}
        and (pc.medium is not distinct from ${practiceChapters.medium}))`,
    })
    .from(practiceChapters)
    .innerJoin(practiceSets, eq(practiceSets.chapterId, practiceChapters.id))
    .where(
      and(
        eq(practiceChapters.standard, opts.standard),
        sql`(${practiceChapters.medium} is null or ${practiceChapters.medium} = ${opts.medium})`,
        opts.drafts ? undefined : eq(practiceChapters.status, "published"),
      ),
    )
    .groupBy(practiceChapters.subjectId, practiceChapters.medium);
  const order = subjectsFor(opts.standard).map((s) => s.id);
  return rows
    .map((r) => ({ ...r, name: findSubject(r.subjectId)?.name ?? { en: r.subjectId, ta: r.subjectId } }))
    .sort((a, b) => order.indexOf(a.subjectId) - order.indexOf(b.subjectId));
}

/** Removes chapters left with no sets (after content moved to another chapter on re-import). */
export async function pruneEmptyChapters(db: Database) {
  const gone = await db
    .delete(practiceChapters)
    .where(sql`not exists (select 1 from ${practiceSets} where ${practiceSets.chapterId} = ${practiceChapters.id})`)
    .returning({ id: practiceChapters.id });
  return gone.length;
}
