import { StudentsPage } from "@/modules/staff/students-list";
import { getDb } from "@/server/db";
import { listStudents } from "@/server/people";
import { toListItem } from "@/server/serialize";

export default async function AdminStudentsPage(props: PageProps<"/admin/students">) {
  const sp = await props.searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const standard = Number(one(sp.class));
  const status = one(sp.status) === "archived" ? "archived" : "active";
  const q = one(sp.q).slice(0, 60);
  const filter = { standard: standard >= 4 && standard <= 12 ? standard : null, status, q } as const;
  const students = await listStudents(await getDb(), filter);
  return <StudentsPage students={students.map(toListItem)} filter={filter} />;
}
