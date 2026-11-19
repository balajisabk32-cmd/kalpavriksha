/**
 * Chapter explanations with real-life analogies (Phase 6).
 *
 * Staff copy a prompt (built here from the chapter), paste it into Gemini, and
 * paste Gemini's JSON answer back. It is checked against `explanationSchema`,
 * saved as a draft, reviewed, then published for students.
 */
import { and, eq, like } from "drizzle-orm";
import type { Database } from "./db/connect";
import { chapterExplanations, type ExplanationStatus, type Medium } from "./db/schema";
import { findChapter } from "./content";
import { InputError } from "./people";

export { explanationSchema, parseExplanation, type Explanation, type ParseResult } from "@/lib/explanation";
import { explanationSchema, parseExplanation, type Explanation } from "@/lib/explanation";

const LEVEL = (standard: number) =>
  standard <= 5 ? "a 9–10 year old" : standard <= 8 ? "a 12–13 year old" : standard <= 10 ? "a 14–15 year old" : "a 16–17 year old";

/**
 * Tamil medium is the English medium translated, so the Tamil explanation is a
 * translation of the English one: same sections, same analogies, same questions.
 */
export function translationPrompt(chapterId: string, english: Explanation): string {
  const found = findChapter(chapterId);
  if (!found) throw new InputError("not_found");
  const { subject, chapter, standard } = found;
  return [
    `You are a Tamil Nadu State Board (Samacheer Kalvi) teacher who teaches Tamil medium.`,
    `Translate this Class ${standard} ${subject.name.en} explanation into simple, everyday Tamil (தமிழ்) for ${LEVEL(standard)}.`,
    `Chapter: ${chapter.title.ta} (${chapter.title.en})`,
    ``,
    `Rules:`,
    `- Translate faithfully: keep every section, analogy, example, key point, question and word in the same order. Add nothing, leave nothing out.`,
    `- Use the Tamil terms the Tamil Nadu Tamil-medium textbook uses, with the English term in brackets the first time it appears.`,
    `- Use simple standard written Tamil, as in the Tamil Nadu textbooks — not spoken/colloquial Tamil (write "பற்றி", "செய்கிறது", not "பத்தி", "செய்யுது").`,
    `- Use only Tamil script, apart from the English terms in brackets. No Hindi or other-language words.`,
    `- Keep the meaning exactly; do not turn a "can" into a "cannot". Translate each value completely.`,
    `- Keep the JSON keys exactly as they are (in English); translate only the values.`,
    ``,
    `Reply with ONLY the translated JSON (no other text):`,
    JSON.stringify(english, null, 2),
  ].join("\n");
}

/** The prompt staff paste into Gemini for one chapter, in one medium. */
export function explanationPrompt(chapterId: string, medium: Medium, pages?: { title: string; startPage: number; endPage: number } | null): string {
  const found = findChapter(chapterId);
  if (!found) throw new InputError("not_found");
  const { subject, chapter, standard } = found;
  const tamil = medium === "ta";
  return [
    `You are a kind, experienced Tamil Nadu State Board (Samacheer Kalvi) teacher.`,
    `Explain this chapter to ${LEVEL(standard)} in Class ${standard} who studies in ${tamil ? "Tamil medium" : "English medium"}.`,
    ``,
    `Subject: ${subject.name.en} (${subject.name.ta})`,
    `Chapter: ${chapter.title.en} — ${chapter.title.ta}`,
    pages ? `Textbook: ${pages.title}, pages ${pages.startPage}–${pages.endPage}. Follow what these pages teach (I have attached them if possible).` : ``,
    ``,
    `Rules:`,
    `- Write everything in ${tamil ? "simple, everyday Tamil (தமிழ்). Keep scientific/technical terms in Tamil as the Tamil Nadu textbook uses them, with the English term in brackets the first time" : "simple English (short sentences, everyday words)"}.`,
    `- Cover every main idea of the chapter, in the textbook's order, as 3–8 sections.`,
    `- Every section needs one real-life analogy from a Tamil Nadu child's daily life (home, school, village or town, market, farm, festival, cricket, kitchen, bus, temple…). The analogy must be accurate, and say where it stops matching.`,
    `- Stay true to the syllabus. No facts beyond the class level, nothing made up. If unsure, leave it out.`,
    `- "checkYourself": 3–6 short questions a student can answer from your explanation, with answers.`,
    `- "words": the chapter's important terms with one-line meanings.`,
    ``,
    `Reply with ONLY this JSON (no other text):`,
    `{`,
    `  "summary": "2–3 sentences: what this chapter is about and why it matters in daily life",`,
    `  "sections": [`,
    `    {`,
    `      "heading": "…",`,
    `      "explanation": "the idea explained simply (use \\n for new paragraphs)",`,
    `      "analogy": { "title": "short name of the analogy", "story": "the real-life comparison, 3–6 sentences" },`,
    `      "example": "optional: a worked example or everyday example"`,
    `    }`,
    `  ],`,
    `  "keyPoints": ["…", "…"],`,
    `  "checkYourself": [{ "question": "…", "answer": "…" }],`,
    `  "words": [{ "term": "…", "meaning": "…" }]`,
    `}`,
  ]
    .filter((l, i, all) => !(l === "" && all[i - 1] === ""))
    .join("\n");
}

