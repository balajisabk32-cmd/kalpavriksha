import { describe, expect, it } from "vitest";
import {
  EMPTY_PROGRESS,
  MASTERED_BOX,
  XP,
  addDays,
  dueReviews,
  mistakes,
  parseProgress,
  recordAnswer,
  voteAnalogy,
} from "./progress";

const TODAY = "2026-11-15";
const q = (questionId: string, correct: boolean, fromReview = false) => ({
  questionId,
  chapterId: "c10-sci-ch1",
  correct,
  fromReview,
});

describe("addDays", () => {
  it("crosses month and year boundaries", () => {
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
});

describe("recordAnswer", () => {
  it("puts a first-time right answer in box 2, due in 3 days, outside the notebook", () => {
    const p = recordAnswer(EMPTY_PROGRESS, q("a", true), TODAY);
    expect(p.review.a).toMatchObject({ box: 2, due: "2026-11-18", lapses: 0, lastCorrect: true });
    expect(mistakes(p)).toEqual([]);
    expect(p.activeDays).toContain(TODAY);
  });

  it("puts a first-time wrong answer in box 1, due tomorrow, in the notebook", () => {
    const p = recordAnswer(EMPTY_PROGRESS, q("a", false), TODAY);
    expect(p.review.a).toMatchObject({ box: 1, due: "2026-11-16", lapses: 1, lastCorrect: false });
    expect(mistakes(p)).toEqual(["a"]);
  });

  it("climbs one box per right answer, resets to box 1 on a wrong one", () => {
    let p = recordAnswer(EMPTY_PROGRESS, q("a", true), TODAY); // box 2
    p = recordAnswer(p, q("a", true, true), TODAY); // box 3
    expect(p.review.a?.box).toBe(3);
    expect(p.review.a?.due).toBe(addDays(TODAY, 7));
    p = recordAnswer(p, q("a", false, true), TODAY);
    expect(p.review.a).toMatchObject({ box: 1, lapses: 1 });
  });

  it("leaves the mistake notebook once mastered", () => {
    let p = recordAnswer(EMPTY_PROGRESS, q("a", false), TODAY); // box 1
    p = recordAnswer(p, q("a", true, true), TODAY); // box 2
    expect(mistakes(p)).toEqual(["a"]);
    p = recordAnswer(p, q("a", true, true), TODAY); // box 3
    expect(p.review.a?.box).toBe(MASTERED_BOX);
    expect(mistakes(p)).toEqual([]);
  });

  it("caps at the top box", () => {
    let p = EMPTY_PROGRESS;
    for (let i = 0; i < 10; i++) p = recordAnswer(p, q("a", true, true), TODAY);
    expect(p.review.a?.box).toBe(5);
    expect(p.review.a?.due).toBe(addDays(TODAY, 30));
  });

  it("gives review XP only for right answers in a review session", () => {
    expect(recordAnswer(EMPTY_PROGRESS, q("a", true), TODAY).xp).toBe(0);
    expect(recordAnswer(EMPTY_PROGRESS, q("a", false, true), TODAY).xp).toBe(0);
    expect(recordAnswer(EMPTY_PROGRESS, q("a", true, true), TODAY).xp).toBe(XP.reviewCorrect);
  });
});

describe("dueReviews", () => {
  it("returns due questions, most overdue and weakest first, up to the limit", () => {
    let p = recordAnswer(EMPTY_PROGRESS, q("wrong-old", false), "2026-11-01");
    p = recordAnswer(p, q("right-old", true), "2026-11-01");
    p = recordAnswer(p, q("wrong-new", false), "2026-11-14");
    p = recordAnswer(p, q("not-due", true), TODAY);
    expect(dueReviews(p, TODAY)).toEqual(["wrong-old", "right-old", "wrong-new"]);
    expect(dueReviews(p, TODAY, 2)).toEqual(["wrong-old", "right-old"]);
  });
});

describe("voteAnalogy", () => {
  it("sets, changes and clears a vote", () => {
    let p = voteAnalogy(EMPTY_PROGRESS, "x", 1);
    expect(p.analogyVotes).toEqual({ x: 1 });
    p = voteAnalogy(p, "x", -1);
    expect(p.analogyVotes).toEqual({ x: -1 });
    expect(voteAnalogy(p, "x", null).analogyVotes).toEqual({});
  });
});

describe("parseProgress with review data", () => {
  it("keeps valid review items and votes, drops broken ones", () => {
    const p = parseProgress({
      ...EMPTY_PROGRESS,
      review: {
        good: { chapterId: "c", box: 9, due: TODAY, lapses: 2, lastCorrect: true },
        bad: { box: 1 },
      },
      analogyVotes: { a: 1, b: 5 },
    });
    expect(p.review).toEqual({ good: { chapterId: "c", box: 5, due: TODAY, lapses: 2, lastCorrect: true } });
    expect(p.analogyVotes).toEqual({ a: 1 });
  });

  it("upgrades progress saved before review existed", () => {
    const old = { version: 1, profile: null, xp: 40, lessonsDone: [], songsHeard: [], quizBest: 0, activities: [], activeDays: [] };
    const p = parseProgress(old);
    expect(p.xp).toBe(40);
    expect(p.review).toEqual({});
    expect(p.analogyVotes).toEqual({});
  });
});
