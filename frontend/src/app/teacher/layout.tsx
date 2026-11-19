import { StaffShell } from "@/modules/staff/staff-shell";
import { requireUser } from "@/server/auth/current-user";

export const metadata = { title: "Teacher — Kalpavriksha", robots: { index: false } };

export default async function TeacherLayout({ children }: LayoutProps<"/teacher">) {
  const me = await requireUser(["teacher", "admin"], "/teacher");
  return (
    <StaffShell role={me.role === "admin" ? "admin" : "teacher"} name={me.displayName}>
      {children}
    </StaffShell>
  );
}
