/**
 * Reads the content team's video spreadsheets.
 *
 * Two layouts are understood:
 * 1. Rows (the Class 4 sheet): a header row with Class, Subject, Term, Unit No.,
 *    Chapter Title, YouTube Link. Blank Class/Subject/Term/Unit cells repeat the
 *    row above ("part 2" rows). "Unit 1: A World with Robots" rows without a link
 *    name the unit. "Q & A" rows are question-and-answer videos.
 * 2. Sections (the Class 9 and Class 12 sheets): a subject name, then rows of
 *    "Chapter 3 | link" (one chapter) or "Chapters 1–12 | link" (whole subject).
 *    Links may be hidden behind text such as "▶ Watch".
 *
 * A sheet named "… Tamil Medium" is Tamil-medium; otherwise the medium chosen
 * on the upload form is used. Channel pages and search links can't be played in
 * the app, so they are reported instead of imported.
 */
import ExcelJS from "exceljs";
import type { Medium, VideoKind } from "./db/schema";
import { parseYouTubeUrl } from "./youtube";

export type SubjectRef = { readonly id: string; readonly code: string; readonly name: { readonly en: string; readonly ta: string } };

export type ParsedVideo = {
  readonly kind: VideoKind;
  readonly title: string;
  readonly youtubeId: string | null;
  readonly playlistId: string | null;
  readonly note: string | null;
};

export type ParsedUnit = {
  readonly standard: number;
  readonly subjectId: string;
  readonly subjectLabel: string;
  readonly medium: Medium;
  readonly term: number | null;
  /** Unit or chapter number in the book; null = videos for the whole subject. */
  readonly unitNo: number | null;
  readonly title: string;
  readonly videos: ParsedVideo[];
  readonly sheet: string;
  readonly row: number;
};

export type ImportIssue = {
  readonly sheet: string;
  readonly row: number;
  /** unplayable_link: a channel or search page. bad_link: not a working video link (often cut short). */
  readonly reason: "unplayable_link" | "bad_link" | "unknown_subject" | "no_class" | "bad_file";
  readonly text: string;
};

export type ParsedVideoFile = { units: ParsedUnit[]; issues: ImportIssue[] };

type Cell = { text: string; links: string[] };

const URL_RE = /https?:\/\/[^\s"'<>]+/g;

function cellOf(cell: ExcelJS.Cell): Cell {
  const v = cell.value;
  let text = "";
  const links: string[] = [];
  if (v === null || v === undefined) text = "";
  else if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") text = String(v);
  else if (v instanceof Date) text = v.toISOString().slice(0, 10);
  else if (typeof v === "object") {
    if ("richText" in v) text = v.richText.map((r) => r.text).join("");
    else if ("hyperlink" in v) {
      text = typeof v.text === "string" ? v.text : "";
      if (v.hyperlink) links.push(String(v.hyperlink));
    } else if ("text" in v && typeof v.text === "string") text = v.text;
    else if ("result" in v) text = String(v.result ?? "");
  }
  if (cell.hyperlink && !links.includes(cell.hyperlink)) links.push(cell.hyperlink);
  for (const m of text.match(URL_RE) ?? []) if (!links.includes(m)) links.push(m);
  return { text: text.replace(URL_RE, "").replace(/\s+/g, " ").trim(), links };
}

const norm = (s: string) =>
  s
    .normalize("NFC")
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, " ")
    .trim();

const ALIASES: Record<string, string> = { maths: "mathematics", math: "mathematics", social: "social science", sst: "social science" };

/** The app subject a sheet's subject name refers to ("Maths" → Mathematics, "BUSINESS MATHEMATICS" → Business Mathematics & Statistics). */
export function matchSubject(label: string, subjects: readonly SubjectRef[]): SubjectRef | null {
  const key = norm(label);
  if (!key) return null;
  const wanted = ALIASES[key] ?? key;
  const names = subjects.map((s) => ({ s, en: norm(s.name.en), ta: norm(s.name.ta) }));
  return (
    names.find((n) => n.en === wanted || n.ta === wanted)?.s ??
    names.find((n) => n.en.startsWith(`${wanted} `) || n.ta.startsWith(`${wanted} `))?.s ??
    null
  );
}

const QA_RE = /^q\s*(&|and)\s*a\b/i;
const UNIT_HEADER_RE = /^(unit|அலகு|இயல்|chapter|பாடம்)\s*\d+\s*[:：.\-–]\s*(.+)$/i;
const PART_ONLY_RE = /^(part\s*-?\s*\d+|ex\.?\s*[\d.]+.*|\d+(\.\d+)*)$/i;

function intOf(text: string): number | null {
  const m = /\d+/.exec(text);
  return m ? Number(m[0]) : null;
}

function mediumOfSheet(name: string, fallback: Medium): Medium {
  return /tamil\s*medium|தமிழ்\s*வழி/i.test(name) ? "ta" : /english\s*medium/i.test(name) ? "en" : fallback;
}

