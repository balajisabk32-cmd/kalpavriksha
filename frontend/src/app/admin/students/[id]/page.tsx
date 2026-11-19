import { notFound } from "next/navigation";
import { z } from "zod";
import { StudentDetailPage } from "@/modules/staff/student-detail";
import { getDb } from "@/server/db";
import { getStudent } from "@/server/people";
import { toListItem } from "@/server/serialize";

export default async function AdminStudentPage(props: PageProps<"/admin/students/[id]">) {
  const { id } = await props.params;
  if (!z.uuid().safeParse(id).success) notFound();
  const student = await getStudent(await getDb(), id);
  if (!student) notFound();
  const { history, ...row } = student;
  return <StudentDetailPage student={toListItem(row)} history={history.map((h) => ({ ...h, at: h.at.toISOString() }))} />;
}
