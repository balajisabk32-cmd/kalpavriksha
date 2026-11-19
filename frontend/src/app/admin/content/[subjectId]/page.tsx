import { notFound } from "next/navigation";
import { SubjectContentPage } from "@/modules/staff/content";
import { findSubject, listChapterPages, listTextbooks, subjectUnits } from "@/server/content";
import { getDb } from "@/server/db";
import { explanationStatuses } from "@/server/explanations";

export default async function AdminSubjectContentPage(props: PageProps<"/admin/content/[subjectId]">) {
  const { subjectId } = await props.params;
  const subject = findSubject(subjectId);
  if (!subject) notFound();
  const db = await getDb();
  const [units, books, pages, explain] = await Promise.all([
    subjectUnits(db, subjectId),
    listTextbooks(db, subjectId),
    listChapterPages(db, subjectId),
    explanationStatuses(db, subjectId),
  ]);
  return (
    <SubjectContentPage
      standard={Number(/^c(\d+)-/.exec(subjectId)![1])}
      subjectId={subjectId}
      name={subject.name}
      chapters={subject.chapters.map((c) => ({ id: c.id, chapterNumber: c.chapterNumber, title: c.title }))}
      units={units}
      books={books.map((b) => ({ id: b.id, medium: b.medium, term: b.term, title: b.title, pages: b.pages, sizeBytes: b.sizeBytes }))}
      pages={pages}
      explain={explain}
    />
  );
}
