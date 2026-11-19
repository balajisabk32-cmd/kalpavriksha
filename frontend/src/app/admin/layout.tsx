import { StaffShell } from "@/modules/staff/staff-shell";
import { requireUser } from "@/server/auth/current-user";

export const metadata = { title: "Admin — Kalpavriksha", robots: { index: false } };

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const me = await requireUser(["admin"], "/admin");
  return (
    <StaffShell role="admin" name={me.displayName}>
      {children}
    </StaffShell>
  );
}
