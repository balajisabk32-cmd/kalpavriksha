import { getSessionUser } from "@/server/auth/current-user";
import { getDb } from "@/server/db";
import { recordVideoProgress } from "@/server/learning";

/** Body: { videoId, seconds, duration }. Saves how far the user got in a video. */
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "signed_out" }, { status: 401 });
  let body: { videoId?: unknown; seconds?: unknown; duration?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  const videoId = Number(body.videoId);
  const seconds = Number(body.seconds);
  const duration = body.duration === null || body.duration === undefined ? null : Number(body.duration);
  if (!Number.isFinite(seconds) || (duration !== null && !Number.isFinite(duration))) {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  const row = await recordVideoProgress(await getDb(), user.id, videoId, seconds, duration);
  if (!row) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json(row);
}
