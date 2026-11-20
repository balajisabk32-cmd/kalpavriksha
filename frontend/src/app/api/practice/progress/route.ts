import { z } from "zod";
import { getSessionUser } from "@/server/auth/current-user";
import { getDb } from "@/server/db";
import { PRACTICE_STATES } from "@/server/db/schema";
import { InputError } from "@/server/people";
import { recordPractice } from "@/server/practice";

const body = z.object({ setId: z.number().int().positive(), item: z.number().int().min(0).max(5000), state: z.enum(PRACTICE_STATES).nullable() });

/** Saves how the student did on one question: done / help / right / wrong, or null to clear. */
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "signed_out" }, { status: 401 });
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "bad_request" }, { status: 400 });
  try {
    await recordPractice(await getDb(), user.id, parsed.data.setId, parsed.data.item, parsed.data.state);
    return new Response(null, { status: 204 });
  } catch (err) {
    if (err instanceof InputError) return Response.json({ error: err.code }, { status: 404 });
    throw err;
  }
}
