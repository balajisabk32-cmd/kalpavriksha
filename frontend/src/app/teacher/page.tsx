import { TeacherClassesPage } from "@/modules/staff/staff-and-settings";
import { getDb } from "@/server/db";
import { classCounts } from "@/server/people";

export default async function TeacherPage() {
  return <TeacherClassesPage counts={await classCounts(await getDb())} />;
}
