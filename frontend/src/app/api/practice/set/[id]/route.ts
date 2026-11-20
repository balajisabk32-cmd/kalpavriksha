import { getSessionUser } from "@/server/auth/current-user";
import { findSubject } from "@/server/content";
import { getDb } from "@/server/db";
import { getPracticeSet, loadSetBody, neighbours, setProgress } from "@/server/practice";

/** One exercise: its questions and answers, the student's progress, and the sets before/after it. */
export async function GET(_request: Request, ctx: RouteContext<"/api/practice/set/[id]">) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "signed_out" }, { status: 401 });
  const id = Number((await ctx.params).id);
  const db = await getDb();
  const row = Number.isInteger(id) ? await getPracticeSet(db, id) : null;
  if (!row) return Response.json({ error: "not_found" }, { status: 404 });
  const { set, chapter } = row;
  if (user.student && (user.student.standard !== chapter.standard || chapter.status !== "published")) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
  const [body, progress, around] = await Promise.all([loadSetBody(set.storageKey), setProgress(db, user.id, set.id), neighbours(db, chapter.id, set.id)]);
  if (!body) return Response.json({ error: "missing" }, { status: 404 });
  return Response.json(
    {
      set: { id: set.id, kind: set.kind, number: set.number, title: set.title, itemCount: set.itemCount },
      chapter: {
        id: chapter.id,
        subjectId: chapter.subjectId,
        subjectName: findSubject(chapter.subjectId)?.name ?? null,
        standard: chapter.standard,
        medium: chapter.medium,
        book: chapter.book,
        term: chapter.term,
        number: chapter.number,
        title: chapter.title,
        appChapterId: chapter.appChapterId,
      },
      sections: body.sections,
      progress,
      ...around,
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