export type ExplanationRow = { chapterId: string; medium: Medium; status: ExplanationStatus; data: Explanation; updatedAt: Date; publishedAt: Date | null };

export async function getExplanation(db: Database, chapterId: string, medium: Medium): Promise<ExplanationRow | null> {
  const [row] = await db
    .select()
    .from(chapterExplanations)
    .where(and(eq(chapterExplanations.chapterId, chapterId), eq(chapterExplanations.medium, medium)))
    .limit(1);
  if (!row) return null;
  const parsed = explanationSchema.safeParse(row.data);
  return parsed.success ? { chapterId: row.chapterId, medium: row.medium, status: row.status, data: parsed.data, updatedAt: row.updatedAt, publishedAt: row.publishedAt } : null;
}

/**
 * What a reader sees: the published explanation in their medium, else the other
 * medium's. Staff (`drafts`) also see drafts so they can review them in place.
 */
export async function explanationFor(db: Database, chapterId: string, medium: Medium, drafts = false) {
  for (const m of [medium, medium === "en" ? "ta" : "en"] as const) {
    const row = await getExplanation(db, chapterId, m);
    if (row && (row.status === "published" || drafts)) return { medium: m, status: row.status, data: row.data };
  }
  return null;
}

/** Saves (or replaces) an explanation. Publishing is a separate step unless asked. */
export async function saveExplanation(
  db: Database,
  input: { chapterId: string; medium: Medium; raw: string; publish?: boolean; userId: string | null },
  now = new Date(),
): Promise<ExplanationRow> {
  if (!findChapter(input.chapterId)) throw new InputError("not_found");
  const parsed = parseExplanation(input.raw);
  if (!parsed.ok) throw new ExplanationError(parsed.error);
  const status: ExplanationStatus = input.publish ? "published" : "draft";
  const values = { data: parsed.data, status, source: "gemini", updatedBy: input.userId, updatedAt: now, publishedAt: input.publish ? now : null };
  const [row] = await db
    .insert(chapterExplanations)
    .values({ chapterId: input.chapterId, medium: input.medium, ...values })
    .onConflictDoUpdate({ target: [chapterExplanations.chapterId, chapterExplanations.medium], set: values })
    .returning();
  return { chapterId: row!.chapterId, medium: row!.medium, status: row!.status, data: parsed.data, updatedAt: row!.updatedAt, publishedAt: row!.publishedAt };
}

export async function setExplanationStatus(db: Database, chapterId: string, medium: Medium, status: ExplanationStatus, now = new Date()) {
  const rows = await db
    .update(chapterExplanations)
    .set({ status, publishedAt: status === "published" ? now : null, updatedAt: now })
    .where(and(eq(chapterExplanations.chapterId, chapterId), eq(chapterExplanations.medium, medium)))
    .returning({ chapterId: chapterExplanations.chapterId });
  if (!rows.length) throw new InputError("not_found");
}

export async function deleteExplanation(db: Database, chapterId: string, medium: Medium) {
  await db.delete(chapterExplanations).where(and(eq(chapterExplanations.chapterId, chapterId), eq(chapterExplanations.medium, medium)));
}

/** Status of every chapter's explanations in a subject, for the admin list. */
export async function explanationStatuses(db: Database, subjectId: string) {
  const rows = await db
    .select({ chapterId: chapterExplanations.chapterId, medium: chapterExplanations.medium, status: chapterExplanations.status })
    .from(chapterExplanations)
    .where(like(chapterExplanations.chapterId, `${subjectId}-ch%`));
  const out: Record<string, Partial<Record<Medium, ExplanationStatus>>> = {};
  for (const r of rows) (out[r.chapterId] ??= {})[r.medium] = r.status;
  return out;
}

/** A pasted answer that couldn't be used; the message says why. */
export class ExplanationError extends Error {}
