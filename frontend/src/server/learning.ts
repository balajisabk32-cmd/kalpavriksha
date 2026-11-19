/** What students have watched, and their saved progress (Phase 3). */
import { and, eq, inArray, sql } from "drizzle-orm";
import { parseProgress, type Progress } from "@/lib/progress";
import type { Database } from "./db/connect";
import { studentProgress, videos, videoViews } from "./db/schema";

/** A video counts as watched at 90 %. */
export const WATCHED_SHARE = 0.9;
const MAX_SECONDS = 6 * 60 * 60;

/** Records how far a student got in a video. Only ever moves forward. */
export async function recordVideoProgress(db: Database, userId: string, videoId: number, seconds: number, duration: number | null, now = new Date()) {
  if (!Number.isInteger(videoId) || videoId <= 0) return null;
  const s = Math.max(0, Math.min(MAX_SECONDS, Math.round(seconds)));
  const d = duration && duration > 0 ? Math.min(MAX_SECONDS, Math.round(duration)) : null;
  const [exists] = await db.select({ id: videos.id }).from(videos).where(eq(videos.id, videoId)).limit(1);
  if (!exists) return null;
  const completed = d !== null && s >= d * WATCHED_SHARE;
  const [row] = await db
    .insert(videoViews)
    .values({ userId, videoId, seconds: s, duration: d, completed, updatedAt: now })
    .onConflictDoUpdate({
      target: [videoViews.userId, videoViews.videoId],
      set: {
        seconds: sql`greatest(${videoViews.seconds}, ${s})`,
        duration: sql`coalesce(${d}, ${videoViews.duration})`,
        completed: sql`${videoViews.completed} or ${completed}`,
        updatedAt: now,
      },
    })
    .returning({ seconds: videoViews.seconds, completed: videoViews.completed });
  return row ?? null;
}

export async function watchedFor(db: Database, userId: string, videoIds: readonly number[]) {
  if (!videoIds.length) return {} as Record<number, { seconds: number; completed: boolean }>;
  const rows = await db
    .select({ videoId: videoViews.videoId, seconds: videoViews.seconds, completed: videoViews.completed })
    .from(videoViews)
    .where(and(eq(videoViews.userId, userId), inArray(videoViews.videoId, [...videoIds])));
  return Object.fromEntries(rows.map((r) => [r.videoId, { seconds: r.seconds, completed: r.completed }]));
}

export async function loadProgress(db: Database, userId: string): Promise<{ data: Progress; updatedAt: Date } | null> {
  const [row] = await db.select().from(studentProgress).where(eq(studentProgress.userId, userId)).limit(1);
  return row ? { data: parseProgress(row.data), updatedAt: row.updatedAt } : null;
}

/** Saves a student's progress after cleaning it with the same parser the app uses. */
export async function saveProgress(db: Database, userId: string, raw: unknown, now = new Date()): Promise<Progress> {
  const data = parseProgress(raw);
  await db
    .insert(studentProgress)
    .values({ userId, data, updatedAt: now })
    .onConflictDoUpdate({ target: studentProgress.userId, set: { data, updatedAt: now } });
  return data;
}
