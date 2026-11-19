import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getDb } from "../db";
import type { Role } from "../db/schema";
import { SESSION_COOKIE, validateSessionToken, type SessionUser } from "./session";

/** Where each role lands after signing in. */
export function homeFor(role: Role): string {
  return role === "student" ? "/m/learn" : role === "teacher" ? "/teacher" : "/admin";
}

/** Only same-site paths, so `?next=` can't send anyone to another website. */
export function safeNext(next: unknown): string | null {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : null;
}

/** The signed-in user for this request (looked up once per request). */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return validateSessionToken(await getDb(), token);
});

/**
 * For pages and server actions: the signed-in user if they have one of `roles`.
 * Signed out → the sign-in page; wrong role → their own home.
 */
export async function requireUser(roles: readonly Role[], from = "/"): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(`/sign-in?next=${encodeURIComponent(from)}`);
  if (!roles.includes(user.role)) redirect(homeFor(user.role));
  return user;
}

export async function setSessionCookie(token: string, expiresAt: Date) {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSessionCookie() {
  (await cookies()).delete(SESSION_COOKIE);
}