/** Units collected for one file; videos are appended in the order they appear. */
class UnitBook {
  private readonly map = new Map<string, ParsedUnit & { videos: ParsedVideo[] }>();
  get(key: Omit<ParsedUnit, "videos" | "title"> & { title?: string }) {
    const k = [key.standard, key.subjectId, key.medium, key.term ?? "", key.unitNo ?? ""].join("|");
    let unit = this.map.get(k);
    if (!unit) {
      unit = { ...key, title: key.title ?? "", videos: [] };
      this.map.set(k, unit);
    }
    return unit;
  }
  rename(unit: ParsedUnit, title: string) {
    (unit as { title: string }).title = title;
  }
  all(): ParsedUnit[] {
    return [...this.map.values()];
  }
}

function addLinks(
  unit: ParsedUnit & { videos: ParsedVideo[] },
  links: readonly string[],
  base: { kind: VideoKind; title: string; note: string | null },
  issue: (text: string, reason: "unplayable_link" | "bad_link") => void,
) {
  links.forEach((link) => {
    const ref = parseYouTubeUrl(link);
    if (!ref) {
      issue(link, /\/(@|c\/|channel\/|user\/|results)|[?&]search_query=|\/search\b/i.test(link) ? "unplayable_link" : "bad_link");
      return;
    }
    const n = unit.videos.length + 1;
    unit.videos.push({
      ...base,
      title: base.title || `${unit.title || "Video"} · ${n}`,
      youtubeId: ref.kind === "video" ? ref.id : null,
      playlistId: ref.kind === "playlist" ? ref.id : null,
    });
  });
}

function parseRowSheet(
  ws: ExcelJS.Worksheet,
  headerRow: number,
  col: Record<string, number>,
  opts: { standard: number | null; medium: Medium; subjectsFor: (std: number) => readonly SubjectRef[] },
  book: UnitBook,
  issues: ImportIssue[],
) {
  const medium = mediumOfSheet(ws.name, opts.medium);
  let standard = opts.standard;
  let subjectLabel = "";
  let term: number | null = null;
  let unitNo: number | null = null;
  const unitTitles = new Map<string, string>();

  for (let r = headerRow + 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const get = (name: string): Cell => (col[name] ? cellOf(row.getCell(col[name]!)) : { text: "", links: [] });
    const cClass = get("class");
    const cSubject = get("subject");
    const cTerm = get("term");
    const cUnit = get("unit");
    const cTitle = get("title");
    const cLink = get("link");
    const extraLinks: string[] = [];
    const notes: string[] = [];
    for (const name of ["extra1", "extra2", "extra3", "extra4"]) {
      const c = get(name);
      extraLinks.push(...c.links);
      if (c.text) notes.push(c.text);
    }
    const links = [...cLink.links, ...extraLinks];
    if (!cClass.text && !cSubject.text && !cTitle.text && links.length === 0) continue;

    if (cClass.text) standard = intOf(cClass.text) ?? standard;
    if (cSubject.text) {
      if (cSubject.text !== subjectLabel) unitNo = null;
      subjectLabel = cSubject.text;
    }
    if (cTerm.text) term = intOf(cTerm.text);
    if (cUnit.text) unitNo = intOf(cUnit.text);

    if (!standard) {
      issues.push({ sheet: ws.name, row: r, reason: "no_class", text: cTitle.text });
      continue;
    }
    const subject = matchSubject(subjectLabel, opts.subjectsFor(standard));
    if (!subject) {
      if (links.length || cTitle.text) issues.push({ sheet: ws.name, row: r, reason: "unknown_subject", text: subjectLabel || cTitle.text });
      continue;
    }

    const title = cTitle.text;
    const header = UNIT_HEADER_RE.exec(title);
    const key = { standard, subjectId: subject.id, subjectLabel, medium, term, unitNo, sheet: ws.name, row: r };
    const unitKey = `${subject.id}|${term}|${unitNo}`;

    if (header && links.length === 0) {
      unitTitles.set(unitKey, header[2]!.trim());
      book.rename(book.get(key), header[2]!.trim());
      continue;
    }
    const isQa = QA_RE.test(title);
    const unit = book.get(key);
    // The unit is named by its "Unit N:" row, or else by its first lesson.
    if (!unit.title && title && !isQa && !PART_ONLY_RE.test(title)) {
      book.rename(unit, unitTitles.get(unitKey) ?? title.replace(/\s*part\s*-?\s*\d+\s*$/i, "").trim());
    }
    if (links.length === 0) continue;
    const videoTitle = !title || PART_ONLY_RE.test(title) ? `${unit.title || title} · ${title || `${unit.videos.length + 1}`}`.replace(/ · $/, "") : title;
    addLinks(unit, links, { kind: isQa ? "qa" : "lesson", title: videoTitle, note: notes.join(" · ") || null }, (text, reason) =>
      issues.push({ sheet: ws.name, row: r, reason, text }),
    );
  }
}

const CHAPTER_ONE_RE = /^(chapter|ch|unit|lesson|பாடம்|இயல்|அலகு)\s*\.?\s*(\d{1,2})$/i;

