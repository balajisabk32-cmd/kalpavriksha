/**
 * Accounts: creating students and staff, class changes, password resets,
 * archiving, and the yearly promotion. Every function takes the database as its
 * first argument so tests can run it against an in-memory Postgres.
 */
import { randomInt } from "node:crypto";
import { and, asc, desc, eq, ilike, inArray, lt, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { SENIOR_GROUPS } from "@/lib/curriculum";
import { academicYearOf, DEFAULT_PROMOTION_DATE, isValidMonthDay, type MonthDay } from "./academic-year";
import { hashPassword, MIN_STAFF_PASSWORD, MIN_STUDENT_PASSWORD, staffPassword, studentPassword } from "./auth/password";
import { deleteUserSessions, normalizeUsername } from "./auth/session";
import type { Database } from "./db/connect";
import { classChanges, MEDIUMS, promotionRuns, sessions, settings, students, users, type Medium, type Role } from "./db/schema";

export const ACTIVE_STANDARDS = [4, 5, 6, 7, 8, 9, 10, 11, 12] as const;
export const GROUP_IDS = SENIOR_GROUPS.map((g) => g.id) as [string, ...string[]];

/** A rule broken by the input, with a code the UI turns into a sentence in either language. */
export class InputError extends Error {
  constructor(
    readonly code:
      | "name"
      | "standard"
      | "medium"
      | "group"
      | "group_needed"
      | "username"
      | "username_taken"
      | "password_short"
      | "not_found"
      | "last_admin"
      | "video_link"
      | "pages"
      | "file",
    readonly field?: string,
  ) {
    super(code);
  }
}

const USERNAME_RE = /^[a-z0-9._-]{3,32}$/;

const studentInput = z.object({
  displayName: z.string().trim().min(1).max(60),
  standard: z.number().int().min(4).max(12),
  medium: z.enum(MEDIUMS).default("en"),
  groupId: z.string().nullish(),
  section: z.string().trim().max(10).nullish(),
  username: z.string().nullish(),
  password: z.string().nullish(),
});
export type StudentInput = z.input<typeof studentInput>;

function checkGroup(standard: number, groupId: string | null | undefined): string | null {
  if (standard < 11) return null;
  if (!groupId) return null; // Allowed: set later. The admin list flags "group needed".
  if (!GROUP_IDS.includes(groupId)) throw new InputError("group", "groupId");
  return groupId;
}

/** "Priya Devi" → "priya"; Tamil-only names → "student". */
function usernameStem(displayName: string): string {
  const ascii = displayName
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .trim()
    .split(/\s+/)[0];
  return (ascii && ascii.length >= 2 ? ascii : "student").slice(0, 12);
}

async function usernameTaken(db: Database, username: string): Promise<boolean> {
  const [row] = await db.select({ id: users.id }).from(users).where(eq(users.username, username)).limit(1);
  return Boolean(row);
}

/** A free username like "priya.4821". */
async function freeUsername(db: Database, displayName: string): Promise<string> {
  const stem = usernameStem(displayName);
  for (let i = 0; i < 20; i++) {
    const candidate = `${stem}.${randomInt(1000, 10000)}`;
    if (!(await usernameTaken(db, candidate))) return candidate;
  }
  return `${stem}.${randomInt(100000, 1000000)}`;
}

async function chooseUsername(db: Database, requested: string | null | undefined, displayName: string) {
  if (!requested?.trim()) return freeUsername(db, displayName);
  const username = normalizeUsername(requested);
  if (!USERNAME_RE.test(username)) throw new InputError("username", "username");
  if (await usernameTaken(db, username)) throw new InputError("username_taken", "username");
  return username;
}

export async function getPromotionDate(db: Database): Promise<MonthDay> {
  const [row] = await db.select().from(settings).where(eq(settings.key, "promotion_date")).limit(1);
  return row && isValidMonthDay(row.value) ? row.value : DEFAULT_PROMOTION_DATE;
}

export async function setPromotionDate(db: Database, date: MonthDay) {
  if (!isValidMonthDay(date)) throw new InputError("standard", "promotionDate");
  await db
    .insert(settings)
    .values({ key: "promotion_date", value: date })
    .onConflictDoUpdate({ target: settings.key, set: { value: date, updatedAt: new Date() } });
}

export async function currentAcademicYear(db: Database, now = new Date()): Promise<number> {
  return academicYearOf(now, await getPromotionDate(db));
}

export type NewLogin = { readonly userId: string; readonly username: string; readonly password: string; readonly displayName: string };

/** Creates a student. A username and password are generated unless given. Returns the login to hand out. */
export async function createStudent(db: Database, raw: StudentInput, byUserId: string | null, now = new Date()): Promise<NewLogin & { standard: number }> {
  const parsed = studentInput.safeParse(raw);
  if (!parsed.success) {
    const field = String(parsed.error.issues[0]?.path[0] ?? "name");
    throw new InputError(field === "displayName" ? "name" : field === "standard" ? "standard" : field === "medium" ? "medium" : "name", field);
  }
  const input = parsed.data;
  const groupId = checkGroup(input.standard, input.groupId);
  const password = input.password?.trim() || studentPassword();
  if (password.length < MIN_STUDENT_PASSWORD) throw new InputError("password_short", "password");
  const username = await chooseUsername(db, input.username, input.displayName);
  const year = await currentAcademicYear(db, now);
  const passwordHash = await hashPassword(password);

  const userId = await db.transaction(async (tx) => {
    const [user] = await tx
      .insert(users)
      .values({ role: "student", username, passwordHash, displayName: input.displayName, createdAt: now })
      .returning({ id: users.id });
    const id = user!.id;
    await tx.insert(students).values({
      userId: id,
      standard: input.standard,
      medium: input.medium,
      groupId,
      section: input.section?.trim() || null,
      promotedForYear: year,
      admissionYear: year,
    });
    await tx.insert(classChanges).values({
      studentId: id,
      toStandard: input.standard,
      toGroup: groupId,
      reason: "created",
      academicYear: year,
      byUserId,
      at: now,
    });
    return id;
  });
  return { userId, username, password, displayName: input.displayName, standard: input.standard };
}

const staffInput = z.object({
  role: z.enum(["teacher", "admin"]),
  displayName: z.string().trim().min(1).max(60),
  username: z.string().min(1),
  password: z.string().nullish(),
});

export async function createStaff(db: Database, raw: z.input<typeof staffInput>): Promise<NewLogin & { role: Role }> {
  const parsed = staffInput.safeParse(raw);
  if (!parsed.success) {
    const field = String(parsed.error.issues[0]?.path[0] ?? "name");
    throw new InputError(field === "username" ? "username" : "name", field);
  }
  const input = parsed.data;
  const username = await chooseUsername(db, input.username, input.displayName);
  const password = input.password?.trim() || staffPassword();
  if (password.length < MIN_STAFF_PASSWORD) throw new InputError("password_short", "password");
  const [user] = await db
    .insert(users)
    .values({ role: input.role, username, passwordHash: await hashPassword(password), displayName: input.displayName })
    .returning({ id: users.id });
  return { userId: user!.id, username, password, displayName: input.displayName, role: input.role };
}

/** Moves a student to another class (and stream for 11–12). */
export async function changeClass(
  db: Database,
  studentId: string,
  next: { standard: number; groupId?: string | null },
  byUserId: string | null,
  now = new Date(),
) {
  if (!Number.isInteger(next.standard) || next.standard < 4 || next.standard > 12) throw new InputError("standard", "standard");
  const groupId = checkGroup(next.standard, next.groupId);
  const [current] = await db.select().from(students).where(eq(students.userId, studentId)).limit(1);
  if (!current) throw new InputError("not_found");
  if (current.standard === next.standard && current.groupId === groupId) return;
  const year = await currentAcademicYear(db, now);
  await db.transaction(async (tx) => {
    await tx.update(students).set({ standard: next.standard, groupId }).where(eq(students.userId, studentId));
    await tx.insert(classChanges).values({
      studentId,
      fromStandard: current.standard,
      toStandard: next.standard,
      fromGroup: current.groupId,
      toGroup: groupId,
      reason: "admin",
      academicYear: year,
      byUserId,
      at: now,
    });
  });
}

export async function updateStudentDetails(
  db: Database,
  studentId: string,
  details: { displayName: string; medium: Medium; section?: string | null },
) {
  const name = details.displayName.trim();
  if (!name || name.length > 60) throw new InputError("name", "displayName");
  if (!MEDIUMS.includes(details.medium)) throw new InputError("medium", "medium");
  await db.transaction(async (tx) => {
    await tx.update(users).set({ displayName: name }).where(eq(users.id, studentId));
    await tx
      .update(students)
      .set({ medium: details.medium, section: details.section?.trim() || null })
      .where(eq(students.userId, studentId));
  });
}

/** Sets a new password (generated unless given) and signs the user out everywhere. */
export async function resetPassword(db: Database, userId: string, password?: string): Promise<string> {
  const [user] = await db.select({ role: users.role }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new InputError("not_found");
  const pw = password?.trim() || (user.role === "student" ? studentPassword() : staffPassword());
  const min = user.role === "student" ? MIN_STUDENT_PASSWORD : MIN_STAFF_PASSWORD;
  if (pw.length < min) throw new InputError("password_short", "password");
  await db
    .update(users)
    .set({ passwordHash: await hashPassword(pw), failedLogins: 0, lockedUntil: null })
    .where(eq(users.id, userId));
  await deleteUserSessions(db, userId);
  return pw;
}

/** Archives (can't sign in; records kept) or restores an account. */
export async function setArchived(db: Database, userId: string, archived: boolean, byUserId: string | null, now = new Date()) {
  const [user] = await db.select({ role: users.role, status: users.status }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new InputError("not_found");
  if (archived && user.role === "admin") {
    const [{ n }] = (await db
      .select({ n: sql<number>`count(*)::int` })
      .from(users)
      .where(and(eq(users.role, "admin"), eq(users.status, "active")))) as [{ n: number }];
    if (n <= 1) throw new InputError("last_admin");
  }
  await db.update(users).set({ status: archived ? "archived" : "active" }).where(eq(users.id, userId));
  if (archived) {
    await deleteUserSessions(db, userId);
  } else if (user.role === "student" && user.status === "archived") {
    // Back in the current year's class: don't let the next promotion run jump them ahead.
    const year = await currentAcademicYear(db, now);
    const [s] = await db.select().from(students).where(eq(students.userId, userId)).limit(1);
    await db.update(students).set({ promotedForYear: year }).where(eq(students.userId, userId));
    if (s) {
      await db.insert(classChanges).values({
        studentId: userId,
        fromStandard: s.standard,
        toStandard: s.standard,
        fromGroup: s.groupId,
        toGroup: s.groupId,
        reason: "restored",
        academicYear: year,
        byUserId,
        at: now,
      });
    }
  }
}

export type StudentRow = {
  readonly id: string;
  readonly username: string;
  readonly displayName: string;
  readonly status: "active" | "archived";
  readonly standard: number;
  readonly medium: Medium;
  readonly groupId: string | null;
  readonly section: string | null;
  readonly lastLoginAt: Date | null;
  readonly locked: boolean;
};

export async function listStudents(
  db: Database,
  filter: { id?: string; standard?: number | null; status?: "active" | "archived" | "all"; q?: string | null } = {},
  now = new Date(),
): Promise<StudentRow[]> {
  const where: SQL[] = [eq(users.role, "student")];
  if (filter.id) where.push(eq(users.id, filter.id));
  if (filter.standard) where.push(eq(students.standard, filter.standard));
  const status = filter.status ?? "active";
  if (status !== "all") where.push(eq(users.status, status));
  const q = filter.q?.trim();
  if (q) {
    const like = `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
    where.push(or(ilike(users.displayName, like), ilike(users.username, like))!);
  }
  const rows = await db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      status: users.status,
      lastLoginAt: users.lastLoginAt,
      lockedUntil: users.lockedUntil,
      standard: students.standard,
      medium: students.medium,
      groupId: students.groupId,
      section: students.section,
    })
    .from(users)
    .innerJoin(students, eq(students.userId, users.id))
    .where(and(...where))
    .orderBy(asc(students.standard), asc(users.displayName))
    .limit(2000);
  return rows.map(({ lockedUntil, ...r }) => ({ ...r, locked: Boolean(lockedUntil && lockedUntil > now) }));
}

export async function getStudent(db: Database, id: string) {
  const [row] = await listStudents(db, { id, status: "all" });
  if (!row) return null;
  const history = await db
    .select({
      fromStandard: classChanges.fromStandard,
      toStandard: classChanges.toStandard,
      fromGroup: classChanges.fromGroup,
      toGroup: classChanges.toGroup,
      reason: classChanges.reason,
      academicYear: classChanges.academicYear,
      at: classChanges.at,
      byName: users.displayName,
    })
    .from(classChanges)
    .leftJoin(users, eq(users.id, classChanges.byUserId))
    .where(eq(classChanges.studentId, id))
    .orderBy(desc(classChanges.at), desc(classChanges.id));
  return { ...row, history };
}

export async function listStaff(db: Database, now = new Date()) {
  const rows = await db
    .select({
      id: users.id,
      role: users.role,
      username: users.username,
      displayName: users.displayName,
      status: users.status,
      lastLoginAt: users.lastLoginAt,
      lockedUntil: users.lockedUntil,
    })
    .from(users)
    .where(inArray(users.role, ["teacher", "admin"]))
    .orderBy(asc(users.role), asc(users.displayName));
  return rows.map(({ lockedUntil, ...r }) => ({ ...r, locked: Boolean(lockedUntil && lockedUntil > now) }));
}

/** Active students per class, for the admin dashboard and teacher class picker. */
export async function classCounts(db: Database): Promise<Record<number, number>> {
  const rows = await db
    .select({ standard: students.standard, n: sql<number>`count(*)::int` })
    .from(students)
    .innerJoin(users, eq(users.id, students.userId))
    .where(eq(users.status, "active"))
    .groupBy(students.standard);
  return Object.fromEntries(rows.map((r) => [r.standard, r.n]));
}

export async function countUsers(db: Database, role?: Role): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(users)
    .where(role ? eq(users.role, role) : undefined);
  return row?.n ?? 0;
}

export type PromotionResult = { readonly academicYear: number; readonly promoted: number; readonly graduated: number };

/**
 * Moves every active student whose class is for an earlier academic year up by
 * the number of years missed. Anyone who goes past Class 12 is archived.
 * Safe to run every day: once a year is applied, nothing is left to move.
 */
export async function runPromotion(db: Database, now = new Date(), byUserId: string | null = null): Promise<PromotionResult> {
  const year = await currentAcademicYear(db, now);
  return db.transaction(async (tx) => {
    const due = await tx
      .select({ userId: students.userId, standard: students.standard, groupId: students.groupId, promotedForYear: students.promotedForYear })
      .from(students)
      .innerJoin(users, eq(users.id, students.userId))
      .where(and(eq(users.status, "active"), lt(students.promotedForYear, year)));
    if (due.length === 0) return { academicYear: year, promoted: 0, graduated: 0 };

    const changes = due.map((s) => {
      const to = s.standard + (year - s.promotedForYear);
      const graduated = to > 12;
      return {
        studentId: s.userId,
        fromStandard: s.standard,
        toStandard: graduated ? null : to,
        fromGroup: s.groupId,
        toGroup: graduated ? null : s.groupId,
        reason: graduated ? ("graduated" as const) : ("auto" as const),
        academicYear: year,
        byUserId,
        at: now,
      };
    });
    for (let i = 0; i < changes.length; i += 500) await tx.insert(classChanges).values(changes.slice(i, i + 500));

    const ids = due.map((s) => s.userId);
    const graduatedIds = changes.filter((c) => c.reason === "graduated").map((c) => c.studentId);
    for (let i = 0; i < ids.length; i += 1000) {
      await tx
        .update(students)
        .set({
          standard: sql`least(12, ${students.standard} + (${year} - ${students.promotedForYear}))`,
          promotedForYear: year,
        })
        .where(inArray(students.userId, ids.slice(i, i + 1000)));
    }
    if (graduatedIds.length) {
      await tx.update(users).set({ status: "archived" }).where(inArray(users.id, graduatedIds));
      await tx.delete(sessions).where(inArray(sessions.userId, graduatedIds));
    }
    const result = { academicYear: year, promoted: ids.length - graduatedIds.length, graduated: graduatedIds.length };
    await tx.insert(promotionRuns).values({ ...result, byUserId, ranAt: now });
    return result;
  });
}

export async function lastPromotionRun(db: Database) {
  const [row] = await db.select().from(promotionRuns).orderBy(desc(promotionRuns.ranAt)).limit(1);
  return row ?? null;
}

/** Students in Class 11–12 who still need a stream; their subject list shows everything until one is set. */
export async function studentsNeedingGroup(db: Database): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(students)
    .innerJoin(users, eq(users.id, students.userId))
    .where(and(eq(users.status, "active"), sql`${students.standard} >= 11`, sql`${students.groupId} is null`));
  return row?.n ?? 0;
}
