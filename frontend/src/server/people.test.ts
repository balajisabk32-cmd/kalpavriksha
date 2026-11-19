import { sql } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { academicYearOf, academicYearLabel } from "./academic-year";
import { hashPassword, studentPassword, verifyPassword } from "./auth/password";
import { authenticate, createSession, deleteSession, liveSessionCount, LOCK_MINUTES, MAX_FAILED_LOGINS, validateSessionToken } from "./auth/session";
import { createDatabase, type Database } from "./db/connect";
import {
  changeClass,
  createStaff,
  createStudent,
  getStudent,
  InputError,
  listStudents,
  resetPassword,
  runPromotion,
  setArchived,
  setPromotionDate,
} from "./people";

// 10 Nov 2026, India time: academic year 2026–27.
const NOV_2026 = new Date("2026-11-10T06:00:00Z");

let db: Database;
beforeAll(async () => {
  db = await createDatabase({ dataDir: "memory" });
}, 60_000);
beforeEach(async () => {
  await db.execute(sql`truncate users, settings, promotion_runs restart identity cascade`);
});

describe("academic year", () => {
  it("changes on 1 June, India time", () => {
    expect(academicYearOf(new Date("2027-05-31T18:00:00Z"))).toBe(2026); // 31 May 23:30 IST
    expect(academicYearOf(new Date("2027-05-31T18:30:00Z"))).toBe(2027); // 1 June 00:00 IST
    expect(academicYearOf(new Date("2027-01-15T00:00:00Z"))).toBe(2026);
    expect(academicYearLabel(2026)).toBe("2026–27");
  });
});

describe("passwords", () => {
  it("hashes and verifies; rejects the wrong one", async () => {
    const hash = await hashPassword("lotus4827");
    expect(hash).not.toContain("lotus4827");
    expect(await verifyPassword("lotus4827", hash)).toBe(true);
    expect(await verifyPassword("lotus4828", hash)).toBe(false);
  });

  it("generates easy student passwords", () => {
    expect(studentPassword()).toMatch(/^[a-z]+\d{4}$/);
  });
});

describe("students", () => {
  it("creates a student with a generated login that works", async () => {
    const login = await createStudent(db, { displayName: "Priya Devi", standard: 7, medium: "ta" }, null, NOV_2026);
    expect(login.username).toMatch(/^priya\.\d{4}$/);
    const auth = await authenticate(db, login.username.toUpperCase(), login.password, NOV_2026);
    expect(auth).toMatchObject({ ok: true, role: "student" });
    const student = await getStudent(db, login.userId);
    expect(student).toMatchObject({ standard: 7, medium: "ta", status: "active" });
    expect(student!.history[0]).toMatchObject({ reason: "created", toStandard: 7, academicYear: 2026 });
  });

  it("gives Tamil-script names a 'student.NNNN' username", async () => {
    const login = await createStudent(db, { displayName: "கவின்", standard: 5 }, null, NOV_2026);
    expect(login.username).toMatch(/^student\.\d{4}$/);
  });

  it("refuses classes outside 4–12, taken usernames and unknown streams", async () => {
    await expect(createStudent(db, { displayName: "A", standard: 3 }, null)).rejects.toMatchObject({ code: "standard" });
    await createStudent(db, { displayName: "A", standard: 4, username: "arun" }, null);
    await expect(createStudent(db, { displayName: "B", standard: 4, username: "ARUN" }, null)).rejects.toMatchObject({
      code: "username_taken",
    });
    await expect(createStudent(db, { displayName: "C", standard: 11, groupId: "art" }, null)).rejects.toBeInstanceOf(InputError);
  });

  it("drops a stream below Class 11 and keeps it for 11–12", async () => {
    const low = await createStudent(db, { displayName: "Low", standard: 9, groupId: "cs" }, null);
    expect((await getStudent(db, low.userId))!.groupId).toBeNull();
    const high = await createStudent(db, { displayName: "High", standard: 11, groupId: "cs" }, null);
    expect((await getStudent(db, high.userId))!.groupId).toBe("cs");
  });

  it("changes class and records who did it", async () => {
    const admin = await createStaff(db, { role: "admin", displayName: "Head", username: "head" });
    const s = await createStudent(db, { displayName: "Ravi", standard: 10 }, admin.userId, NOV_2026);
    await changeClass(db, s.userId, { standard: 11, groupId: "commerce" }, admin.userId, NOV_2026);
    const after = await getStudent(db, s.userId);
    expect(after).toMatchObject({ standard: 11, groupId: "commerce" });
    expect(after!.history[0]).toMatchObject({ reason: "admin", fromStandard: 10, toStandard: 11, byName: "Head" });
  });

  it("filters the list by class and search text", async () => {
    await createStudent(db, { displayName: "Anu", standard: 6 }, null);
    await createStudent(db, { displayName: "Bala", standard: 6 }, null);
    await createStudent(db, { displayName: "Chitra", standard: 8 }, null);
    expect((await listStudents(db, { standard: 6 })).map((s) => s.displayName)).toEqual(["Anu", "Bala"]);
    expect((await listStudents(db, { q: "chi" })).map((s) => s.displayName)).toEqual(["Chitra"]);
  });
});

