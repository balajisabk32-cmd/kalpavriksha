import { getSessionUser } from "@/server/auth/current-user";
import { getDb } from "@/server/db";
import { loadProgress, saveProgress } from "@/server/learning";

const MAX_BYTES = 256 * 1024;

/** The signed-in user's saved progress (XP, lessons, review cards…). */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "signed_out" }, { status: 401 });
  const saved = await loadProgress(await getDb(), user.id);
  return Response.json({ progress: saved?.data ?? null }, { headers: { "Cache-Control": "private, no-store" } });
}

/** Saves the whole progress object (sent by the app a moment after each change). */
export async function PUT(request: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "signed_out" }, { status: 401 });
  const text = await request.text();
  if (text.length > MAX_BYTES) return Response.json({ error: "too_big" }, { status: 413 });
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  await saveProgress(await getDb(), user.id, raw);
  return new Response(null, { status: 204 });
}
