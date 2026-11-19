import ExcelJS from "exceljs";
import { sql } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { matchUnits, termOfChapter } from "./content-match";
import {
  addChapterVideo,
  addTextbook,
  chapterMedia,
  coverage,
  planImport,
  saveImport,
  setChapterPages,
  setUnitChapter,
  subjectsFor,
  subjectUnits,
} from "./content";
import { createDatabase, type Database } from "./db/connect";
import { isPdf, pdfPageCount } from "./pdf";
import { matchSubject, parseVideoFile } from "./video-import";
import { parseYouTubeUrl } from "./youtube";

describe("YouTube links", () => {
  it("reads videos and playlists in the forms the team pastes", () => {
    expect(parseYouTubeUrl("https://youtu.be/qv02uEjNxMY?si=LFlBKfI9")).toEqual({ kind: "video", id: "qv02uEjNxMY" });
    expect(parseYouTubeUrl("https://www.youtube.com/watch?feature=shared&v=iA15ssgaXyz")).toEqual({ kind: "video", id: "iA15ssgaXyz" });
    expect(parseYouTubeUrl("https://youtube.com/shorts/abcdefghijk")).toEqual({ kind: "video", id: "abcdefghijk" });
    expect(parseYouTubeUrl("https://youtube.com/playlist?list=PLyU8lXZZgGJVDJj_j0xzabpiFE58920fD&si=x")).toEqual({
      kind: "playlist",
      id: "PLyU8lXZZgGJVDJj_j0xzabpiFE58920fD",
    });
  });

  it("refuses channel pages, searches, cut-off ids and other sites", () => {
    for (const bad of [
      "https://www.youtube.com/@SDChemistry/search?query=class%2012",
      "https://www.youtube.com/watch?v=vyS7hGeu",
      "https://vimeo.com/123",
      "not a link",
    ]) {
      expect(parseYouTubeUrl(bad)).toBeNull();
    }
  });
});

describe("subjects and terms", () => {
  it("matches the sheet's subject names to the app's", () => {
    const s4 = subjectsFor(4);
    expect(matchSubject("Maths", s4)?.id).toBe("c4-math");
    expect(matchSubject("Social Science", s4)?.id).toBe("c4-social");
    expect(matchSubject("Science", s4)?.id).toBe("c4-science");
    expect(matchSubject("Tamil", s4)?.id).toBe("c4-tamil");
    const s12 = subjectsFor(12);
    expect(matchSubject("BUSINESS MATHEMATICS", s12)?.id).toBe("c12-business-math");
    expect(matchSubject("COMPUTER APPLICATIONS", s12)?.id).toBe("c12-comp-app");
    expect(matchSubject("Drawing", s12)).toBeNull();
  });

  it("reads the term from English and Tamil chapter titles", () => {
    expect(termOfChapter({ en: "Term 2 - Ch 1: Food", ta: "" })).toBe(2);
    expect(termOfChapter({ en: "பருவம் 3: ஆத்திசூடி", ta: "பருவம் 3: ஆத்திசூடி" })).toBe(3);
    expect(termOfChapter({ en: "Electrostatics", ta: "நிலை மின்னியல்" })).toBeNull();
  });
});

describe("matchUnits", () => {
  const termed = [
    { id: "a1", chapterNumber: 1, title: { en: "Term 1 - Ch 1: Internal Organs", ta: "" } },
    { id: "a2", chapterNumber: 2, title: { en: "Term 1 - Ch 2: Matter and Materials", ta: "" } },
    { id: "a3", chapterNumber: 3, title: { en: "Term 2 - Ch 1: Food and Health", ta: "" } },
  ];
  it("prefers titles, then places the rest by position in the term", () => {
    const res = matchUnits(
      [
        { term: 1, unitNo: 1, title: "My Body", lessonTitles: [] },
        { term: 1, unitNo: 2, title: "Matter and Materials", lessonTitles: [] },
        { term: 1, unitNo: 3, title: "Work and Energy", lessonTitles: [] },
        { term: 2, unitNo: 1, title: "Food", lessonTitles: [] },
        { term: null, unitNo: null, title: "All chapters", lessonTitles: [] },
      ],
      termed,
    );
    expect(res).toEqual([
      { chapterId: "a1", match: "order" },
      { chapterId: "a2", match: "title" },
      { chapterId: "a2", match: "order" },
      { chapterId: "a3", match: "title" },
      { chapterId: null, match: "subject" },
    ]);
  });

  it("uses chapter numbers for books without terms", () => {
    const plain = [
      { id: "b1", chapterNumber: 1, title: { en: "Metallurgy", ta: "" } },
      { id: "b2", chapterNumber: 2, title: { en: "p-Block Elements", ta: "" } },
    ];
    expect(matchUnits([{ term: null, unitNo: 2, title: "Chapter 2", lessonTitles: [] }], plain)).toEqual([{ chapterId: "b2", match: "number" }]);
    expect(matchUnits([{ term: null, unitNo: 9, title: "Chapter 9", lessonTitles: [] }], plain)).toEqual([{ chapterId: null, match: null }]);
  });
});

