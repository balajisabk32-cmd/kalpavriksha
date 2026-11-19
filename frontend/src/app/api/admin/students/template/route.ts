import { getSessionUser } from "@/server/auth/current-user";
import { studentTemplate } from "@/server/student-import";

/** The Excel template for importing students (admins only). */
export async function GET() {
  const user = await getSessionUser();
  if (user?.role !== "admin") return new Response("Not allowed", { status: 403 });
  return new Response(await studentTemplate(), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="kalpavriksha-students-template.xlsx"',
      "Cache-Control": "no-store",
    },
  });
}
