import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { GET as getChapter } from "@/app/api/curriculum/chapter/[chapterId]/route";
import { GET as getOutline } from "@/app/api/curriculum/outline/[standard]/route";
import { SUPPORTED_STANDARDS } from "./curriculum";
import { allChapterIds, getChapterDetail, getStandardOutline, getSubjectsForStandard } from "./curriculum-data";

const SRC = path.resolve(__dirname, "..");
/** An actual import/re-export of the dataset module (comments mentioning it are fine). */
const IMPORTS_DATA = /(?:from|import)\s*\(?\s*["'][^"']*curriculum-data["']/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [full] : [];
  });
}

describe("curriculum stays out of the browser bundle", () => {
  it("no client component imports the full dataset", () => {
    const offenders = sourceFiles(SRC).filter((file) => {
      const text = readFileSync(file, "utf8");
      return /^["']use client["']/.test(text.trimStart()) && IMPORTS_DATA.test(text);
    });
    expect(offenders.map((f) => path.relative(SRC, f))).toEqual([]);
  });

  it("the light module (imported by client code) does not pull the dataset in", () => {
    expect(readFileSync(path.join(SRC, "lib/curriculum.ts"), "utf8")).not.toMatch(IMPORTS_DATA);
  });
});

describe("curriculum outline", () => {
  it("keeps every subject and chapter but drops lesson text, questions and resources", () => {
    for (const standard of SUPPORTED_STANDARDS) {
      const outline = getStandardOutline(standard)!;
      const full = getSubjectsForStandard(standard);
      expect(outline.subjects.map((s) => s.id)).toEqual(full.map((s) => s.id));
      outline.subjects.forEach((subject, i) => {
        expect(subject.chapters.map((c) => c.id)).toEqual(full[i]!.chapters.map((c) => c.id));
        for (const chapter of subject.chapters) {
          expect(chapter).not.toHaveProperty("lessonLines");
          expect(chapter).not.toHaveProperty("practiceQuestions");
          expect(chapter).not.toHaveProperty("resources");
        }
      });
    }
  });

  it("counts questions so lists can show them without loading the chapter", () => {
    const sci = getStandardOutline(10)!.subjects.find((s) => s.id === "c10-science")!;
    const ch4 = sci.chapters.find((c) => c.id === "c10-science-ch4")!;
    expect(ch4.questionCount).toBe(getChapterDetail("c10-science-ch4")!.chapter.practiceQuestions?.length ?? 0);
  });
});

describe("chapter detail", () => {
  it("finds every chapter with its class and subject", () => {
    const ids = allChapterIds();
    expect(ids.length).toBeGreaterThan(600);
    for (const id of ids) {
      const detail = getChapterDetail(id)!;
      expect(detail.chapter.id).toBe(id);
      expect(id.startsWith(`c${detail.standard}-`)).toBe(true);
      expect(detail.subject).not.toHaveProperty("chapters");
    }
  });
});

describe("curriculum API routes", () => {
  const ctx = <T,>(params: T) => ({ params: Promise.resolve(params) });

  it("serves a class outline and 404s an unknown class", async () => {
    const ok = await getOutline(new Request("http://x"), ctx({ standard: "10" }) as never);
    expect(ok.status).toBe(200);
    expect((await ok.json()).standard).toBe(10);
    const missing = await getOutline(new Request("http://x"), ctx({ standard: "13" }) as never);
    expect(missing.status).toBe(404);
  });

  it("serves one chapter and 404s an unknown one", async () => {
    const ok = await getChapter(new Request("http://x"), ctx({ chapterId: "c10-science-ch4" }) as never);
    expect(ok.status).toBe(200);
    const body = await ok.json();
    expect(body.chapter.practiceQuestions.length).toBeGreaterThan(0);
    const missing = await getChapter(new Request("http://x"), ctx({ chapterId: "nope" }) as never);
    expect(missing.status).toBe(404);
  });
});
