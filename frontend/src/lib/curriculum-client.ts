"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import type { ChapterDetail, StandardOutline } from "@/lib/curriculum";

/**
 * Client access to the curriculum. The data is no longer bundled into the
 * browser JavaScript: class outlines (~15–75 KB) and single chapters (~2 KB)
 * are fetched from prerendered API routes on demand and kept in memory for the
 * visit, so each is downloaded at most once.
 */

export type Loadable<T> =
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly data: T }
  | { readonly status: "error" };

const LOADING: Loadable<never> = { status: "loading" };

const outlines = new Map<number, Loadable<StandardOutline>>();
const chapters = new Map<string, Loadable<ChapterDetail>>();
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function load<K, T>(cache: Map<K, Loadable<T>>, key: K, url: string): Promise<T | undefined> {
  const current = cache.get(key);
  if (current?.status === "ready") return Promise.resolve(current.data);
  if (current?.status === "loading") return Promise.resolve(undefined);
  cache.set(key, LOADING);
  emit();
  return fetch(url)
    .then((res) => (res.ok ? (res.json() as Promise<T>) : Promise.reject(new Error(String(res.status)))))
    .then((data) => {
      cache.set(key, { status: "ready", data });
      emit();
      return data;
    })
    .catch(() => {
      cache.set(key, { status: "error" });
      emit();
      return undefined;
    });
}

export function loadStandardOutline(standard: number) {
  return load(outlines, standard, `/api/curriculum/outline/${standard}`);
}

export function loadChapterDetail(chapterId: string) {
  return load(chapters, chapterId, `/api/curriculum/chapter/${encodeURIComponent(chapterId)}`);
}

/** Start downloading a chapter early (e.g. on hover), so opening it feels instant. */
export function prefetchChapter(chapterId: string) {
  void loadChapterDetail(chapterId);
}

/** Subjects and chapter list for one class. `null` standard → nothing loaded. */
export function useStandardOutline(standard: number | null | undefined): Loadable<StandardOutline> & {
  retry: () => void;
} {
  const entry = useSyncExternalStore(
    subscribe,
    () => (standard ? outlines.get(standard) : undefined),
    () => undefined,
  );
  useEffect(() => {
    if (standard) void loadStandardOutline(standard);
  }, [standard]);
  const retry = useCallback(() => {
    if (!standard) return;
    outlines.delete(standard);
    void loadStandardOutline(standard);
  }, [standard]);
  return { ...(entry ?? LOADING), retry };
}

/** One full chapter (lesson text, questions, resources). `null` id → nothing loaded. */
export function useChapterDetail(chapterId: string | null | undefined): Loadable<ChapterDetail> & {
  retry: () => void;
} {
  const entry = useSyncExternalStore(
    subscribe,
    () => (chapterId ? chapters.get(chapterId) : undefined),
    () => undefined,
  );
  useEffect(() => {
    if (chapterId) void loadChapterDetail(chapterId);
  }, [chapterId]);
  const retry = useCallback(() => {
    if (!chapterId) return;
    chapters.delete(chapterId);
    void loadChapterDetail(chapterId);
  }, [chapterId]);
  return { ...(entry ?? LOADING), retry };
}
