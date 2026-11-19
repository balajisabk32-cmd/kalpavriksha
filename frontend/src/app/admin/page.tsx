import { AdminOverview } from "@/modules/staff/overview";
import { academicYearLabel } from "@/server/academic-year";
import { getDb } from "@/server/db";
import { classCounts, countUsers, currentAcademicYear, getPromotionDate, lastPromotionRun, studentsNeedingGroup } from "@/server/people";

export default async function AdminPage() {
  const db = await getDb();
  const [year, counts, teachers, needGroup, promotion, lastRun] = await Promise.all([
    currentAcademicYear(db),
    classCounts(db),
    countUsers(db, "teacher"),
    studentsNeedingGroup(db),
    getPromotionDate(db),
    lastPromotionRun(db),
  ]);
  return (
    <AdminOverview
      data={{
        yearLabel: academicYearLabel(year),
        counts,
        teachers,
        needGroup,
        promotion,
        lastRun: lastRun ? { ranAt: lastRun.ranAt.toISOString(), promoted: lastRun.promoted, graduated: lastRun.graduated } : null,
      }}
    />
  );
}
