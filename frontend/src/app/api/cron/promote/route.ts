import { getDb } from "@/server/db";
import { runPromotion } from "@/server/people";

/**
 * Daily job (vercel.json → crons). Moves students up a class once the
 * promotion date has passed; does nothing on every other day.
 * Vercel sends `Authorization: Bearer $CRON_SECRET`.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Not allowed", { status: 401 });
  }
  const result = await runPromotion(await getDb());
  return Response.json(result, { headers: { "Cache-Control": "no-store" } });
}
