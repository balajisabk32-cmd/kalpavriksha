import { StaffPage } from "@/modules/staff/staff-and-settings";
import { requireUser } from "@/server/auth/current-user";
import { getDb } from "@/server/db";
import { listStaff } from "@/server/people";

export default async function AdminStaffPage() {
  const me = await requireUser(["admin"], "/admin/staff");
  const staff = await listStaff(await getDb());
  return <StaffPage meId={me.id} staff={staff.map((s) => ({ ...s, lastLoginAt: s.lastLoginAt?.toISOString() ?? null }))} />;
}
