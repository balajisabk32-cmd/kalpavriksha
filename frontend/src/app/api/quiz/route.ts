import { z } from "zod";
import { subjectLanguage } from "@/lib/subject-language";
import { getSessionUser } from "@/server/auth/current-user";
import { findChapter } from "@/server/content";
import { getDb } from "@/server/db";
import type { Medium } from "@/server/db/schema";
import { buildQuiz, quizSize, quizStats, submitQuiz } from "@/server/quiz";

type User = NonNullable<Awaited<ReturnType<typeof getSessionUser>>>;

/** The chapter, the medium the student reads it in, and whether drafts are visible; null when not allowed. */
function scope(user: User, chapterId: string, asked: string | null) {
  const found = findChapter(chapterId);
  if (!found) return null;
  const standard = Number(/^c(\d+)-/.exec(chapterId)?.[1]);
  if (user.student && user.student.standard !== standard) return null;
  const medium: Medium = subjectLanguage(found.subject.id) ?? (asked === "ta" || asked === "en" ? asked : (user.student?.medium ?? "en"));
  return { chapterId, medium, userId: user.id, drafts: user.role !== "student" };
}

const NO_STORE = { headers: { "Cache-Control": "private, no-store" } };

/**
 * `?chapter=c10-math-ch3` → how many quiz questions it has and the student's scores.
 * Add `&start=1` for a fresh quiz (questions with answers, checked in the browser
 * for instant feedback and again on submit).
 */
export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "signed_out" }, { status: 401 });
  const url = new URL(request.url);
  const s = scope(user, url.searchParams.get("chapter") ?? "", url.searchParams.get("medium"));
  if (!s) return Response.json({ error: "not_found" }, { status: 404 });
  const db = await getDb();
  if (url.searchParams.get("start")) return Response.json({ questions: await buildQuiz(db, s) }, NO_STORE);
  const [available, stats] = await Promise.all([quizSize(db, s), quizStats(db, user.id, s.chapterId)]);
  return Response.json({ available, stats }, NO_STORE);
}

const body = z.object({
  chapter: z.string().min(1).max(80),
  medium: z.enum(["en", "ta"]).optional(),
  answers: z.array(z.object({ setId: z.number().int().positive(), item: z.number().int().min(0).max(5000), key: z.string().min(1).max(8) })).min(1).max(20),
});

/** Saves a finished quiz and returns the checked score. */
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "signed_out" }, { status: 401 });
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "bad_request" }, { status: 400 });
  const s = scope(user, parsed.data.chapter, parsed.data.medium ?? null);
  if (!s) return Response.json({ error: "not_found" }, { status: 404 });
  const result = await submitQuiz(await getDb(), { ...s, answers: parsed.data.answers });
  if (!result) return Response.json({ error: "no_answers" }, { status: 400 });
  return Response.json(result, NO_STORE);
}
