/**
 * Links textbook units (from the content team's sheets) to the app's chapters.
 *
 * The app's chapter list is shorter than the textbook (Class 4 has two chapters
 * per term; the book has 3–9 units), so several units can share a chapter.
 * In order of trust:
 *   number  — "Chapter 3" ↔ chapter 3 (books with no terms)
 *   title   — the unit's or a lesson's title appears in the chapter title
 *   order   — by position within the same term (needs a person to check)
 *   subject — videos for the whole subject, not one chapter
 */
import type { UnitMatch } from "./db/schema";

export type ChapterRef = { readonly id: string; readonly chapterNumber: number; readonly title: { readonly en: string; readonly ta: string } };
export type UnitForMatch = {
  readonly term: number | null;
  readonly unitNo: number | null;
  readonly title: string;
  readonly lessonTitles: readonly string[];
};
export type UnitMatchResult = { chapterId: string | null; match: UnitMatch | null };

const norm = (s: string) =>
  ` ${s
    .normalize("NFC")
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/\b(part|ex)\s*-?\s*[\d.]+/g, " ")
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, " ")
    .trim()} `;

/** "Term 2 - Ch 1: …" / "பருவம் 2: …" → 2. */
export function termOfChapter(title: { en: string; ta: string }): number | null {
  // Not \b: in JavaScript a word boundary doesn't work next to Tamil letters.
  const m = /(?:^|[^\p{L}\p{M}])(term|பருவம்)\s*(\d)/iu.exec(`${title.en} ${title.ta}`);
  return m ? Number(m[2]) : null;
}

function titleHit(unit: UnitForMatch, chapter: ChapterRef): boolean {
  const hay = `${norm(chapter.title.en)}${norm(chapter.title.ta)}`;
  return [unit.title, ...unit.lessonTitles].some((t) => {
    const needle = norm(t);
    return needle.trim().length >= 4 && hay.includes(needle);
  });
}

/**
 * Matches every unit of one subject and medium. `units` must be all the units
 * of that subject, so "order" can place each unit among its term's units.
 */
export function matchUnits(units: readonly UnitForMatch[], chapters: readonly ChapterRef[]): UnitMatchResult[] {
  const terms = chapters.map((c) => termOfChapter(c.title));
  const termed = terms.some((t) => t !== null);

  return units.map((unit) => {
    if (unit.unitNo === null) return { chapterId: null, match: "subject" };

    if (unit.term === null && !termed) {
      const byNumber = chapters.find((c) => c.chapterNumber === unit.unitNo);
      if (byNumber) return { chapterId: byNumber.id, match: "number" };
    }

    const sameTerm = chapters.filter((_, i) => unit.term === null || terms[i] === unit.term || terms[i] === null);
    const hit = sameTerm.find((c) => titleHit(unit, c)) ?? chapters.find((c) => titleHit(unit, c));
    if (hit) return { chapterId: hit.id, match: "title" };

    if (unit.term !== null && termed) {
      const inTerm = chapters.filter((_, i) => terms[i] === unit.term);
      const siblings = units
        .filter((u) => u.term === unit.term && u.unitNo !== null)
        .map((u) => u.unitNo!)
        .sort((a, b) => a - b);
      const idx = siblings.indexOf(unit.unitNo);
      if (inTerm.length && idx >= 0) {
        const chapter = inTerm[Math.min(inTerm.length - 1, Math.floor((idx * inTerm.length) / siblings.length))]!;
        return { chapterId: chapter.id, match: "order" };
      }
    }

    const byNumber = chapters.find((c) => c.chapterNumber === unit.unitNo);
    return byNumber ? { chapterId: byNumber.id, match: "order" } : { chapterId: null, match: null };
  });
}
