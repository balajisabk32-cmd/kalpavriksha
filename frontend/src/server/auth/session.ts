import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, lt, sql } from "drizzle-orm";
import type { Database } from "../db/connect";
import { sessions, students, users, type Medium, type Role } from "../db/schema";
import { DUMMY_HASH, verifyPassword } from "./password";

export const SESSION_COOKIE = "kv_session";
/** Students stay signed in for 30 days on their device; staff for 7. */
export const SESSION_DAYS: Record<Role, number> = { student: 30, teacher: 7, admin: 7 };
export const MAX_FAILED_LOGINS = 10;
export const LOCK_MINUTES = 15;

export type SessionUser = {
  readonly id: string;
  readonly role: Role;
  readonly username: string;
  readonly displayName: string;
  readonly student: { readonly standard: number; readonly medium: Medium; readonly groupId: string | null } | null;
};

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

export async function createSession(db: Database, userId: string, role: Role, now = new Date()) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + SESSION_DAYS[role] * 86_400_000);
  await db.insert(sessions).values({ id: hashToken(token), userId, expiresAt, createdAt: now });
  // Tidy up: expired sessions of anyone are no use.
  await db.delete(sessions).where(lt(sessions.expiresAt, now));
  return { token, expiresAt };
}

/** The signed-in user for a cookie token, or null if the session is unknown, expired or the account archived. */
export async function validateSessionToken(db: Database, token: string, now = new Date()): Promise<SessionUser | null> {
  if (!token) return null;
  const rows = await db
    .select({
      id: users.id,
      role: users.role,
      username: users.username,
      displayName: users.displayName,
      status: users.status,
      standard: students.standard,
      medium: students.medium,
      groupId: students.groupId,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .leftJoin(students, eq(students.userId, users.id))
    .where(and(eq(sessions.id, hashToken(token)), gt(sessions.expiresAt, now)))
    .limit(1);
  const row = rows[0];
  if (!row || row.status !== "active") return null;
  return {
    id: row.id,
    role: row.role,
    username: row.username,
    displayName: row.displayName,
    student:
      row.role === "student" && row.standard !== null
        ? { standard: row.standard, medium: row.medium ?? "en", groupId: row.groupId }
        : null,
  };
}

export async function deleteSession(db: Database, token: string) {
  await db.delete(sessions).where(eq(sessions.id, hashToken(token)));
}

/** Signs a user out everywhere (after a password reset or archiving). */
export async function deleteUserSessions(db: Database, userId: string) {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

export type AuthResult =
  | { ok: true; userId: string; role: Role }
  | { ok: false; reason: "invalid" | "locked" | "archived"; lockedUntil?: Date };

/**
 * Checks a username and password. After MAX_FAILED_LOGINS wrong passwords in a
 * row the account is locked for LOCK_MINUTES. Unknown usernames take as long to
 * reject as wrong passwords.
 */
export async function authenticate(db: Database, rawUsername: string, password: string, now = new Date()): Promise<AuthResult> {
  const username = normalizeUsername(rawUsername);
  const [user] = await db.select().from(users).where(eq(users.username, username)).limit(1);
  if (!user) {
    await verifyPassword(password, DUMMY_HASH);
    return { ok: false, reason: "invalid" };
  }
  if (user.lockedUntil && user.lockedUntil > now) return { ok: false, reason: "locked", lockedUntil: user.lockedUntil };

  const good = await verifyPassword(password, user.passwordHash);
  if (!good) {
    const failed = user.failedLogins + 1;
    const lock = failed >= MAX_FAILED_LOGINS ? new Date(now.getTime() + LOCK_MINUTES * 60_000) : null;
    await db
      .update(users)
      .set({ failedLogins: lock ? 0 : failed, lockedUntil: lock })
      .where(eq(users.id, user.id));
    return lock ? { ok: false, reason: "locked", lockedUntil: lock } : { ok: false, reason: "invalid" };
  }
  if (user.status !== "active") return { ok: false, reason: "archived" };

  await db
    .update(users)
    .set({ failedLogins: 0, lockedUntil: null, lastLoginAt: now })
    .where(eq(users.id, user.id));
  return { ok: true, userId: user.id, role: user.role };
}

/** Count of a user's live sessions (used by tests and the admin view). */
export async function liveSessionCount(db: Database, userId: string, now = new Date()): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(sessions)
    .where(and(eq(sessions.userId, userId), gt(sessions.expiresAt, now)));
  return row?.n ?? 0;
}
