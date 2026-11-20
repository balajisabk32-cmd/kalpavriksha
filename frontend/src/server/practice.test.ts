import { sql } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createStudent } from "./people";
import { createDatabase, type Database } from "./db/connect";
import { linkPracticeChapter, matchAppChapter, placeItem, practiceForSubject, practiceSubjects, recordPractice, savePracticeSet, setSubjectPublished } from "./practice";

const item = (over: Record<string, unknown> = {}) => ({
  class_num: 10,
  subject: "maths",
  chapter: "Chapter 1: Relations and Functions",
  chapter_folder: "chapter-01-relations-and-functions",
  file_name: "exercise-1.1.md",
  relative_path: "class-10/english-medium/maths/chapter-01-relations-and-functions/exercise-1.1.md",
  medium: "english-medium",
  term: null,
  status: "done",
  ...over,
});

describe("placing content", () => {
  it("maps folders to app subjects, mediums and chapters", () => {
    const p = placeItem(item());
    expect(p).toMatchObject({ subjectId: "c10-math", medium: "en", term: null, number: 1, title: "Relations and Functions", book: null });
    expect(matchAppChapter(p as never)).toBe("c10-math-ch1");
  });

  it("gives Tamil and English one language, and keeps Bio-Botany apart", () => {
    expect(placeItem(item({ subject: "tamil", medium: null, chapter: "Chapter 1: 1 அன்னை மொழியை", chapter_folder: null, file_name: "chapter-01-1-annai.md" }))).toMatchObject({ subjectId: "c10-tamil", medium: null, number: 1 });
    expect(placeItem(item({ class_num: 11, subject: "bio-botany", chapter: "Chapter 3: Vegetative Morphology", chapter_folder: null, file_name: "chapter-03-vegetative-morphology.md" }))).toMatchObject({ subjectId: "c11-biology", book: "Bio-Botany" });
    expect(placeItem(item({ class_num: 11, subject: "social-science" }))).toEqual({ skip: "no c11-social in the app" });
  });

  it("links term-based chapters by term and number", () => {
    const p = placeItem(item({ class_num: 4, term: "term-2", chapter: "Chapter 1: Multiplication", chapter_folder: "chapter-01-multiplication" }));
    expect(matchAppChapter(p as never)).toBe("c4-math-ch3"); // "Term 2 - Ch 1"
  });
});

describe("saving and progress", () => {
  let db: Database;
  beforeAll(async () => {
    db = await createDatabase({ dataDir: "memory" });
  }, 60_000);
  beforeEach(async () => {
    await db.execute(sql`truncate practice_chapters, practice_sets, practice_progress, users restart identity cascade`);
  });

  const save = (number: string, kind: "exercise" | "bookback" = "exercise") =>
    savePracticeSet(db, {
      placed: placeItem(item()) as never,
      appChapterId: "c10-math-ch1",
      kind,
      number,
      title: `Exercise ${number}`,
      itemCount: 3,
      mcqCount: 0,
      storageKey: `practice/sets/${number}.json`,
      contentHash: "h",
      sourcePath: `x/exercise-${number}.md`,
    });

  it("lists exercises in textbook order, only once published for students", async () => {
    await save("1.10");
    await save("1.2");
    const { userId } = await createStudent(db, { displayName: "Ravi", standard: 10, medium: "en" }, null);
    expect(await practiceForSubject(db, { subjectId: "c10-math", medium: "en", userId, drafts: false })).toEqual([]);
    await setSubjectPublished(db, "c10-math", "en", true);
    const [ch] = await practiceForSubject(db, { subjectId: "c10-math", medium: "en", userId, drafts: false });
    expect(ch!.sets.map((s) => s.number)).toEqual(["1.2", "1.10"]);

    await recordPractice(db, userId, ch!.sets[0]!.id, 0, "done");
    await recordPractice(db, userId, ch!.sets[0]!.id, 1, "help");
    await recordPractice(db, userId, ch!.sets[0]!.id, 1, "done");
    await expect(recordPractice(db, userId, ch!.sets[0]!.id, 9, "done")).rejects.toMatchObject({ code: "not_found" });
    const [again] = await practiceForSubject(db, { subjectId: "c10-math", medium: "en", userId, drafts: false, appChapterId: "c10-math-ch1" });
    expect(again!.sets[0]).toMatchObject({ done: 2, help: 0 });
    expect(await practiceSubjects(db, { standard: 10, medium: "en", userId, drafts: false })).toMatchObject([{ subjectId: "c10-math", items: 6, done: 2 }]);
  });

  it("keeps a link set by hand when the content is imported again", async () => {
    const id = await save("1.1");
    await linkPracticeChapter(db, id, "c10-math-ch2");
    await save("1.1");
    const [ch] = await practiceForSubject(db, { subjectId: "c10-math", medium: "en", userId: "00000000-0000-0000-0000-000000000000", drafts: true });
    expect(ch!.appChapterId).toBe("c10-math-ch2");
    await expect(linkPracticeChapter(db, id, "c9-math-ch1")).rejects.toMatchObject({ code: "not_found" });
  });
});
