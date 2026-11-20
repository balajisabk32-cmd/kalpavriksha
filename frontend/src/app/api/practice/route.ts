import { subjectLanguage } from "@/lib/subject-language";
import { getSessionUser } from "@/server/auth/current-user";
import { findSubject } from "@/server/content";
import { getDb } from "@/server/db";
import { practiceForSubject, practiceSubjects } from "@/server/practice";

/**
 * A subject's exercises in textbook order, with the student's progress.
 * `?subject=c10-math` (required), `&medium=en|ta`, `&chapter=<app chapter id>` to
 * list only the exercises linked to one lesson.
 */
export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "signed_out" }, { status: 401 });
  const url = new URL(request.url);
  const subjectId = url.searchParams.get("subject") ?? "";
  // No subject: the class's subjects with their totals (`?standard=` for staff).
  if (!subjectId) {
    const standard = user.student?.standard ?? Number(url.searchParams.get("standard"));
    if (!(standard >= 4 && standard <= 12)) return Response.json({ error: "standard" }, { status: 400 });
    const m = url.searchParams.get("medium");
    const medium = m === "ta" || m === "en" ? m : (user.student?.medium ?? "en");
    const subjects = await practiceSubjects(await getDb(), { standard, medium, userId: user.id, drafts: user.role !== "student" });
    return Response.json({ standard, medium, subjects }, { headers: { "Cache-Control": "private, no-store" } });
  }
  const subject = findSubject(subjectId);
  if (!subject) return Response.json({ error: "not_found" }, { status: 404 });
  const standard = Number(/^c(\d+)-/.exec(subjectId)![1]);
  if (user.student && user.student.standard !== standard) return Response.json({ error: "forbidden" }, { status: 403 });
  const asked = url.searchParams.get("medium");
  const medium = subjectLanguage(subjectId) ?? (asked === "ta" || asked === "en" ? asked : (user.student?.medium ?? "en"));
  const chapters = await practiceForSubject(await getDb(), {
    subjectId,
    medium,
    userId: user.id,
    drafts: user.role !== "student",
    appChapterId: url.searchParams.get("chapter") ?? undefined,
  });
  return Response.json(
    { subject: { id: subjectId, name: subject.name, standard }, medium, single: Boolean(subjectLanguage(subjectId)), chapters },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
