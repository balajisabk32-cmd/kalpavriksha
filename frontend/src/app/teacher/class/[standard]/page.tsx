import { notFound } from "next/navigation";
import { TeacherClassStudentsPage } from "@/modules/staff/staff-and-settings";
import { getDb } from "@/server/db";
import { listStudents } from "@/server/people";
import { toListItem } from "@/server/serialize";

export default async function TeacherClassPage(props: PageProps<"/teacher/class/[standard]">) {
  const standard = Number((await props.params).standard);
  if (!Number.isInteger(standard) || standard < 4 || standard > 12) notFound();
  const students = await listStudents(await getDb(), { standard });
  return <TeacherClassStudentsPage standard={standard} students={students.map(toListItem)} />;
}
