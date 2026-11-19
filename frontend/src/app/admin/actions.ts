"use server";

import { inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ErrorCode } from "@/modules/staff/copy";
import { requireUser } from "@/server/auth/current-user";
import { getDb } from "@/server/db";
import { MEDIUMS, users } from "@/server/db/schema";
import {
  changeClass,
  createStaff,
  createStudent,
  InputError,
  resetPassword,
  runPromotion,
  setArchived,
  setPromotionDate,
  updateStudentDetails,
  type PromotionResult,
} from "@/server/people";
import { markTaken, parseStudentFile, type ImportRow } from "@/server/student-import";

export type Login = { username: string; password: string; displayName: string; standard?: number; role?: string };
export type FormState = { error?: ErrorCode; ok?: boolean; login?: Login; password?: string; promotion?: PromotionResult };

const uuid = z.uuid();

function fail(err: unknown): FormState {
  if (err instanceof InputError) return { error: err.code };
  console.error(err);
  return { error: "server" };
}

const text = (form: FormData, key: string) => {
  const v = form.get(key);
  return typeof v === "string" ? v : "";
};

export async function createStudentAction(_prev: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser(["admin"], "/admin/students/new");
  try {
    const login = await createStudent(
      await getDb(),
      {
        displayName: text(form, "displayName"),
        standard: Number(text(form, "standard")),
        medium: (MEDIUMS as readonly string[]).includes(text(form, "medium")) ? (text(form, "medium") as "en" | "ta") : "en",
        groupId: text(form, "groupId") || null,
        section: text(form, "section") || null,
        username: text(form, "username") || null,
        password: text(form, "password") || null,
      },
      me.id,
    );
    revalidatePath("/admin", "layout");
    return { ok: true, login };
  } catch (err) {
    return fail(err);
  }
}

export type PreviewState = { error?: "bad_file" | "no_name" | "too_many" | "server"; rows?: ImportRow[]; fileName?: string };

/** Step 1 of an import: read the file and show what will happen. Nothing is created. */
export async function previewImportAction(_prev: PreviewState, form: FormData): Promise<PreviewState> {
  await requireUser(["admin"], "/admin/students/import");
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "bad_file" };
  if (file.size > 5 * 1024 * 1024) return { error: "too_many" };
  try {
    const parsed = await parseStudentFile(await file.arrayBuffer(), file.name);
    if (!parsed.ok) return { error: parsed.error };
    const wanted = parsed.rows.flatMap((r) => (r.username ? [r.username] : []));
    const db = await getDb();
    const taken = wanted.length
      ? new Set((await db.select({ u: users.username }).from(users).where(inArray(users.username, wanted))).map((r) => r.u))
      : new Set<string>();
    return { rows: markTaken(parsed.rows, taken), fileName: file.name };
  } catch (err) {
    console.error(err);
    return { error: "server" };
  }
}

const importRow = z.object({
  row: z.number().int(),
  displayName: z.string(),
  standard: z.number().int(),
  medium: z.enum(MEDIUMS),
  groupId: z.string().nullable(),
  section: z.string().nullable(),
  username: z.string().nullable(),
  password: z.string().nullable(),
});

/**
 * Step 2: create the checked rows. The page sends them in batches of 50 so each
 * request stays short; every row is checked again here.
 */
export async function commitImportAction(
  rows: unknown,
): Promise<{ logins: (Login & { row: number })[]; failed: { row: number; error: ErrorCode }[] }> {
  const me = await requireUser(["admin"], "/admin/students/import");
  const parsed = z.array(importRow).max(50).parse(rows);
  const db = await getDb();
  const logins: (Login & { row: number })[] = [];
  const failed: { row: number; error: ErrorCode }[] = [];
  // A few at a time: password hashing runs on Node's thread pool.
  for (let i = 0; i < parsed.length; i += 4) {
    await Promise.all(
      parsed.slice(i, i + 4).map(async (r) => {
        try {
          const login = await createStudent(db, r, me.id);
          logins.push({ ...login, row: r.row });
        } catch (err) {
          failed.push({ row: r.row, error: err instanceof InputError ? err.code : "server" });
          if (!(err instanceof InputError)) console.error(err);
        }
      }),
    );
  }
  revalidatePath("/admin", "layout");
  logins.sort((a, b) => a.row - b.row);
  return { logins, failed };
}

export async function changeClassAction(_prev: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser(["admin"]);
  const id = uuid.safeParse(text(form, "id"));
  if (!id.success) return { error: "not_found" };
  try {
    await changeClass(await getDb(), id.data, { standard: Number(text(form, "standard")), groupId: text(form, "groupId") || null }, me.id);
    revalidatePath("/admin", "layout");
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function updateDetailsAction(_prev: FormState, form: FormData): Promise<FormState> {
  await requireUser(["admin"]);
  const id = uuid.safeParse(text(form, "id"));
  if (!id.success) return { error: "not_found" };
  try {
    await updateStudentDetails(await getDb(), id.data, {
      displayName: text(form, "displayName"),
      medium: text(form, "medium") as "en" | "ta",
      section: text(form, "section") || null,
    });
    revalidatePath("/admin", "layout");
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function resetPasswordAction(_prev: FormState, form: FormData): Promise<FormState> {
  await requireUser(["admin"]);
  const id = uuid.safeParse(text(form, "id"));
  if (!id.success) return { error: "not_found" };
  try {
    const password = await resetPassword(await getDb(), id.data);
    revalidatePath("/admin", "layout");
    return { ok: true, password };
  } catch (err) {
    return fail(err);
  }
}

export async function setArchivedAction(_prev: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser(["admin"]);
  const id = uuid.safeParse(text(form, "id"));
  if (!id.success) return { error: "not_found" };
  try {
    await setArchived(await getDb(), id.data, text(form, "archived") === "true", me.id);
    revalidatePath("/admin", "layout");
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function createStaffAction(_prev: FormState, form: FormData): Promise<FormState> {
  await requireUser(["admin"], "/admin/staff");
  try {
    const login = await createStaff(await getDb(), {
      role: text(form, "role") === "admin" ? "admin" : "teacher",
      displayName: text(form, "displayName"),
      username: text(form, "username"),
      password: text(form, "password") || null,
    });
    revalidatePath("/admin/staff");
    return { ok: true, login };
  } catch (err) {
    return fail(err);
  }
}

export async function setPromotionDateAction(_prev: FormState, form: FormData): Promise<FormState> {
  await requireUser(["admin"], "/admin/settings");
  try {
    await setPromotionDate(await getDb(), { month: Number(text(form, "month")), day: Number(text(form, "day")) });
    revalidatePath("/admin", "layout");
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function runPromotionAction(): Promise<FormState> {
  const me = await requireUser(["admin"], "/admin/settings");
  try {
    const promotion = await runPromotion(await getDb(), new Date(), me.id);
    revalidatePath("/admin", "layout");
    return { ok: true, promotion };
  } catch (err) {
    return fail(err);
  }
}
