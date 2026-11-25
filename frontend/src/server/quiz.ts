/**
 * Chapter quizzes: multiple-choice questions drawn at random from the exercises
 * linked to an app chapter. Answers are checked again on the server before the
 * score is saved, and each answer also counts as practice on that question.
 */
import { and, desc, eq, sql } from "drizzle-orm";
import { subjectLanguage } from "@/lib/subject-language";
import type { Database } from "./db/connect";
import { practiceProgress, quizAttempts, type Medium } from "./db/schema";
import { getPracticeSet, loadSetBody, practiceForSubject } from "./practice";

export const QUIZ_SIZE = 10;

export type QuizQuestion = {
  setId: number;
  /** Position of the question in its set (as practice progress counts it). */
  item: number;
  q: string;
  options: { key: string; text: string }[];
  answer: string;
  explanation: string;
};

export type QuizStats = { attempts: number; best: number | null; last: { correct: number; total: number } | null };

/** The MCQ's answer text after the first line (the option) explains why. */
export function mcqExplanation(a: string): string {
  return a
    .split("\n")
    .slice(1)
    .join("\n")
    .replace(/^\s*(explaination|explanation|solution|hint)\s*:?\s*/i, "")
    .trim();
}

type PoolOpts = { chapterId: string; medium: Medium; userId: string; drafts: boolean };

/** Which sets of this chapter have multiple-choice questions, in the medium the student reads. */
async function mcqSets(db: Database, o: PoolOpts) {
  const subjectId = o.chapterId.replace(/-ch\d+$/, "");
  const chapters = await practiceForSubject(db, { subjectId, medium: subjectLanguage(subjectId) ?? o.medium, userId: o.userId, drafts: o.drafts, appChapterId: o.chapterId });
  return chapters.flatMap((c) => c.sets).filter((s) => s.mcqCount > 0);
}

async function setQuestions(db: Database, setId: number): Promise<QuizQuestion[]> {
  const row = await getPracticeSet(db, setId);
  const body = row ? await loadSetBody(row.set.storageKey) : null;
  if (!body) return [];
  const out: QuizQuestion[] = [];
  let index = -1;
  for (const s of body.sections) {
    for (const it of s.items) {
      index++;
      if (it.mcq && it.mcq.options.length >= 2 && it.mcq.options.some((o) => o.key === it.mcq!.answer)) {
        out.push({ setId, item: index, q: it.q, options: it.mcq.options, answer: it.mcq.answer, explanation: mcqExplanation(it.a) });
      }
    }
  }
  return out;
}

function shuffle<T>(list: T[]): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** How many quiz questions the chapter has (0 hides the quiz). */
export async function quizSize(db: Database, o: PoolOpts): Promise<number> {
  return (await mcqSets(db, o)).reduce((n, s) => n + s.mcqCount, 0);
}

/** A fresh quiz: up to QUIZ_SIZE questions, spread over the chapter's sets. */
export async function buildQuiz(db: Database, o: PoolOpts): Promise<QuizQuestion[]> {
  const sets = await mcqSets(db, o);
  const all = (await Promise.all(sets.map((s) => setQuestions(db, s.id)))).flat();
  // Skip near-duplicates (the same MCQ often appears in two sets).
  const seen = new Set<string>();
  const unique = shuffle(all).filter((q) => {
    const k = q.q.replace(/\s+/g, " ").trim().toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return unique.slice(0, QUIZ_SIZE);
}

/** Checks the answers, saves the attempt and marks each question right/wrong in practice. */
export async function submitQuiz(db: Database, o: PoolOpts & { answers: { setId: number; item: number; key: string }[] }) {
  const allowed = new Set((await mcqSets(db, o)).map((s) => s.id));
  const bySet = new Map<number, QuizQuestion[]>();
  const results: { setId: number; item: number; right: boolean; answer: string }[] = [];
  for (const a of o.answers) {
    if (!allowed.has(a.setId)) continue;
    if (!bySet.has(a.setId)) bySet.set(a.setId, await setQuestions(db, a.setId));
    const q = bySet.get(a.setId)!.find((x) => x.item === a.item);
    if (!q || results.some((r) => r.setId === a.setId && r.item === a.item)) continue;
    results.push({ setId: a.setId, item: a.item, right: a.key === q.answer, answer: q.answer });
  }
  if (!results.length) return null;
  const correct = results.filter((r) => r.right).length;
  const medium = subjectLanguage(o.chapterId.replace(/-ch\d+$/, "")) ? null : o.medium;
  await db.insert(quizAttempts).values({ userId: o.userId, chapterId: o.chapterId, medium, total: results.length, correct });
  for (const r of results) {
    const state = r.right ? ("right" as const) : ("wrong" as const);
    await db
      .insert(practiceProgress)
      .values({ userId: o.userId, setId: r.setId, item: r.item, state })
      .onConflictDoUpdate({ target: [practiceProgress.userId, practiceProgress.setId, practiceProgress.item], set: { state, updatedAt: new Date() } });
  }
  return { correct, total: results.length, results, stats: await quizStats(db, o.userId, o.chapterId) };
}

export async function quizStats(db: Database, userId: string, chapterId: string): Promise<QuizStats> {
  const where = and(eq(quizAttempts.userId, userId), eq(quizAttempts.chapterId, chapterId));
  const [agg] = await db
    .select({ attempts: sql<number>`count(*)::int`, best: sql<number | null>`max(round(100.0 * ${quizAttempts.correct} / nullif(${quizAttempts.total}, 0)))::int` })
    .from(quizAttempts)
    .where(where);
  const [last] = await db.select({ correct: quizAttempts.correct, total: quizAttempts.total }).from(quizAttempts).where(where).orderBy(desc(quizAttempts.createdAt), desc(quizAttempts.id)).limit(1);
  return { attempts: agg?.attempts ?? 0, best: agg?.best ?? null, last: last ?? null };
}
