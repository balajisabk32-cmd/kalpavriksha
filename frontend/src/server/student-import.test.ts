import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { markTaken, parseCsv, parseGroup, parseMedium, parseStandard, parseStudentFile, studentTemplate } from "./student-import";

async function xlsx(rows: unknown[][]): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("S");
  for (const r of rows) ws.addRow(r);
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}

describe("cell values", () => {
  it("reads classes written many ways", () => {
    expect(["7", "Class 7", "7th", "VII", "வகுப்பு 7", " xii "].map(parseStandard)).toEqual([7, 7, 7, 7, 7, 12]);
    expect(["3", "13", "", "seven"].map(parseStandard)).toEqual([null, null, null, null]);
  });

  it("reads mediums in English and Tamil", () => {
    expect(["", "English", "EM", "tamil", "TM", "தமிழ்", "ஆங்கிலம்"].map(parseMedium)).toEqual(["en", "en", "en", "ta", "ta", "ta", "en"]);
    expect(parseMedium("Hindi")).toBeNull();
  });

  it("reads streams by id, code or name", () => {
    expect(parseGroup("cs")).toBe("cs");
    expect(parseGroup("GROUP-1")).toBe("cs");
    expect(parseGroup("Computer Science Group")).toBe("cs");
    expect(parseGroup("")).toBeNull();
    expect(parseGroup("Arts")).toBeUndefined();
  });

  it("parses quoted CSV", () => {
    expect(parseCsv('﻿Name,Class\r\n"Devi, R",7\n"Say ""hi""",8')).toEqual([
      ["Name", "Class"],
      ["Devi, R", "7"],
      ['Say "hi"', "8"],
    ]);
  });
});

describe("parseStudentFile", () => {
  it("finds the header under a title row, in any order and language, and flags bad rows", async () => {
    const data = await xlsx([
      ["Kalpavriksha — Class list"],
      ["வகுப்பு", "பெயர்", "Medium", "Stream", "Username"],
      [7, "Priya Devi", "Tamil", "", ""],
      [11, "Arun", "English", "cs", "arun"],
      [3, "Too Young", "", "", ""],
      [9, "", "", "", ""],
      [],
      [12, "Kavin", "", "Arts", ""],
      [10, "Same Name", "", "", "ARUN"],
    ]);
    const parsed = await parseStudentFile(data, "list.xlsx");
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.rows.map((r) => [r.row, r.problem])).toEqual([
      [3, null],
      [4, null],
      [5, "standard"],
      [6, "name"],
      [8, "group"],
      [9, "duplicate"],
    ]);
    expect(parsed.rows[0]).toMatchObject({ displayName: "Priya Devi", standard: 7, medium: "ta", groupId: null });
    expect(parsed.rows[1]).toMatchObject({ standard: 11, groupId: "cs", username: "arun" });
  });

  it("reads CSV and refuses files without a Name column", async () => {
    const csv = new TextEncoder().encode("Name,Class\nMeena,5\n").buffer as ArrayBuffer;
    const ok = await parseStudentFile(csv, "s.csv");
    expect(ok.ok && ok.rows[0]).toMatchObject({ displayName: "Meena", standard: 5, medium: "en" });
    const noName = await parseStudentFile(new TextEncoder().encode("Who,Class\nX,5").buffer as ArrayBuffer, "s.csv");
    expect(noName).toEqual({ ok: false, error: "no_name" });
    expect(await parseStudentFile(new ArrayBuffer(8), "broken.xlsx")).toEqual({ ok: false, error: "bad_file" });
  });

  it("marks usernames that already exist", async () => {
    const parsed = await parseStudentFile(new TextEncoder().encode("Name,Class,Username\nA,5,taken\nB,5,free").buffer as ArrayBuffer, "s.csv");
    if (!parsed.ok) throw new Error("parse failed");
    expect(markTaken(parsed.rows, new Set(["taken"])).map((r) => r.problem)).toEqual(["username_taken", null]);
  });

  it("the template reads back cleanly", async () => {
    const parsed = await parseStudentFile(await studentTemplate(), "template.xlsx");
    expect(parsed.ok && parsed.rows.map((r) => r.problem)).toEqual([null, null]);
  });
});
