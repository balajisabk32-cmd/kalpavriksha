import { notFound } from "next/navigation";
import { PracticeSubjectAdmin } from "@/modules/staff/practice-admin";
import { findSubject } from "@/server/content";
import { getDb } from "@/server/db";
import { practiceChaptersForAdmin } from "@/server/practice";

export default async function AdminPracticeSubjectPage(props: PageProps<"/admin/practice/[subjectId]">) {
  const { subjectId } = await props.params;
  const subject = findSubject(subjectId);
  if (!subject) notFound();
  const chapters = await practiceChaptersForAdmin(await getDb(), subjectId);
  return (
    <PracticeSubjectAdmin
      subjectId={subjectId}
      name={subject.name}
      appChapters={subject.chapters.map((c) => ({ id: c.id, chapterNumber: c.chapterNumber, title: c.title }))}
      chapters={chapters}
    />
  );
}
