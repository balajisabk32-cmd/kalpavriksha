/**
 * Reads a student list from an Excel (.xlsx) or CSV file. Column names may be in
 * English or Tamil and in any order; only Name and Class are required.
 */
import ExcelJS from "exceljs";
import { SENIOR_GROUPS } from "@/lib/curriculum";
import type { Medium } from "./db/schema";

export type ImportProblem = "name" | "standard" | "medium" | "group" | "username" | "username_taken" | "password_short" | "duplicate";

export type ImportRow = {
  readonly row: number;
  readonly displayName: string;
  readonly standard: number | null;
  readonly medium: Medium;
  readonly groupId: string | null;
  readonly section: string | null;
  readonly username: string | null;
  readonly password: string | null;
  readonly problem: ImportProblem | null;
};

export type ParsedImport = { ok: true; rows: ImportRow[] } | { ok: false; error: "bad_file" | "no_name" | "too_many" };

export const MAX_IMPORT_ROWS = 1000;

type Column = "name" | "class" | "medium" | "stream" | "section" | "username" | "password";

const HEADERS: Record<Column, readonly string[]> = {
  name: ["name", "student name", "student", "full name", "பெயர்", "மாணவர் பெயர்", "மாணவரின் பெயர்"],
  class: ["class", "standard", "std", "grade", "வகுப்பு"],
  medium: ["medium", "பயிற்று மொழி", "மொழி", "வழி"],
  stream: ["stream", "group", "பாடப்பிரிவு", "குழு"],
  section: ["section", "sec", "பிரிவு"],
  username: ["username", "user name", "login", "user id", "பயனர் பெயர்"],
  password: ["password", "கடவுச்சொல்"],
};

const norm = (v: string) => v.normalize("NFC").trim().toLowerCase().replace(/\s+/g, " ").replace(/[*:]$/, "").trim();

function columnOf(header: string): Column | null {
  const h = norm(header);
  for (const [col, names] of Object.entries(HEADERS) as [Column, readonly string[]][]) {
    if (names.includes(h)) return col;
  }
  return null;
}

const ROMAN: Record<string, number> = { iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10, xi: 11, xii: 12 };

/** "7", "Class 7", "7th", "VII", "வகுப்பு 7" → 7. */
export function parseStandard(raw: string): number | null {
  const v = norm(raw);
  if (!v) return null;
  const digits = /(\d{1,2})/.exec(v);
  const n = digits ? Number(digits[1]) : ROMAN[v.replace(/^(class|std|standard)\s*/, "")];
  return n !== undefined && Number.isInteger(n) && n >= 4 && n <= 12 ? n : null;
}

/** Empty means English medium. */
export function parseMedium(raw: string): Medium | null {
  const v = norm(raw);
  if (!v) return "en";
  if (["en", "em", "e/m", "english", "english medium", "ஆங்கிலம்", "ஆங்கில வழி"].includes(v)) return "en";
  if (["ta", "tm", "t/m", "tamil", "tamil medium", "தமிழ்", "தமிழ் வழி"].includes(v)) return "ta";
  return null;
}

/** Stream by id ("cs"), code ("GROUP-1"), short name ("Computer Science") or full name in either language. */
export function parseGroup(raw: string): string | null | undefined {
  const v = norm(raw);
  if (!v) return null;
  const found = SENIOR_GROUPS.find((g) =>
    [g.id, g.code, g.badge, g.name.en, g.name.ta].some((name) => norm(name) === v || norm(name).replace(/ group$/, "") === v),
  );
  return found ? found.id : undefined;
}

const USERNAME_RE = /^[a-z0-9._-]{3,32}$/;

function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    if ("richText" in value) return value.richText.map((r) => r.text).join("");
    if ("text" in value && typeof value.text === "string") return value.text;
    if ("result" in value) return cellText(value.result as ExcelJS.CellValue);
  }
  return String(value);
}