describe("sign-in and sessions", () => {
  it("issues a session that resolves to the student and their class", async () => {
    const s = await createStudent(db, { displayName: "Meena", standard: 8, medium: "ta" }, null, NOV_2026);
    const { token } = await createSession(db, s.userId, "student", NOV_2026);
    const user = await validateSessionToken(db, token, NOV_2026);
    expect(user).toMatchObject({ role: "student", displayName: "Meena", student: { standard: 8, medium: "ta" } });
    await deleteSession(db, token);
    expect(await validateSessionToken(db, token, NOV_2026)).toBeNull();
  });

  it("expires student sessions after 30 days", async () => {
    const s = await createStudent(db, { displayName: "Meena", standard: 8 }, null, NOV_2026);
    const { token } = await createSession(db, s.userId, "student", NOV_2026);
    expect(await validateSessionToken(db, token, new Date(NOV_2026.getTime() + 29 * 86_400_000))).not.toBeNull();
    expect(await validateSessionToken(db, token, new Date(NOV_2026.getTime() + 31 * 86_400_000))).toBeNull();
  });

  it("locks the account after repeated wrong passwords, then unlocks", async () => {
    const s = await createStudent(db, { displayName: "Kumar", standard: 9, password: "mango1234" }, null, NOV_2026);
    for (let i = 0; i < MAX_FAILED_LOGINS - 1; i++) {
      expect(await authenticate(db, s.username, "wrong", NOV_2026)).toMatchObject({ ok: false, reason: "invalid" });
    }
    expect(await authenticate(db, s.username, "wrong", NOV_2026)).toMatchObject({ ok: false, reason: "locked" });
    expect(await authenticate(db, s.username, "mango1234", NOV_2026)).toMatchObject({ ok: false, reason: "locked" });
    const later = new Date(NOV_2026.getTime() + (LOCK_MINUTES + 1) * 60_000);
    expect(await authenticate(db, s.username, "mango1234", later)).toMatchObject({ ok: true });
  });

  it("rejects unknown usernames like wrong passwords", async () => {
    expect(await authenticate(db, "nobody", "whatever")).toEqual({ ok: false, reason: "invalid" });
  });

  it("password reset signs the student out and the new password works", async () => {
    const s = await createStudent(db, { displayName: "Divya", standard: 5 }, null, NOV_2026);
    const { token } = await createSession(db, s.userId, "student", NOV_2026);
    const fresh = await resetPassword(db, s.userId);
    expect(await validateSessionToken(db, token, NOV_2026)).toBeNull();
    expect(await authenticate(db, s.username, s.password, NOV_2026)).toMatchObject({ ok: false });
    expect(await authenticate(db, s.username, fresh, NOV_2026)).toMatchObject({ ok: true });
  });

  it("archived accounts can't sign in or keep a session; restoring brings them back", async () => {
    const s = await createStudent(db, { displayName: "Gopi", standard: 6 }, null, NOV_2026);
    const { token } = await createSession(db, s.userId, "student", NOV_2026);
    await setArchived(db, s.userId, true, null, NOV_2026);
    expect(await liveSessionCount(db, s.userId, NOV_2026)).toBe(0);
    expect(await validateSessionToken(db, token, NOV_2026)).toBeNull();
    expect(await authenticate(db, s.username, s.password, NOV_2026)).toMatchObject({ ok: false, reason: "archived" });
    await setArchived(db, s.userId, false, null, NOV_2026);
    expect(await authenticate(db, s.username, s.password, NOV_2026)).toMatchObject({ ok: true });
  });

  it("won't archive the last admin", async () => {
    const a = await createStaff(db, { role: "admin", displayName: "Only", username: "only" });
    await expect(setArchived(db, a.userId, true, null)).rejects.toMatchObject({ code: "last_admin" });
  });

  it("asks staff for longer passwords", async () => {
    await expect(createStaff(db, { role: "teacher", displayName: "T", username: "tchr", password: "short" })).rejects.toMatchObject({
      code: "password_short",
    });
    const t = await createStaff(db, { role: "teacher", displayName: "T", username: "tchr" });
    expect(t.password.length).toBeGreaterThanOrEqual(10);
  });
});

