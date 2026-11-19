"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ErrorCode } from "@/modules/staff/copy";
import { requireUser } from "@/server/auth/current-user";
import {
  addChapterVideo,
  deleteVideo,
  getTextbook,
  planImport,
  removeTextbook,
  saveImport,
  setChapterPages,
  setUnitChapter,
  subjectsFor,
  type PlannedUnit,
} from "@/server/content";
import { getDb } from "@/server/db";
import { MEDIUMS, VIDEO_KINDS } from "@/server/db/schema";
import { InputError } from "@/server/people";
import { fileStore } from "@/server/storage";
import { parseVideoFile, type ImportIssue } from "@/server/video-import";

export type ContentState = { ok?: boolean; error?: ErrorCode };

function fail(err: unknown): ContentState {
  if (err instanceof InputError) return { error: err.code };
  console.error(err);
  return { error: "server" };
}

const text = (form: FormData, key: string) => {
  const v = form.get(key);
  return typeof v === "string" ? v : "";
};

export type VideoPreview = { units?: PlannedUnit[]; issues?: ImportIssue[]; fileName?: string; error?: "file" | "server" };

/** Step 1: read the sheet and suggest a chapter for every unit. Nothing is saved. */
export async function previewVideoImportAction(_prev: VideoPreview, form: FormData): Promise<VideoPreview> {
  await requireUser(["admin"], "/admin/content/import");
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0 || file.size > 10 * 1024 * 1024) return { error: "file" };
  const standard = Number(text(form, "standard")) || null;
  const medium = text(form, "medium") === "ta" ? "ta" : "en";
  try {
    const parsed = await parseVideoFile(await file.arrayBuffer(), { standard, medium, subjectsFor });
    return { units: await planImport(await getDb(), parsed.units), issues: parsed.issues, fileName: file.name };
  } catch (err) {
    console.error(err);
    return { error: "server" };
  }
}

const parsedUnit = z.object({
  standard: z.number().int().min(4).max(12),
  subjectId: z.string().max(60),
  subjectLabel: z.string().max(120),
  medium: z.enum(MEDIUMS),
  term: z.number().int().nullable(),
  unitNo: z.number().int().nullable(),
  title: z.string().max(300),
  sheet: z.string().max(120),
  row: z.number().int(),
  videos: z
    .array(
      z.object({
        kind: z.enum(VIDEO_KINDS),
        title: z.string().max(300),
        youtubeId: z.string().regex(/^[A-Za-z0-9_-]{11}$/).nullable(),
        playlistId: z.string().regex(/^[A-Za-z0-9_-]{10,64}$/).nullable(),
        note: z.string().max(500).nullable(),
      }),
    )
    .max(200),
});

/**
 * Step 2: save. The units come back from the page, so they are checked again and
 * their chapter links are worked out again here rather than trusted.
 */
export async function commitVideoImportAction(units: unknown, fileName: string): Promise<{ units: number; videos: number } | { error: ErrorCode }> {
  await requireUser(["admin"], "/admin/content/import");
  const parsed = z.array(parsedUnit).max(2000).safeParse(units);
  if (!parsed.success) return { error: "file" };
  try {
    const db = await getDb();
    const known = parsed.data.filter((u) => subjectsFor(u.standard).some((s) => s.id === u.subjectId));
    const planned = await planImport(db, known);
    const result = await saveImport(db, planned, String(fileName).slice(0, 120) || "sheet");
    revalidatePath("/admin/content", "layout");
    return result;
  } catch (err) {
    console.error(err);
    return { error: "server" };
  }
}

export async function setUnitChapterAction(_prev: ContentState, form: FormData): Promise<ContentState> {
  await requireUser(["admin"]);
  try {
    await setUnitChapter(await getDb(), Number(text(form, "unitId")), text(form, "chapterId") || null);
    revalidatePath("/admin/content", "layout");
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function addVideoAction(_prev: ContentState, form: FormData): Promise<ContentState> {
  await requireUser(["admin"]);
  try {
    await addChapterVideo(await getDb(), {
      chapterId: text(form, "chapterId"),
      medium: text(form, "medium") === "ta" ? "ta" : "en",
      url: text(form, "url"),
      kind: text(form, "kind") === "qa" ? "qa" : "lesson",
      title: text(form, "title") || null,
    });
    revalidatePath("/admin/content", "layout");
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function deleteVideoAction(_prev: ContentState, form: FormData): Promise<ContentState> {
  await requireUser(["admin"]);
  try {
    await deleteVideo(await getDb(), Number(text(form, "videoId")));
    revalidatePath("/admin/content", "layout");
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function deleteTextbookAction(_prev: ContentState, form: FormData): Promise<ContentState> {
  await requireUser(["admin"]);
  try {
    const db = await getDb();
    const key = await removeTextbook(db, Number(text(form, "textbookId")));
    if (key) await (await fileStore()).remove(key);
    revalidatePath("/admin/content", "layout");
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function setChapterPagesAction(_prev: ContentState, form: FormData): Promise<ContentState> {
  await requireUser(["admin"]);
  const num = (k: string) => (text(form, k).trim() ? Number(text(form, k)) : null);
  try {
    const db = await getDb();
    const textbookId = Number(text(form, "textbookId"));
    const previous = Number(text(form, "previousTextbookId"));
    // Switching to another book: clear the pages set on the old one.
    if (previous && previous !== textbookId && (await getTextbook(db, previous))) {
      await setChapterPages(db, text(form, "chapterId"), previous, null, null);
    }
    if (textbookId) await setChapterPages(db, text(form, "chapterId"), textbookId, num("startPage"), num("endPage"));
    revalidatePath("/admin/content", "layout");
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}
