import { SettingsPage } from "@/modules/staff/staff-and-settings";
import { academicYearLabel } from "@/server/academic-year";
import { getDb } from "@/server/db";
import { currentAcademicYear, getPromotionDate } from "@/server/people";

export default async function AdminSettingsPage() {
  const db = await getDb();
  const [promotion, year] = await Promise.all([getPromotionDate(db), currentAcademicYear(db)]);
  return <SettingsPage promotion={promotion} yearLabel={academicYearLabel(year)} />;
}
