import { PracticeOverview } from "@/modules/staff/practice-admin";
import { findSubject } from "@/server/content";
import { getDb } from "@/server/db";
import { practiceCoverage } from "@/server/practice";

export default async function AdminPracticePage() {
  const rows = await practiceCoverage(await getDb());
  return <PracticeOverview rows={rows.map((r) => ({ ...r, name: findSubject(r.subjectId)?.name ?? { en: r.subjectId, ta: r.subjectId } }))} />;
}