async function workbook(sheets: Record<string, unknown[][]>): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  for (const [name, rows] of Object.entries(sheets)) {
    const ws = wb.addWorksheet(name);
    for (const r of rows) ws.addRow(r);
  }
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}

const HEADER = ["S.No", "Class", "Subject", "Term", "Unit No.", "Chapter Title", "YouTube Link", "Channel Name", "Duration (mm:ss)", "Video Type", "Remarks"];
const V = (id: string) => `https://youtu.be/${id}?si=x`;

describe("parseVideoFile — rows layout (Class 4 sheet)", () => {
  it("groups lessons, parts and Q&A by unit and picks up the medium from the sheet name", async () => {
    const data = await workbook({
      "Class 4": [
        ["CLASS 4"],
        HEADER,
        [1, 4, "English", 1, 1, "Unit 1: A World with Robots"],
        [2, 4, "English", 1, 1, "The Trick Robot", V("wvIGjTcN50o")],
        [3, 4, "English", 1, 1, "Q & A", V("KQ7dDdP4ays")],
        [4, 4, "Science", 1, 1, "My Body", V("KQ30bTCTGvI")],
        [5, 4, "Science", 1, 1, "Q & A", ""],
        [6, 4, "Science", 1, 2, "Matter and Materials", "https://www.youtube.com/watch?v=vyS7hGeu"],
        [7, 4, "Art", 1, 1, "Drawing", V("aaaaaaaaaaa")],
      ],
      "Class 4 Tamil Medium": [
        ["CLASS 4"],
        HEADER,
        [1, 4, "Science", 1, 1, "எனது உடல்   part 1", V("vxeVC4sgrCQ")],
        ["", "", "", "", 1, "part2", V("xj_all2xPbw")],
        [2, 4, "Science", 1, 1, "Q & A", V("j7fXus0cync")],
      ],
    });
    const { units, issues } = await parseVideoFile(data, { standard: null, medium: "en", subjectsFor });
    const eng = units.find((u) => u.subjectId === "c4-english")!;
    expect(eng).toMatchObject({ standard: 4, medium: "en", term: 1, unitNo: 1, title: "A World with Robots" });
    expect(eng.videos.map((v) => [v.kind, v.title, v.youtubeId])).toEqual([
      ["lesson", "The Trick Robot", "wvIGjTcN50o"],
      ["qa", "Q & A", "KQ7dDdP4ays"],
    ]);
    const ta = units.find((u) => u.subjectId === "c4-science" && u.medium === "ta")!;
    expect(ta.title).toBe("எனது உடல்");
    expect(ta.videos.map((v) => v.title)).toEqual(["எனது உடல் part 1", "எனது உடல் · part2", "Q & A"]);
    expect(issues.map((i) => [i.row, i.reason])).toEqual([
      [8, "bad_link"],
      [9, "unknown_subject"],
    ]);
  });
});

describe("parseVideoFile — sections layout (Class 9/12 sheets)", () => {
  it("reads per-chapter playlists, whole-subject playlists and hidden hyperlinks; reports search pages", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Class 12");
    ws.addRow(["", "CLASS 12"]);
    ws.addRow(["", "ACCOUNTANCY"]);
    ws.addRow(["", "Chapter / Topic", "Link"]);
    ws.addRow(["", "Chapter 1", { text: "▶  Watch", hyperlink: "https://youtube.com/playlist?list=PLyU8lXZZgGJVDJj_j0xzabpiFE58920fD" }]);
    ws.addRow(["", "ECONOMICS"]);
    ws.addRow(["", "Chapters 1–12", { text: "▶  Watch", hyperlink: "https://youtube.com/playlist?list=PLNm1kSRSiGk_oSSsRbmuajNdztZdHynm1" }]);
    ws.addRow(["", "CHEMISTRY"]);
    ws.addRow(["", "Chapters 1–15", { text: "▶  Watch", hyperlink: "https://www.youtube.com/@SDChemistry/search?query=class%2012" }]);
    const data = (await wb.xlsx.writeBuffer()) as ArrayBuffer;
    const { units, issues } = await parseVideoFile(data, { standard: null, medium: "en", subjectsFor });
    expect(units.map((u) => [u.subjectId, u.unitNo, u.videos.length])).toEqual([
      ["c12-accountancy", 1, 1],
      ["c12-economics", null, 1],
      ["c12-chemistry", null, 0],
    ]);
    expect(units[0]!.videos[0]!.playlistId).toBe("PLyU8lXZZgGJVDJj_j0xzabpiFE58920fD");
    expect(issues).toEqual([expect.objectContaining({ row: 8, reason: "unplayable_link" })]);
  });
});

