import { describe, expect, it } from "vitest";
import { SUPPORTED_STANDARDS } from "@/lib/curriculum";
import { getSubjectsForStandard } from "@/lib/curriculum-data";
import { LIFE_LINKS, LIFE_LINK_THEMES, lifeLinksFor } from "./life-link";

const chapterIds = new Set(
  SUPPORTED_STANDARDS.flatMap((s) => getSubjectsForStandard(s).flatMap((sub) => sub.chapters.map((c) => c.id))),
);

describe("Life Link analogies", () => {
  it("only point at chapters that exist", () => {
    for (const concept of LIFE_LINKS) {
      for (const id of concept.chapterIds) expect(chapterIds, `${concept.id} → ${id}`).toContain(id);
    }
  });

  it("have unique ids across concepts and analogies", () => {
    const ids = LIFE_LINKS.flatMap((c) => [c.id, ...c.analogies.map((a) => a.id)]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("are written in English and Tamil, and say where they break down", () => {
    for (const concept of LIFE_LINKS) {
      expect(concept.analogies.length, concept.id).toBeGreaterThan(0);
      expect(concept.concept.en && concept.concept.ta, concept.id).toBeTruthy();
      for (const a of concept.analogies) {
        expect(LIFE_LINK_THEMES).toContain(a.theme);
        expect(a.body.en.length, a.id).toBeGreaterThan(40);
        expect(a.body.ta.length, a.id).toBeGreaterThan(40);
        expect(a.breaksDown.en.length, a.id).toBeGreaterThan(20);
        expect(a.breaksDown.ta.length, a.id).toBeGreaterThan(20);
      }
    }
  });

  it("covers every Class 10 Science pilot unit except nuclear physics, periodic table and environment", () => {
    const covered = getSubjectsForStandard(10)
      .find((s) => s.id === "c10-science")
      ?.chapters.filter((c) => lifeLinksFor(c.id).length > 0)
      .map((c) => c.chapterNumber);
    expect(covered).toEqual([1, 2, 3, 4, 5, 7, 9, 10, 11]);
  });

  it("returns nothing for chapters without analogies yet", () => {
    expect(lifeLinksFor("no-such-chapter")).toEqual([]);
  });
});