function parseSectionSheet(
  ws: ExcelJS.Worksheet,
  opts: { standard: number | null; medium: Medium; subjectsFor: (std: number) => readonly SubjectRef[] },
  book: UnitBook,
  issues: ImportIssue[],
) {
  const medium = mediumOfSheet(ws.name, opts.medium);
  let standard = opts.standard;
  let subject: SubjectRef | null = null;
  let subjectLabel = "";

  for (let r = 1; r <= ws.rowCount; r++) {
    const cells: Cell[] = [];
    ws.getRow(r).eachCell({ includeEmpty: false }, (c) => {
      cells.push(cellOf(c));
    });
    const texts = cells.map((c) => c.text).filter(Boolean);
    const links = cells.flatMap((c) => c.links);
    if (!texts.length && !links.length) continue;

    const classMention = texts.map((t) => /^(class|std|standard|வகுப்பு)\s*(\d{1,2})$/i.exec(t)).find(Boolean);
    if (classMention && !links.length) {
      standard = Number(classMention[2]);
      continue;
    }
    if (!standard) {
      if (links.length) issues.push({ sheet: ws.name, row: r, reason: "no_class", text: texts.join(" ") });
      continue;
    }
    const subjects = opts.subjectsFor(standard);
    const named = texts.map((t) => ({ t, s: matchSubject(t, subjects) })).find((x) => x.s);
    if (named) {
      subject = named.s;
      subjectLabel = named.t;
    }
    if (!links.length) continue;
    if (!subject) {
      issues.push({ sheet: ws.name, row: r, reason: "unknown_subject", text: texts.join(" ") });
      continue;
    }
    const label = texts.filter((t) => t !== named?.t && !/^▶?\s*watch$/i.test(t)).join(" ") || "";
    const one = CHAPTER_ONE_RE.exec(label);
    const unit = book.get({
      standard,
      subjectId: subject.id,
      subjectLabel,
      medium,
      term: null,
      unitNo: one ? Number(one[2]) : null,
      sheet: ws.name,
      row: r,
      title: one ? label : "",
    });
    if (!unit.title) book.rename(unit, one ? label : "All chapters");
    addLinks(unit, links, { kind: "lesson", title: label || unit.title, note: null }, (text, reason) =>
      issues.push({ sheet: ws.name, row: r, reason, text }),
    );
  }
}

const HEADERS: Record<string, RegExp> = {
  class: /^(class|std|standard|வகுப்பு)$/i,
  subject: /^(subject|பாடம்)$/i,
  term: /^(term|பருவம்)$/i,
  unit: /^(unit|unit no\.?|unit number|chapter no\.?|அலகு)$/i,
  title: /^(chapter title|title|lesson|topic|chapter|chapter \/ topic|தலைப்பு)$/i,
  link: /^(youtube link|youtube|link|video link|url|இணைப்பு)$/i,
};

/** Header row of the "rows" layout: needs Subject, a title and a link column. */
function findHeader(ws: ExcelJS.Worksheet): { row: number; col: Record<string, number> } | null {
  for (let r = 1; r <= Math.min(ws.rowCount, 10); r++) {
    const col: Record<string, number> = {};
    ws.getRow(r).eachCell({ includeEmpty: false }, (c, n) => {
      const t = cellOf(c).text.trim();
      for (const [name, re] of Object.entries(HEADERS)) if (!col[name] && re.test(t)) col[name] = n;
    });
    if (col.subject && col.title && col.link) {
      // Columns after the link (Channel, Duration, Type, Remarks) may hold extra links or notes.
      for (let i = 1; i <= 4; i++) col[`extra${i}`] = col.link + i;
      return { row: r, col };
    }
  }
  return null;
}

export async function parseVideoFile(
  data: ArrayBuffer,
  opts: { standard: number | null; medium: Medium; subjectsFor: (std: number) => readonly SubjectRef[] },
): Promise<ParsedVideoFile> {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(data);
  } catch {
    return { units: [], issues: [{ sheet: "", row: 0, reason: "bad_file", text: "" }] };
  }
  const book = new UnitBook();
  const issues: ImportIssue[] = [];
  for (const ws of wb.worksheets) {
    // The sheet title ("CLASS 4", "class 9") gives the class when the form doesn't.
    let standard = opts.standard;
    if (!standard) {
      for (let r = 1; r <= Math.min(ws.rowCount, 3) && !standard; r++) {
        ws.getRow(r).eachCell((c) => {
          const m = /^\s*(class|std)\s*(\d{1,2})\s*$/i.exec(cellOf(c).text);
          if (m && !standard) standard = Number(m[2]);
        });
      }
    }
    const header = findHeader(ws);
    const sheetOpts = { ...opts, standard };
    if (header) parseRowSheet(ws, header.row, header.col, sheetOpts, book, issues);
    else parseSectionSheet(ws, sheetOpts, book, issues);
  }
  return { units: book.all(), issues };
}
