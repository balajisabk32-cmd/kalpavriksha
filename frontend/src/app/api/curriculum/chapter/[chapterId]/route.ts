import { allChapterIds, getChapterDetail } from "@/lib/curriculum-data";

/** Prerendered at build time: one ~2 KB JSON file per chapter. */
export function generateStaticParams() {
  return allChapterIds().map((chapterId) => ({ chapterId }));
}

/** One full chapter (lesson text, practice questions, resources) with its subject. */
export async function GET(_request: Request, ctx: RouteContext<"/api/curriculum/chapter/[chapterId]">) {
  const { chapterId } = await ctx.params;
  const detail = getChapterDetail(chapterId);
  if (!detail) return Response.json({ error: `Chapter ${chapterId} not found.` }, { status: 404 });
  return Response.json(detail);
}
