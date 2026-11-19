import { notFound } from "next/navigation";
import { ExplainEditor } from "@/modules/staff/explain-editor";
import { findChapter, listChapterPages, listTextbooks } from "@/server/content";
import { getDb } from "@/server/db";
import { explanationPrompt, getExplanation } from "@/server/explanations";

export default async function ExplainChapterPage(props: PageProps<"/admin/content/[subjectId]/explain/[chapterId]">) {
  const { subjectId, chapterId } = await props.params;
  const found = findChapter(chapterId);
  if (!found || found.subject.id !== subjectId) notFound();
  const db = await getDb();
  const [books, pages, en, ta] = await Promise.all([
    listTextbooks(db, subjectId),
    listChapterPages(db, subjectId),
    getExplanation(db, chapterId, "en"),
    getExplanation(db, chapterId, "ta"),
  ]);
  // The chapter's textbook pages in each medium, so the prompt can point Gemini at them.
  const pagesIn = (medium: "en" | "ta") => {
    for (const p of pages.filter((x) => x.chapterId === chapterId)) {
      const book = books.find((b) => b.id === p.textbookId);
      if (book?.medium === medium) return { title: book.title, startPage: p.startPage, endPage: p.endPage, textbookId: book.id };
    }
    return null;
  };
  const side = (medium: "en" | "ta", row: typeof en) => {
    const p = pagesIn(medium);
    return {
      prompt: explanationPrompt(chapterId, medium, p),
      pages: p,
      saved: row ? { status: row.status, json: JSON.stringify(row.data, null, 2), updatedAt: row.updatedAt.toISOString() } : null,
    };
  };
  return (
    <ExplainEditor
      standard={found.standard}
      subjectId={subjectId}
      subjectName={found.subject.name}
      chapterId={chapterId}
      chapterTitle={found.chapter.title}
      chapterNumber={found.chapter.chapterNumber}
      next={found.subject.chapters[found.subject.chapters.findIndex((c) => c.id === chapterId) + 1]?.id ?? null}
      media={{ en: side("en", en), ta: side("ta", ta) }}
    />
  );
}
