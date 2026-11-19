import { getSessionUser } from "@/server/auth/current-user";

/** The signed-in user, for client screens (the learning modules). 401 when signed out. */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return Response.json({ user: null }, { status: 401, headers: { "Cache-Control": "no-store" } });
  return Response.json({ user }, { headers: { "Cache-Control": "private, no-store" } });
}
