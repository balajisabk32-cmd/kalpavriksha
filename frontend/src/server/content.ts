/**
 * Videos and textbooks per chapter (Phase 2). Every function takes the database
 * first so tests can use an in-memory Postgres.
 */
import { and, asc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { getSubjectsForStandard } from "@/lib/curriculum-data";
import { matchUnits, type ChapterRef } from "./content-match";
import type { Database } from "./db/connect";
import { chapterPages, contentUnits, MEDIUMS, textbooks, videos, type Medium, type UnitMatch, type VideoKind } from "./db/schema";
import { InputError } from "./people";
import type { ParsedUnit, SubjectRef } from "./video-import";
import { parseYouTubeUrl } from "./youtube";

export const CONTENT_STANDARDS = [4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

export function subjectsFor(standard: number): readonly (SubjectRef & { chapters: readonly ChapterRef[] })[] {
  if (!(CONTENT_STANDARDS as readonly number[]).includes(standard)) return [];
  return getSubjectsForStandard(standard as never).map((s) => ({
    id: s.id,
    code: s.code,
    name: { en: s.name.en, ta: s.name.ta },
    chapters: s.chapters.map((c) => ({ id: c.id, chapterNumber: c.chapterNumber, title: { en: c.title.en, ta: c.title.ta } })),
  }));
}

export function findSubject(subjectId: string) {
  const std = Number(/^c(\d+)-/.exec(subjectId)?.[1]);
  return subjectsFor(std).find((s) => s.id === subjectId) ?? null;
}

export function findChapter(chapterId: string) {
  const subjectId = chapterId.replace(/-ch\d+$/, "");
  const subject = findSubject(subjectId);
  const chapter = subject?.chapters.find((c) => c.id === chapterId);
  return subject && chapter ? { subject, chapter, standard: Number(/^c(\d+)-/.exec(chapterId)![1]) } : null;
}

export type PlannedUnit = ParsedUnit & { chapterId: string | null; match: UnitMatch | null; keptManual: boolean };

/**
 * Suggests a chapter for each parsed unit. A unit an admin already linked by hand
 * keeps that link (it is re-imported with `keptManual`).
 */
export async function planImport(db: Database, units: readonly ParsedUnit[]): Promise<PlannedUnit[]> {
  const groups = new Map<string, ParsedUnit[]>();
  for (const u of units) {
    const k = `${u.standard}|${u.subjectId}|${u.medium}`;
    groups.set(k, [...(groups.get(k) ?? []), u]);
  }
  const manual = units.length
    ? await db
        .select({
          standard: contentUnits.standard,
          subjectId: contentUnits.subjectId,
          medium: contentUnits.medium,
          term: contentUnits.term,
          unitNo: contentUnits.unitNo,
          chapterId: contentUnits.chapterId,
        })
        .from(contentUnits)
        .where(and(eq(contentUnits.match, "manual"), inArray(contentUnits.subjectId, [...new Set(units.map((u) => u.subjectId))])))
    : [];
  const manualKey = (u: { standard: number; subjectId: string; medium: string; term: number | null; unitNo: number | null }) =>
    [u.standard, u.subjectId, u.medium, u.term ?? "", u.unitNo ?? ""].join("|");
  const manualMap = new Map(manual.map((m) => [manualKey(m), m.chapterId]));

  const planned: PlannedUnit[] = [];
  for (const group of groups.values()) {
    const chapters = findSubject(group[0]!.subjectId)?.chapters ?? [];
    const results = matchUnits(
      group.map((u) => ({ term: u.term, unitNo: u.unitNo, title: u.title, lessonTitles: u.videos.filter((v) => v.kind === "lesson").map((v) => v.title) })),
      chapters,
    );
    group.forEach((u, i) => {
      const k = manualKey(u);
      if (manualMap.has(k)) planned.push({ ...u, chapterId: manualMap.get(k) ?? null, match: "manual", keptManual: true });
      else planned.push({ ...u, ...results[i]!, keptManual: false });
    });
  }
  return planned;
}

/**
 * Saves planned units: each unit is created or updated in place, and its videos
 * are replaced by the file's. Units not in the file are left alone.
 */
export async function saveImport(db: Database, units: readonly PlannedUnit[], source: string, now = new Date()) {
  let videoCount = 0;
  await db.transaction(async (tx) => {
    for (const u of units) {
      const [row] = await tx
        .insert(contentUnits)
        .values({
          standard: u.standard,
          subjectId: u.subjectId,
          medium: u.medium,
          term: u.term,
          unitNo: u.unitNo,
          title: u.title || "—",
          chapterId: u.chapterId,
          match: u.match,
          source,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [contentUnits.standard, contentUnits.subjectId, contentUnits.medium, contentUnits.term, contentUnits.unitNo],
          set: {
            title: u.title || "—",
            source,
            updatedAt: now,
            chapterId: sql`case when ${contentUnits.match} = 'manual' then ${contentUnits.chapterId} else ${u.chapterId} end`,
            match: sql`case when ${contentUnits.match} = 'manual' then ${contentUnits.match} else ${u.match} end`,
          },
        })
        .returning({ id: contentUnits.id });
      await tx.delete(videos).where(eq(videos.unitId, row!.id));
      if (u.videos.length) {
        await tx.insert(videos).values(
          u.videos.map((v, i) => ({
            unitId: row!.id,
            kind: v.kind,
            title: v.title.slice(0, 200),
            youtubeId: v.youtubeId,
            playlistId: v.playlistId,
            position: i + 1,
            note: v.note?.slice(0, 300) ?? null,
          })),
        );
        videoCount += u.videos.length;
      }
    }
  });
  return { units: units.length, videos: videoCount };
}

export type CoverageRow = {
  standard: number;
  subjectId: string;
  name: { en: string; ta: string };
  chapters: number;
  withVideo: Record<Medium, number>;
  subjectVideos: number;
  toCheck: number;
  textbooks: number;
};

/** Per class and subject: how many chapters have a video in each medium, units to check, and textbooks. */
export async function coverage(db: Database, standard: number): Promise<CoverageRow[]> {
  const subjects = subjectsFor(standard);
  const [linked, subjectLevel, toCheck, books] = await Promise.all([
    db
      .selectDistinct({ subjectId: contentUnits.subjectId, medium: contentUnits.medium, chapterId: contentUnits.chapterId })
      .from(contentUnits)
      .innerJoin(videos, eq(videos.unitId, contentUnits.id))
      .where(and(eq(contentUnits.standard, standard), isNotNull(contentUnits.chapterId))),
    db
      .select({ subjectId: contentUnits.subjectId, n: sql<number>`count(${videos.id})::int` })
      .from(contentUnits)
      .innerJoin(videos, eq(videos.unitId, contentUnits.id))
      .where(and(eq(contentUnits.standard, standard), sql`${contentUnits.unitNo} is null`))
      .groupBy(contentUnits.subjectId),
    db
      .select({ subjectId: contentUnits.subjectId, n: sql<number>`count(*)::int` })
      .from(contentUnits)
      .where(and(eq(contentUnits.standard, standard), sql`(${contentUnits.match} = 'order' or (${contentUnits.match} is null))`))
      .groupBy(contentUnits.subjectId),
    db
      .select({ subjectId: textbooks.subjectId, n: sql<number>`count(*)::int` })
      .from(textbooks)
      .where(eq(textbooks.standard, standard))
      .groupBy(textbooks.subjectId),
  ]);
  return subjects.map((s) => {
    const mine = linked.filter((l) => l.subjectId === s.id);
    return {
      standard,
      subjectId: s.id,
      name: s.name,
      chapters: s.chapters.length,
      withVideo: {
        en: new Set(mine.filter((l) => l.medium === "en").map((l) => l.chapterId)).size,
        ta: new Set(mine.filter((l) => l.medium === "ta").map((l) => l.chapterId)).size,
      },
      subjectVideos: subjectLevel.find((x) => x.subjectId === s.id)?.n ?? 0,
      toCheck: toCheck.find((x) => x.subjectId === s.id)?.n ?? 0,
      textbooks: books.find((x) => x.subjectId === s.id)?.n ?? 0,
    };
  });
}

export type UnitWithVideos = {
  id: number;
  medium: Medium;
  term: number | null;
  unitNo: number | null;
  title: string;
  chapterId: string | null;
  match: UnitMatch | null;
  source: string | null;
  videos: { id: number; kind: VideoKind; title: string; youtubeId: string | null; playlistId: string | null; note: string | null }[];
};

export async function subjectUnits(db: Database, subjectId: string): Promise<UnitWithVideos[]> {
  const units = await db
    .select()
    .from(contentUnits)
    .where(eq(contentUnits.subjectId, subjectId))
    .orderBy(asc(contentUnits.medium), sql`${contentUnits.term} nulls first`, sql`${contentUnits.unitNo} nulls first`);
  const vids = units.length
    ? await db
        .select()
        .from(videos)
        .where(
          inArray(
            videos.unitId,
            units.map((u) => u.id),
          ),
        )
        .orderBy(asc(videos.position))
    : [];
  return units.map((u) => ({
    id: u.id,
    medium: u.medium,
    term: u.term,
    unitNo: u.unitNo,
    title: u.title,
    chapterId: u.chapterId,
    match: u.match,
    source: u.source,
    videos: vids
      .filter((v) => v.unitId === u.id)
      .map((v) => ({ id: v.id, kind: v.kind, title: v.title, youtubeId: v.youtubeId, playlistId: v.playlistId, note: v.note })),
  }));
}

/** Links a unit to a chapter by hand (or unlinks it with null). Re-imports keep this. */
export async function setUnitChapter(db: Database, unitId: number, chapterId: string | null) {
  const [unit] = await db.select().from(contentUnits).where(eq(contentUnits.id, unitId)).limit(1);
  if (!unit) throw new InputError("not_found");
  if (chapterId && findChapter(chapterId)?.subject.id !== unit.subjectId) throw new InputError("not_found");
  await db
    .update(contentUnits)
    .set({ chapterId, match: "manual", updatedAt: new Date() })
    .where(eq(contentUnits.id, unitId));
}

/** Adds one video to a chapter by hand. It goes in a unit of its own ("Added here"), linked to the chapter. */
export async function addChapterVideo(
  db: Database,
  input: { chapterId: string; medium: Medium; url: string; kind: VideoKind; title?: string | null },
) {
  const found = findChapter(input.chapterId);
  if (!found) throw new InputError("not_found");
  if (!MEDIUMS.includes(input.medium)) throw new InputError("medium");
  const ref = parseYouTubeUrl(input.url);
  if (!ref) throw new InputError("video_link");
  const unitNo = 900 + found.chapter.chapterNumber;
  return db.transaction(async (tx) => {
    const [unit] = await tx
      .insert(contentUnits)
      .values({
        standard: found.standard,
        subjectId: found.subject.id,
        medium: input.medium,
        term: null,
        unitNo,
        title: found.chapter.title.en,
        chapterId: input.chapterId,
        match: "manual",
        source: "admin",
      })
      .onConflictDoUpdate({
        target: [contentUnits.standard, contentUnits.subjectId, contentUnits.medium, contentUnits.term, contentUnits.unitNo],
        set: { updatedAt: new Date() },
      })
      .returning({ id: contentUnits.id });
    const [{ n }] = (await tx
      .select({ n: sql<number>`coalesce(max(${videos.position}), 0)::int` })
      .from(videos)
      .where(eq(videos.unitId, unit!.id))) as [{ n: number }];
    const [video] = await tx
      .insert(videos)
      .values({
        unitId: unit!.id,
        kind: input.kind,
        title: (input.title?.trim() || found.chapter.title.en).slice(0, 200),
        youtubeId: ref.kind === "video" ? ref.id : null,
        playlistId: ref.kind === "playlist" ? ref.id : null,
        position: n + 1,
      })
      .returning({ id: videos.id });
    return video!.id;
  });
}

export async function deleteVideo(db: Database, videoId: number) {
  await db.delete(videos).where(eq(videos.id, videoId));
}

// --- Textbooks --------------------------------------------------------------

export type TextbookRow = typeof textbooks.$inferSelect;

export async function addTextbook(
  db: Database,
  input: { subjectId: string; medium: Medium; term: number | null; title: string; storageKey: string; sizeBytes: number; pages: number | null },
  byUserId: string | null,
) {
  const subject = findSubject(input.subjectId);
  if (!subject) throw new InputError("not_found");
  const standard = Number(/^c(\d+)-/.exec(input.subjectId)![1]);
  const [row] = await db
    .insert(textbooks)
    .values({ ...input, standard, title: input.title.trim().slice(0, 120) || subject.name.en, uploadedBy: byUserId })
    .returning();
  return row!;
}

export async function listTextbooks(db: Database, subjectId: string): Promise<TextbookRow[]> {
  return db.select().from(textbooks).where(eq(textbooks.subjectId, subjectId)).orderBy(asc(textbooks.medium), sql`${textbooks.term} nulls first`);
}

export async function getTextbook(db: Database, id: number): Promise<TextbookRow | null> {
  const [row] = await db.select().from(textbooks).where(eq(textbooks.id, id)).limit(1);
  return row ?? null;
}

/** Removes the record and returns its storage key so the caller can delete the file. */
export async function removeTextbook(db: Database, id: number): Promise<string | null> {
  const [row] = await db.delete(textbooks).where(eq(textbooks.id, id)).returning({ key: textbooks.storageKey });
  return row?.key ?? null;
}

export async function listChapterPages(db: Database, subjectId: string) {
  return db
    .select({ chapterId: chapterPages.chapterId, textbookId: chapterPages.textbookId, startPage: chapterPages.startPage, endPage: chapterPages.endPage })
    .from(chapterPages)
    .innerJoin(textbooks, eq(textbooks.id, chapterPages.textbookId))
    .where(eq(textbooks.subjectId, subjectId));
}

/** Sets (or clears, with nulls) the pages of a textbook that a chapter covers. */
export async function setChapterPages(db: Database, chapterId: string, textbookId: number, start: number | null, end: number | null) {
  const book = await getTextbook(db, textbookId);
  const found = findChapter(chapterId);
  if (!book || !found || found.subject.id !== book.subjectId) throw new InputError("not_found");
  if (start === null && end === null) {
    await db.delete(chapterPages).where(and(eq(chapterPages.chapterId, chapterId), eq(chapterPages.textbookId, textbookId)));
    return;
  }
  const s = start ?? end!;
  const e = end ?? start!;
  if (!Number.isInteger(s) || !Number.isInteger(e) || s < 1 || e < s || (book.pages && e > book.pages)) throw new InputError("pages");
  await db
    .insert(chapterPages)
    .values({ chapterId, textbookId, startPage: s, endPage: e })
    .onConflictDoUpdate({ target: [chapterPages.chapterId, chapterPages.textbookId], set: { startPage: s, endPage: e } });
}

// --- What a lesson shows (used by the lesson screen in Phase 3) --------------

export type ChapterMedia = {
  videos: { id: number; kind: VideoKind; title: string; youtubeId: string | null; playlistId: string | null; medium: Medium; unitTitle: string }[];
  subjectVideos: { id: number; title: string; youtubeId: string | null; playlistId: string | null; medium: Medium }[];
  textbook: { id: number; title: string; medium: Medium; startPage: number; endPage: number } | null;
};

/**
 * Videos and textbook pages for a chapter, in the student's medium first. Falls
 * back to the other medium when there is nothing in theirs.
 */
export async function chapterMedia(db: Database, chapterId: string, medium: Medium): Promise<ChapterMedia> {
  const found = findChapter(chapterId);
  if (!found) return { videos: [], subjectVideos: [], textbook: null };
  const prefer = <T extends { medium: Medium }>(rows: T[]) => {
    const mine = rows.filter((r) => r.medium === medium);
    return mine.length ? mine : rows;
  };
  const rows = await db
    .select({
      id: videos.id,
      kind: videos.kind,
      title: videos.title,
      youtubeId: videos.youtubeId,
      playlistId: videos.playlistId,
      medium: contentUnits.medium,
      unitTitle: contentUnits.title,
      unitNo: contentUnits.unitNo,
      chapterId: contentUnits.chapterId,
    })
    .from(videos)
    .innerJoin(contentUnits, eq(contentUnits.id, videos.unitId))
    .where(and(eq(contentUnits.subjectId, found.subject.id), sql`(${contentUnits.chapterId} = ${chapterId} or ${contentUnits.unitNo} is null)`))
    .orderBy(sql`${contentUnits.term} nulls first`, asc(contentUnits.unitNo), asc(videos.position));
  const pages = await db
    .select({ id: textbooks.id, title: textbooks.title, medium: textbooks.medium, startPage: chapterPages.startPage, endPage: chapterPages.endPage })
    .from(chapterPages)
    .innerJoin(textbooks, eq(textbooks.id, chapterPages.textbookId))
    .where(eq(chapterPages.chapterId, chapterId));
  return {
    videos: prefer(rows.filter((r) => r.chapterId === chapterId)).map(({ unitNo: _u, chapterId: _c, ...v }) => v),
    subjectVideos: prefer(rows.filter((r) => r.unitNo === null)).map(({ id, title, youtubeId, playlistId, medium: m }) => ({ id, title, youtubeId, playlistId, medium: m })),
    textbook: prefer(pages)[0] ?? null,
  };
}