/** Minimal CSV reader: commas, double-quoted fields, "" escapes, CRLF or LF. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!;
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

async function readGrid(data: ArrayBuffer, fileName: string): Promise<string[][]> {
  if (/\.csv$/i.test(fileName)) return parseCsv(new TextDecoder("utf-8").decode(data));
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(data);
  const ws = wb.worksheets[0];
  if (!ws) return [];
  const grid: string[][] = [];
  ws.eachRow({ includeEmpty: true }, (r, n) => {
    const cells: string[] = [];
    r.eachCell({ includeEmpty: true }, (c, col) => {
      cells[col - 1] = cellText(c.value).trim();
    });
    grid[n - 1] = Array.from(cells, (c) => c ?? "");
  });
  return Array.from(grid, (r) => r ?? []);
}

/** Parses and checks every row. Usernames already in the database are checked separately (`markTaken`). */
export async function parseStudentFile(data: ArrayBuffer, fileName: string): Promise<ParsedImport> {
  let grid: string[][];
  try {
    grid = await readGrid(data, fileName);
  } catch {
    return { ok: false, error: "bad_file" };
  }
  // The header row is the first row that names a "Name" column (title rows above it are skipped).
  const headerIndex = grid.findIndex((r) => r.some((c) => columnOf(c) === "name"));
  if (headerIndex < 0) return { ok: false, error: "no_name" };
  const cols = new Map<Column, number>();
  grid[headerIndex]!.forEach((h, i) => {
    const col = columnOf(h);
    if (col && !cols.has(col)) cols.set(col, i);
  });

  const body = grid.slice(headerIndex + 1);
  const rows: ImportRow[] = [];
  const seen = new Set<string>();
  body.forEach((cells, i) => {
    const get = (c: Column) => (cols.has(c) ? (cells[cols.get(c)!] ?? "").trim() : "");
    if (cells.every((c) => !c?.trim())) return;
    const displayName = get("name").replace(/\s+/g, " ");
    const standard = parseStandard(get("class"));
    const medium = parseMedium(get("medium"));
    const group = parseGroup(get("stream"));
    const username = get("username").toLowerCase() || null;
    const password = get("password") || null;

    let problem: ImportProblem | null = null;
    if (!displayName || displayName.length > 60) problem = "name";
    else if (standard === null) problem = "standard";
    else if (medium === null) problem = "medium";
    else if (group === undefined) problem = "group";
    else if (username && !USERNAME_RE.test(username)) problem = "username";
    else if (username && seen.has(username)) problem = "duplicate";
    else if (password && password.length < 6) problem = "password_short";
    if (username) seen.add(username);

    rows.push({
      row: headerIndex + i + 2,
      displayName,
      standard,
      medium: medium ?? "en",
      groupId: standard !== null && standard >= 11 ? (group ?? null) : null,
      section: get("section").slice(0, 10) || null,
      username,
      password,
      problem,
    });
  });
  if (rows.length > MAX_IMPORT_ROWS) return { ok: false, error: "too_many" };
  return { ok: true, rows };
}

/** Marks rows whose chosen username is already used by someone. */
export function markTaken(rows: readonly ImportRow[], taken: ReadonlySet<string>): ImportRow[] {
  return rows.map((r) => (!r.problem && r.username && taken.has(r.username) ? { ...r, problem: "username_taken" } : r));
}

/** The template admins fill in: headers, two examples and a sheet listing the streams. */
export async function studentTemplate(): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Students");
  ws.columns = [
    { header: "Name", key: "name", width: 28 },
    { header: "Class", key: "class", width: 8 },
    { header: "Medium", key: "medium", width: 12 },
    { header: "Stream", key: "stream", width: 18 },
    { header: "Section", key: "section", width: 9 },
    { header: "Username", key: "username", width: 18 },
    { header: "Password", key: "password", width: 14 },
  ];
  ws.getRow(1).font = { bold: true };
  ws.addRow({ name: "Priya Devi", class: 7, medium: "Tamil" });
  ws.addRow({ name: "Arun Kumar", class: 11, medium: "English", stream: "cs", section: "A" });
  const help = wb.addWorksheet("Streams (Class 11–12)");
  help.columns = [
    { header: "Stream (type this)", key: "id", width: 20 },
    { header: "Name", key: "en", width: 36 },
    { header: "பெயர்", key: "ta", width: 36 },
  ];
  help.getRow(1).font = { bold: true };
  for (const g of SENIOR_GROUPS) help.addRow({ id: g.id, en: g.name.en, ta: g.name.ta });
  const notes = wb.addWorksheet("Help");
  notes.addRows([
    ["Only Name and Class are needed. Class is 4 to 12."],
    ["Medium: English or Tamil (empty = English)."],
    ["Stream: only for Class 11–12; can be set later."],
    ["Username and Password: leave empty to make them automatically."],
  ]);
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}