describe("yearly promotion", () => {
  it("moves everyone up on 1 June and archives Class 12 leavers, once", async () => {
    const four = await createStudent(db, { displayName: "Four", standard: 4 }, null, NOV_2026);
    const ten = await createStudent(db, { displayName: "Ten", standard: 10 }, null, NOV_2026);
    const twelve = await createStudent(db, { displayName: "Twelve", standard: 12, groupId: "cs" }, null, NOV_2026);
    const { token } = await createSession(db, twelve.userId, "student", NOV_2026);

    // Still 2026–27 on 31 May 2027: nothing moves.
    expect(await runPromotion(db, new Date("2027-05-31T10:00:00Z"))).toMatchObject({ promoted: 0, graduated: 0 });

    const june = new Date("2027-06-01T03:00:00Z");
    expect(await runPromotion(db, june)).toEqual({ academicYear: 2027, promoted: 2, graduated: 1 });
    expect((await getStudent(db, four.userId))!.standard).toBe(5);
    const tenNow = (await getStudent(db, ten.userId))!;
    expect(tenNow).toMatchObject({ standard: 11, groupId: null }); // stream to be chosen
    expect(tenNow.history[0]).toMatchObject({ reason: "auto", fromStandard: 10, toStandard: 11 });
    const leaver = (await getStudent(db, twelve.userId))!;
    expect(leaver).toMatchObject({ status: "archived", standard: 12 });
    expect(leaver.history[0]).toMatchObject({ reason: "graduated" });
    expect(await validateSessionToken(db, token, june)).toBeNull();

    // Running again the same year (the cron runs daily) changes nothing.
    expect(await runPromotion(db, new Date("2027-06-02T03:00:00Z"))).toMatchObject({ promoted: 0, graduated: 0 });
    expect((await getStudent(db, four.userId))!.standard).toBe(5);
  });

  it("catches up if a year was missed", async () => {
    const s = await createStudent(db, { displayName: "Late", standard: 6 }, null, NOV_2026);
    await runPromotion(db, new Date("2028-07-01T00:00:00Z"));
    expect((await getStudent(db, s.userId))!.standard).toBe(8);
  });

  it("uses the date the admin set", async () => {
    await setPromotionDate(db, { month: 4, day: 15 });
    const s = await createStudent(db, { displayName: "April", standard: 7 }, null, new Date("2026-11-10T00:00:00Z"));
    await runPromotion(db, new Date("2027-04-15T00:00:00Z"));
    expect((await getStudent(db, s.userId))!.standard).toBe(8);
  });

  it("does not move archived students, and a restored student keeps their class", async () => {
    const s = await createStudent(db, { displayName: "Away", standard: 7 }, null, NOV_2026);
    await setArchived(db, s.userId, true, null, NOV_2026);
    await runPromotion(db, new Date("2027-06-05T00:00:00Z"));
    expect((await getStudent(db, s.userId))!.standard).toBe(7);
    await setArchived(db, s.userId, false, null, new Date("2027-06-10T00:00:00Z"));
    await runPromotion(db, new Date("2027-06-11T00:00:00Z"));
    expect((await getStudent(db, s.userId))!.standard).toBe(7);
  });
});
