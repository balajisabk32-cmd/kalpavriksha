import { sql } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createDatabase, type Database } from "./db/connect";
import {
  ExplanationError,
  explanationFor,
  explanationPrompt,
  explanationStatuses,
  parseExplanation,
  saveExplanation,
  setExplanationStatus,
} from "./explanations";

const SAMPLE = {
  summary: "Plants make their own food.",
  sections: [
    {
      heading: "Photosynthesis",
      explanation: "Leaves use sunlight, water and air to make food.",
      analogy: { title: "A kitchen", story: "A leaf is like a kitchen: sunlight is the stove, water and air are the ingredients." },
    },
  ],
  keyPoints: ["Leaves make food"],
  checkYourself: [{ question: "Where is food made?", answer: "In the leaves." }],
};

describe("reading Gemini's answer", () => {
  it("accepts plain JSON, fenced JSON and text around it", () => {
    expect(parseExplanation(JSON.stringify(SAMPLE)).ok).toBe(true);
    const fenced = parseExplanation("Here you go!\n```json\n" + JSON.stringify(SAMPLE, null, 2) + "\n```\nHope this helps.");
    expect(fenced.ok && fenced.data.words).toEqual([]);
  });

  it("fixes curly quotes and trailing commas", () => {
    const messy = '{“summary”: “ok”, “sections”: [{“heading”: “h”, “explanation”: “e”, “analogy”: {“title”: “t”, “story”: “s”},}], “keyPoints”: [“k”,],}';
    expect(parseExplanation(messy).ok).toBe(true);
  });

  it("says what is missing", () => {
    const r = parseExplanation(JSON.stringify({ ...SAMPLE, sections: [{ heading: "h", explanation: "e" }] }));
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toMatch(/sections\.0\.analogy/);
    expect(parseExplanation("sorry, I can't").ok).toBe(false);
  });
});

describe("prompt", () => {
  it("names the chapter, class, medium and pages", () => {
    const p = explanationPrompt("c4-science-ch1", "ta", { title: "Science T1", startPage: 3, endPage: 12 });
    expect(p).toContain("Class 4");
    expect(p).toContain("Tamil medium");
    expect(p).toContain("pages 3–12");
    expect(p).toContain('"analogy"');
  });
});

describe("saving and publishing", () => {
  let db: Database;
  beforeAll(async () => {
    db = await createDatabase({ dataDir: "memory" });
  }, 60_000);
  beforeEach(async () => {
    await db.execute(sql`truncate chapter_explanations`);
  });

  it("keeps drafts from students until published, and falls back to the other medium", async () => {
    await saveExplanation(db, { chapterId: "c4-science-ch1", medium: "en", raw: JSON.stringify(SAMPLE), userId: null });
    expect(await explanationFor(db, "c4-science-ch1", "ta")).toBeNull();
    expect((await explanationFor(db, "c4-science-ch1", "ta", true))?.status).toBe("draft");

    await setExplanationStatus(db, "c4-science-ch1", "en", "published");
    const seen = await explanationFor(db, "c4-science-ch1", "ta");
    expect(seen?.medium).toBe("en");
    expect(seen?.data.sections[0]!.analogy.title).toBe("A kitchen");
    expect(await explanationStatuses(db, "c4-science")).toEqual({ "c4-science-ch1": { en: "published" } });
  });

  it("replaces an explanation and refuses a broken one", async () => {
    await saveExplanation(db, { chapterId: "c4-science-ch1", medium: "en", raw: JSON.stringify(SAMPLE), publish: true, userId: null });
    await saveExplanation(db, { chapterId: "c4-science-ch1", medium: "en", raw: JSON.stringify({ ...SAMPLE, summary: "New" }), userId: null });
    const row = await explanationFor(db, "c4-science-ch1", "en", true);
    expect(row?.data.summary).toBe("New");
    expect(row?.status).toBe("draft");
    await expect(saveExplanation(db, { chapterId: "c4-science-ch1", medium: "en", raw: "{}", userId: null })).rejects.toBeInstanceOf(ExplanationError);
  });
});
