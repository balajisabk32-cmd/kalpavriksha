import { getSessionUser } from "@/server/auth/current-user";
import { chapterMedia, findChapter, getTextbook } from "@/server/content";
import { getDb } from "@/server/db";
import { watchedFor } from "@/server/learning";

/**
 * Videos and textbook pages for one chapter, for the signed-in user.
 * Students get their own medium first (`?medium=en|ta` switches); students can
 * only open chapters of their own class.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/lesson/[chapterId]">) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "signed_out" }, { status: 401 });
  const { chapterId } = await ctx.params;
  const found = findChapter(chapterId);
  if (!found) return Response.json({ error: "not_found" }, { status: 404 });
  if (user.student && user.student.standard !== found.standard) return Response.json({ error: "forbidden" }, { status: 403 });

  const asked = new URL(request.url).searchParams.get("medium");
  const medium = asked === "ta" || asked === "en" ? asked : (user.student?.medium ?? "en");
  const db = await getDb();
  const media = await chapterMedia(db, chapterId, medium);
  const other = await chapterMedia(db, chapterId, medium === "en" ? "ta" : "en");
  const book = media.textbook ? await getTextbook(db, media.textbook.id) : null;
  const watched = await watchedFor(db, user.id, [...media.videos, ...media.subjectVideos].map((v) => v.id));

  return Response.json(
    {
      medium,
      // Whether the other medium has something different to offer (for the switch).
      otherMedium: other.videos.some((v) => v.medium !== medium) ? (medium === "en" ? "ta" : "en") : null,
      videos: media.videos,
      subjectVideos: media.subjectVideos,
      textbook:
        media.textbook && book
          ? { ...media.textbook, pages: book.pages, url: `/api/textbooks/${book.id}` }
          : null,
      watched,
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
