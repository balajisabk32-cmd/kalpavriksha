"use client";

import { useEffect, useSyncExternalStore } from "react";
import { getProgress, onProgressChange, updateProgress } from "@/components/progress-store";
import { EMPTY_PROGRESS, mergeProgress, parseProgress, type Profile, type Progress } from "@/lib/progress";

/** What `/api/auth/me` returns (mirrors `SessionUser` in src/server/auth/session.ts). */
export type ClientUser = {
  readonly id: string;
  readonly role: "admin" | "teacher" | "student";
  readonly username: string;
  readonly displayName: string;
  readonly student: { readonly standard: number; readonly medium: "en" | "ta"; readonly groupId: string | null } | null;
};

type State = { status: "loading" } | { status: "ready"; user: ClientUser } | { status: "signed-out" } | { status: "error" };

let state: State = { status: "loading" };
let request: Promise<void> | null = null;
const listeners = new Set<() => void>();

function set(next: State) {
  state = next;
  for (const l of listeners) l();
}

function load(): Promise<void> {
  request ??= fetch("/api/auth/me", { cache: "no-store" })
    .then(async (res) => {
      if (res.status === 401) return set({ status: "signed-out" });
      if (!res.ok) throw new Error(String(res.status));
      const { user } = (await res.json()) as { user: ClientUser };
      updateProgress((p) => withAccountProfile(p, user));
      set({ status: "ready", user });
      void startSync();
    })
    .catch(() => {
      request = null; // allow a retry
      set({ status: "error" });
    });
  return request;
}

/**
 * Makes this device's progress belong to the signed-in account. A different
 * account than last time starts fresh, so on a shared device one student never
 * sees another's XP or review list. A student's class and stream always come
 * from the server; staff keep the class they last browsed.
 */
export function withAccountProfile(p: Progress, user: ClientUser): Progress {
  const same = p.profile?.studentId === user.id;
  const base = same ? p : EMPTY_PROGRESS;
  const prev = same ? p.profile : null;
  const profile: Profile = {
    name: user.displayName,
    studentId: user.id,
    avatar: prev?.avatar ?? "bird",
    board: "tn_state",
    grade: user.student?.standard ?? prev?.grade ?? 10,
    seniorGroup: user.student ? (user.student.groupId ?? undefined) : prev?.seniorGroup,
    preferredLanguage: prev?.preferredLanguage,
    lastAccessed: prev?.lastAccessed,
  };
  if (
    same &&
    prev &&
    prev.name === profile.name &&
    prev.grade === profile.grade &&
    prev.seniorGroup === profile.seniorGroup &&
    prev.board === profile.board
  ) {
    return p;
  }
  return { ...base, profile };
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

const SERVER_STATE: State = { status: "loading" };

/**
 * The signed-in account. Loads once per page; signed-out visitors are sent to
 * the sign-in page and come back here afterwards.
 */
export function useSessionUser(): State & { retry: () => void } {
  const current = useSyncExternalStore(subscribe, () => state, () => SERVER_STATE);
  useEffect(() => {
    void load();
  }, []);
  useEffect(() => {
    if (current.status === "signed-out") {
      const next = `${window.location.pathname}${window.location.search}`;
      window.location.replace(`/sign-in?next=${encodeURIComponent(next)}`);
    }
  }, [current.status]);
  return { ...current, retry: () => void load() };
}

/** True for teachers and admins, who may browse any class. */
export function useIsStaff(): boolean {
  const s = useSyncExternalStore(subscribe, () => state, () => SERVER_STATE);
  return s.status === "ready" && s.user.role !== "student";
}

// --- Saving progress on the server -------------------------------------------

let syncing = false;
let timer: ReturnType<typeof setTimeout> | null = null;

function push(keepalive = false) {
  if (timer) clearTimeout(timer);
  timer = null;
  const body = JSON.stringify(getProgress());
  void fetch("/api/progress", { method: "PUT", body, keepalive: keepalive && body.length < 60_000, headers: { "Content-Type": "application/json" } }).catch(
    () => {
      // Offline: the device keeps its copy and sends it with the next change.
    },
  );
}

/**
 * Brings in what this account earned on other devices, then saves every change
 * here a few seconds after it happens (and when the page is closed).
 */
async function startSync() {
  if (syncing) return;
  syncing = true;
  try {
    const res = await fetch("/api/progress", { cache: "no-store" });
    if (res.ok) {
      const { progress } = (await res.json()) as { progress: unknown };
      if (progress) updateProgress((p) => mergeProgress(p, parseProgress(progress)));
    }
  } catch {
    // Offline: carry on with this device's copy.
  }
  push();
  onProgressChange(() => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(push, 3000);
  });
  window.addEventListener("pagehide", () => timer && push(true));
}
