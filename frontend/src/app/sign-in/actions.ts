"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { clearSessionCookie, homeFor, safeNext, setSessionCookie } from "@/server/auth/current-user";
import { authenticate, createSession, deleteSession, SESSION_COOKIE } from "@/server/auth/session";
import { getDb } from "@/server/db";

export type SignInState = { error?: "missing" | "invalid" | "locked" | "archived" | "server"; username?: string };

export async function signInAction(_prev: SignInState, form: FormData): Promise<SignInState> {
  const username = String(form.get("username") ?? "").trim();
  const password = String(form.get("password") ?? "");
  if (!username || !password) return { error: "missing", username };

  let destination: string;
  try {
    const db = await getDb();
    const result = await authenticate(db, username, password);
    if (!result.ok) return { error: result.reason, username };
    const { token, expiresAt } = await createSession(db, result.userId, result.role);
    await setSessionCookie(token, expiresAt);
    const next = safeNext(form.get("next"));
    // A student can't be sent into the staff area by a crafted link.
    destination = next && !(result.role === "student" && /^\/(admin|teacher)/.test(next)) ? next : homeFor(result.role);
  } catch (err) {
    console.error("sign-in failed", err);
    return { error: "server", username };
  }
  redirect(destination);
}

export async function signOutAction() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (token) await deleteSession(await getDb(), token);
  await clearSessionCookie();
  redirect("/sign-in");
}
