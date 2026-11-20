import { describe, expect, it } from "vitest";
import { normaliseMath, parsePracticePage, practiceOrder } from "./practice-parse";

const head = (extra = "") => `---\nclass: 10\nmedium: english-medium\nsubject: maths\nchapter: 'Chapter 1: Relations'\n${extra}---\n\nTamilnadu State Board New Syllabus Pdf Chapter 1\n\n## Tamilnadu Samacheer Kalvi 10th Maths Solutions Chapter 1 Ex 1.1\n\n`;

describe("solutions pages", () => {
  it("splits 'Question N.' pages, including a first sum numbered plainly", () => {
    const md = `${head()}1. Find A × B  \n(i) A = {1}  \nAnswer:  \nA × B = {(1, 1)}\n\nQuestion 2.  \nLet A = {1, 2}.  \nSolution:  \nStep one  \n1. a numbered line in the answer\n\nQuestion 3.  \nProve it.  \nProof:  \nDone.`;
    const p = parsePracticePage(md, "exercise-1.1.md");
    expect(p).toMatchObject({ kind: "exercise", number: "1.1", title: "Exercise 1.1", itemCount: 3 });
    expect(p.sections[0]!.items.map((i) => i.label)).toEqual(["1", "2", "3"]);
    expect(p.sections[0]!.items[1]!.a).toContain("a numbered line in the answer");
    expect(JSON.stringify(p)).not.toMatch(/samacheer/i);
  });

  it("reads book-back sections and multiple choice with the right answer", () => {
    const md = `${head()}### Samacheer Kalvi 10th Science Text Book Back Questions and Answers\n\nI. Choose the correct answer\n\nQuestion 1.  \nInertia depends on:  \n(a) weight  \n(b) gravity  \n(c) mass  \n(d) both  \nAnswer:  \n(c) mass\n\nII. Answer briefly\n\nQuestion 1.  \nDefine force.  \nAnswer:  \nA push or pull.\n\n### Samacheer Kalvi 10th Science Additional Important Questions and Answers\n\nQuestion 1.  \nWhat is mass?  \nAnswer:  \nAmount of matter.`;
    const p = parsePracticePage(md, "chapter-01-laws-of-motion.md");
    expect(p.kind).toBe("bookback");
    expect(p.sections.map((s) => s.title)).toEqual(["Choose the correct answer", "Answer briefly", "More practice questions"]);
    const mcq = p.sections[0]!.items[0]!;
    expect(mcq.mcq).toEqual({ options: [{ key: "a", text: "weight" }, { key: "b", text: "gravity" }, { key: "c", text: "mass" }, { key: "d", text: "both" }], answer: "c" });
    expect(mcq.q).toBe("Inertia depends on:");
    expect(p.mcqCount).toBe(1);
  });

  it("handles Tamil-medium pages with hidden joiners and அ) ஆ) parts", () => {
    const md = `${head()}அ) 10,101; 10,102; ___  \n ‌விடை‌:  \n 10,103\n\nஆ) 10,220; ___  \n விடை:  \n 10,230`;
    const p = parsePracticePage(md, "exercise-2.1.md");
    expect(p.sections[0]!.items.map((i) => [i.label, i.a])).toEqual([
      ["(அ)", "10,103"],
      ["(ஆ)", "10,230"],
    ]);
  });

  it("keeps images whose file names carry the branding, and drops branded alt text", () => {
    const md = `${head()}(i)  \n![Samacheer Kalvi 4th Maths Guide 1](./assets/01_Samacheer-Kalvi-4th.png)  \nAnswer:  \n![Samacheer Kalvi 4th Maths Guide 2](./assets/02_Samacheer-Kalvi-4th.png)`;
    const p = parsePracticePage(md, "exercise-6.1.md");
    expect(p.itemCount).toBe(1);
    expect(p.sections[0]!.items[0]!.q).toBe("![](./assets/01_Samacheer-Kalvi-4th.png)");
    expect(p.assets).toEqual(["./assets/01_Samacheer-Kalvi-4th.png", "./assets/02_Samacheer-Kalvi-4th.png"]);
  });

  it("turns \\( \\) and \\[ \\] into $ maths, joining broken lines", () => {
    expect(normaliseMath("A = \\(\\left(\\begin{array}{cc}  \n1 & 2\n\\end{array}\\right)\\)")).toBe("A = $\\left(\\begin{array}{cc} 1 & 2 \\end{array}\\right)$");
  });

  it("orders exercises 1.1 … 1.10, then unit exercises and book-back", () => {
    const order = [
      ["unit", "1"],
      ["exercise", "1.10"],
      ["bookback", ""],
      ["exercise", "1.2"],
      ["intext", ""],
    ] as const;
    expect([...order].sort((a, b) => practiceOrder(a[0], a[1]) - practiceOrder(b[0], b[1]))).toEqual([
      ["intext", ""],
      ["exercise", "1.2"],
      ["exercise", "1.10"],
      ["unit", "1"],
      ["bookback", ""],
    ]);
  });
});
