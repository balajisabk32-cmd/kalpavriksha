import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createDatabase, type Database } from "./db/connect";
import { createStudent } from "./people";
import { placeItem, practiceForSubject, savePracticeSet, setProgress, setSubjectPublished, type StoredSet } from "./practice";
import { buildQuiz, mcqExplanation, quizSize, quizStats, submitQuiz } from "./quiz";
import { fileStore } from "./storage";

const placed = placeItem({
  class_num: 10,
  subject: "maths",
  chapter: "Chapter 1: Relations and Functions",
  chapter_folder: "chapter-01-relations-and-functions",
  file_name: "exercise-1.1.md",
  relative_path: "class-10/english-medium/maths/chapter-01-relations-and-functions/exercise-1.1.md",
  medium: "english-medium",
  term: null,
  status: "done",
} as never);

const mcq = (n: number) => ({ label: String(n), q: `Question ${n}?`, a: `(b) right\nExplanation: because ${n}`, mcq: { options: [{ key: "a", text: "x" }, { key: "b", text: "y" }, { key: "c", text: "z" }], answer: "b" } });
const body: StoredSet = {
  title: "Exercise 1.6",
  sections: [
    { title: "Sums", items: [{ label: "1", q: "Prove it", a: "Proof" }] },
    { title: "Choose", items: Array.from({ length: 12 }, (_, i) => mcq(i + 1)).concat([mcq(1)]) }, // one duplicate
  ],
};

describe("chapter quizzes", () => {
  let db: Database;
  const key = `practice/sets/test-quiz-${randomUUID()}.json`;
  beforeAll(async () => {
    db = await createDatabase({ dataDir: "memory" });
    await (await fileStore()).put(key, new TextEncoder().encode(JSON.stringify(body)), "application/json");
  }, 60_000);
  afterAll(async () => {
    await (await fileStore()).remove(key);
  });
  beforeEach(async () => {
    await db.execute(sql`truncate practice_chapters, practice_sets, practice_progress, quiz_attempts, users restart identity cascade`);
    await savePracticeSet(db, { placed: placed as never, appChapterId: "c10-math-ch1", kind: "exercise", number: "1.6", title: "Exercise 1.6", itemCount: 14, mcqCount: 13, storageKey: key, contentHash: "h", sourcePath: "x/1.6.md" });
  });

  it("reads the explanation after the option line", () => {
    expect(mcqExplanation("(b) right\nExplanation: because")).toBe("because");
    expect(mcqExplanation("(a)")).toBe("");
  });

  it("only offers published exercises to students, 10 unique questions at a time", async () => {
    const { userId } = await createStudent(db, { displayName: "Ravi", standard: 10, medium: "en" }, null);
    const o = { chapterId: "c10-math-ch1", medium: "en" as const, userId, drafts: false };
    expect(await quizSize(db, o)).toBe(0);
    await setSubjectPublished(db, "c10-math", "en", true);
    expect(await quizSize(db, o)).toBe(13);
    const quiz = await buildQuiz(db, o);
    expect(quiz).toHaveLength(10);
    expect(new Set(quiz.map((q) => q.q)).size).toBe(10);
    expect(quiz.every((q) => q.item >= 1 && q.answer === "b")).toBe(true); // item 0 is the proof, not an MCQ
  });

  it("scores on the server, saves the attempt and marks practice", async () => {
    const { userId } = await createStudent(db, { displayName: "Ravi", standard: 10, medium: "en" }, null);
    await setSubjectPublished(db, "c10-math", "en", true);
    const o = { chapterId: "c10-math-ch1", medium: "en" as const, userId, drafts: false };
    const [ch] = await practiceForSubject(db, { subjectId: "c10-math", medium: "en", userId, drafts: false });
    const setId = ch!.sets[0]!.id;
    const res = await submitQuiz(db, {
      ...o,
      answers: [
        { setId, item: 1, key: "b" },
        { setId, item: 2, key: "a" },
        { setId, item: 2, key: "b" }, // repeated: ignored
        { setId, item: 0, key: "b" }, // not an MCQ: ignored
        { setId: setId + 99, item: 1, key: "b" }, // another chapter's set: ignored
      ],
    });
    expect(res).toMatchObject({ correct: 1, total: 2, stats: { attempts: 1, best: 50, last: { correct: 1, total: 2 } } });
    expect(await setProgress(db, userId, setId)).toEqual({ 1: "right", 2: "wrong" });
    await submitQuiz(db, { ...o, answers: [{ setId, item: 3, key: "b" }] });
    expect(await quizStats(db, userId, "c10-math-ch1")).toEqual({ attempts: 2, best: 100, last: { correct: 1, total: 1 } });
  });
});
