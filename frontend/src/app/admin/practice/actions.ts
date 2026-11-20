"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/server/auth/current-user";
import { getDb } from "@/server/db";
import { InputError } from "@/server/people";
import { linkPracticeChapter, setSubjectPublished } from "@/server/practice";

export type PracticeActionResult = { ok: true } | { ok: false; error: string };

/** Shows (or hides) every exercise of one subject and medium to students. */
export async function publishPracticeAction(subjectId: string, medium: "en" | "ta" | null, published: boolean): Promise<PracticeActionResult> {
  await requireUser(["admin"]);
  await setSubjectPublished(await getDb(), String(subjectId), medium === "en" || medium === "ta" ? medium : null, Boolean(published));
  revalidatePath("/admin/practice", "layout");
  return { ok: true };
}

/** Links a textbook chapter's exercises to an app lesson (or unlinks with null). */
export async function linkPracticeAction(id: number, appChapterId: string | null): Promise<PracticeActionResult> {
  await requireUser(["admin"]);
  try {
    await linkPracticeChapter(await getDb(), Number(id), appChapterId || null);
    revalidatePath("/admin/practice", "layout");
    return { ok: true };
  } catch (err) {
    if (err instanceof InputError) return { ok: false, error: err.code };
    throw err;
  }
}