describe("content in the database", () => {
  let db: Database;
  beforeAll(async () => {
    db = await createDatabase({ dataDir: "memory" });
  }, 60_000);
  beforeEach(async () => {
    await db.execute(sql`truncate content_units, videos, textbooks, chapter_pages restart identity cascade`);
  });

  const unit = (over: Partial<Parameters<typeof planImport>[1][number]> = {}) => ({
    standard: 4,
    subjectId: "c4-science",
    subjectLabel: "Science",
    medium: "en" as const,
    term: 1,
    unitNo: 2,
    title: "Matter and Materials",
    sheet: "Class 4",
    row: 5,
    videos: [{ kind: "lesson" as const, title: "Matter and Materials", youtubeId: "5cDF4TC7WCQ", playlistId: null, note: null }],
    ...over,
  });

  it("saves an import, shows it on the chapter, and counts coverage", async () => {
    const planned = await planImport(db, [unit()]);
    expect(planned[0]).toMatchObject({ chapterId: "c4-science-ch2", match: "title" });
    expect(await saveImport(db, planned, "sheet.xlsx")).toEqual({ units: 1, videos: 1 });
    const media = await chapterMedia(db, "c4-science-ch2", "ta");
    expect(media.videos.map((v) => [v.youtubeId, v.medium])).toEqual([["5cDF4TC7WCQ", "en"]]); // Tamil student falls back to English
    const row = (await coverage(db, 4)).find((r) => r.subjectId === "c4-science")!;
    expect(row.withVideo).toEqual({ en: 1, ta: 0 });
  });

  it("re-importing replaces the unit's videos but keeps a link set by hand", async () => {
    await saveImport(db, await planImport(db, [unit()]), "a.xlsx");
    const [u] = await subjectUnits(db, "c4-science");
    await setUnitChapter(db, u!.id, "c4-science-ch1");
    const again = await planImport(db, [unit({ videos: [{ kind: "lesson", title: "New", youtubeId: "abcdefghijk", playlistId: null, note: null }] })]);
    expect(again[0]).toMatchObject({ chapterId: "c4-science-ch1", match: "manual", keptManual: true });
    await saveImport(db, again, "b.xlsx");
    const [after] = await subjectUnits(db, "c4-science");
    expect(after).toMatchObject({ chapterId: "c4-science-ch1", match: "manual" });
    expect(after!.videos.map((v) => v.youtubeId)).toEqual(["abcdefghijk"]);
  });

  it("refuses to link a unit to another subject's chapter", async () => {
    await saveImport(db, await planImport(db, [unit()]), "a.xlsx");
    const [u] = await subjectUnits(db, "c4-science");
    await expect(setUnitChapter(db, u!.id, "c4-math-ch1")).rejects.toMatchObject({ code: "not_found" });
  });

  it("adds a video by hand and shows whole-subject playlists with every chapter", async () => {
    await addChapterVideo(db, { chapterId: "c12-math-ch3", medium: "ta", url: "https://youtu.be/abcdefghijk", kind: "lesson" });
    await expect(addChapterVideo(db, { chapterId: "c12-math-ch3", medium: "ta", url: "https://example.com", kind: "lesson" })).rejects.toMatchObject({
      code: "video_link",
    });
    await saveImport(
      db,
      await planImport(db, [
        unit({ standard: 12, subjectId: "c12-math", term: null, unitNo: null, title: "All chapters", videos: [{ kind: "lesson", title: "Chapters 1–12", youtubeId: null, playlistId: "PL2qtWkm0Z4ccUeTGJYsmtz3cPNxr4Qqmd", note: null }] }),
      ]),
      "c12.xlsx",
    );
    const media = await chapterMedia(db, "c12-math-ch3", "ta");
    expect(media.videos.map((v) => v.youtubeId)).toEqual(["abcdefghijk"]);
    expect(media.subjectVideos.map((v) => v.playlistId)).toEqual(["PL2qtWkm0Z4ccUeTGJYsmtz3cPNxr4Qqmd"]);
  });

  it("stores textbook pages per chapter and checks the numbers", async () => {
    const book = await addTextbook(db, { subjectId: "c4-science", medium: "ta", term: 1, title: "Science T1", storageKey: "t/x.pdf", sizeBytes: 10, pages: 120 }, null);
    await setChapterPages(db, "c4-science-ch1", book.id, 5, 22);
    await expect(setChapterPages(db, "c4-science-ch1", book.id, 30, 10)).rejects.toMatchObject({ code: "pages" });
    await expect(setChapterPages(db, "c4-science-ch1", book.id, 100, 130)).rejects.toMatchObject({ code: "pages" });
    await expect(setChapterPages(db, "c4-math-ch1", book.id, 1, 2)).rejects.toMatchObject({ code: "not_found" });
    expect((await chapterMedia(db, "c4-science-ch1", "ta")).textbook).toMatchObject({ id: book.id, startPage: 5, endPage: 22 });
    await setChapterPages(db, "c4-science-ch1", book.id, null, null);
    expect((await chapterMedia(db, "c4-science-ch1", "ta")).textbook).toBeNull();
  });
});

describe("PDF checks", () => {
  it("recognises a PDF and reads its page count when the page tree is plain", () => {
    const pdf = new TextEncoder().encode("%PDF-1.4\n1 0 obj << /Type /Pages /Kids [3 0 R] /Count 42 >> endobj\n%%EOF");
    expect(isPdf(pdf)).toBe(true);
    expect(pdfPageCount(pdf)).toBe(42);
    expect(isPdf(new TextEncoder().encode("PK zip"))).toBe(false);
  });
});
