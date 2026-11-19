import { describe, expect, it } from "vitest";
import { EMPTY_PROGRESS, mergeProgress, type Progress } from "./progress";

const base = (over: Partial<Progress>): Progress => ({ ...EMPTY_PROGRESS, ...over });
const review = (due: string, box = 1) => ({ chapterId: "c7-science-ch1", box, due, lapses: 0, lastCorrect: true });

describe("mergeProgress", () => {
  it("keeps everything earned on either device", () => {
    const local = base({ xp: 40, lessonsDone: ["a", "b"], activeDays: ["2026-11-20"], review: { q1: review("2026-11-25", 2) } });
    const remote = base({ xp: 90, lessonsDone: ["b", "c"], activeDays: ["2026-11-18"], quizBest: 80, review: { q1: review("2026-11-21"), q2: review("2026-11-22") } });
    const merged = mergeProgress(local, remote);
    expect(merged.xp).toBe(90);
    expect(merged.quizBest).toBe(80);
    expect([...merged.lessonsDone].sort()).toEqual(["a", "b", "c"]);
    expect(merged.activeDays).toEqual(["2026-11-18", "2026-11-20"]);
    expect(merged.review.q1).toEqual(review("2026-11-25", 2)); // this device's answer wins
    expect(merged.review.q2).toBeDefined();
  });

  it("a new device takes everything from the server", () => {
    const remote = base({ xp: 120, lessonsDone: ["x"] });
    expect(mergeProgress(EMPTY_PROGRESS, remote)).toMatchObject({ xp: 120, lessonsDone: ["x"] });
  });
});
