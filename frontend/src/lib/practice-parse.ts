/**
 * Turns one solutions page (Markdown) into sections of numbered sums/questions,
 * each with its answer, so students can open one at a time and track progress.
 *
 * The pages come in a few styles: "Question 1." / "கேள்வி 1." headings, plain
 * "1." / "(i)" numbering for younger classes, and roman-numbered book-back
 * sections ("I. Choose the correct answer"). Splitting is anchored on answer
 * markers ("Answer:", "Solution:", "தீர்வு:", "விடை:"), which every page uses.
 */

export type PracticeKind = "exercise" | "unit" | "intext" | "bookback" | "additional" | "misc";

export type PracticeItem = {
  /** As printed: "1", "2(ii)", "(iii)". */
  label: string;
  /** Question text (Markdown, maths as $…$). */
  q: string;
  /** Answer / worked solution (Markdown). Empty when the page gives none. */
  a: string;
  /** Multiple choice: the options and the correct key, so it can be answered interactively. */
  mcq?: { options: { key: string; text: string }[]; answer: string };
};

export type PracticeSection = { title: string | null; note?: string; items: PracticeItem[] };

export type ParsedPage = {
  meta: Record<string, string>;
  kind: PracticeKind;
  /** "1.1" for Exercise 1.1, "1" for Unit Exercise 1, "" otherwise. */
  number: string;
  title: string;
  sections: PracticeSection[];
  itemCount: number;
  mcqCount: number;
  /** Images used, as written in the page (./assets/…). */
  assets: string[];
};

const ANSWER = /^\s*\**\s*(?:answers?|solutions?|proof|ans|விடைகள்|விடை|தீர்வு)\s*\**\s*[:：]\s*\**(.*)$|^\s*\**(?:answer|solution|விடை|தீர்வு)\**\s*$/i;
const NAMED_Q = /^\s*\**\s*(?:question|கேள்வி|வினா)\s*(\d+[a-z]?(?:\s*\([ivx]+\))?)\s*[.:)]?\s*\**\s*(.*)$/i;
const PLAIN_Q = /^\s*\**\s*(\d{1,3}[.)]|\([ivx]{1,4}\)|[ivx]{1,4}\)|\([a-h]\)|\(?(?:அ|ஆ|இ|ஈ|உ|ஊ)\))\s*\**\s*(.*)$/;
const PLAIN_NUM = /^\s*\**\s*(\d{1,3}[.)])\s*\**\s*(.*)$/;
const ROMAN_SECTION = /^\s*\**\s*([IVX]{1,5})\.\s+(\S.*?)\**\s*$/;
const LETTER_SECTION = /^\s*\**\s*([A-H])\.\s*(.*?)\**\s*$/;
const HEADING = /^\s*#{2,6}\s+(.+?)\s*#*\s*$/;
const OPTION = /^\s*\(?([a-dA-D1-4]|அ|ஆ|இ|ஈ)[).]\s+(.+)$/;
const NOISE = /samacheer|tamil\s*nadu state board|tn board|kalvi\s*guru|samacheerkalvi|state board new syllabus|guide pdf|solutions pdf/i;

/** Reads the `---` front matter (simple `key: value` lines). */
export function frontMatter(md: string): { meta: Record<string, string>; body: string } {
  const m = /^---\s*\n([\s\S]*?)\n---\s*\n?/.exec(md.replace(/^﻿/, "").replace(/\r\n/g, "\n"));
  if (!m) return { meta: {}, body: md.replace(/\r\n/g, "\n") };
  const meta: Record<string, string> = {};
  for (const line of m[1]!.split("\n")) {
    const kv = /^([a-z_]+):\s*(.*)$/i.exec(line);
    if (kv) meta[kv[1]!] = kv[2]!.trim().replace(/^'(.*)'$/, "$1").replace(/^"(.*)"$/, "$1").replace(/''/g, "'");
  }
  return { meta, body: md.replace(/\r\n/g, "\n").slice(m[0].length) };
}

/** `\( … \)` → `$…$` and `\[ … \]` → `$$…$$`, joining the lines inside. */
export function normaliseMath(text: string): string {
  const join = (s: string) => s.replace(/ {2,}\n/g, "\n").replace(/\n\s*/g, " ").trim();
  return text
    .replace(/\\\[([\s\S]+?)\\\]/g, (_, m: string) => `$$${join(m)}$$`)
    .replace(/\\\(([\s\S]+?)\\\)/g, (_, m: string) => `$${join(m)}$`);
}

/** Section titles without the guide's branding. */
function sectionTitle(raw: string): string {
  const t = raw.replace(/\*+/g, "").trim();
  if (/additional|important questions|extra questions/i.test(t)) return "More practice questions";
  if (/book\s*-?\s*back|text\s*book\s*(questions|exercise)|textual/i.test(t)) return "Book-back questions";
  if (NOISE.test(t)) return "";
  return t;
}

function kindOf(meta: Record<string, string>, fileName: string): { kind: PracticeKind; number: string; title: string } {
  const base = fileName.replace(/\.md$/i, "");
  const ex = /^exercise-(\d+(?:\.\d+)*[a-z]?)$/.exec(base);
  if (ex) {
    const n = ex[1]!;
    return n.includes(".") ? { kind: "exercise", number: n, title: `Exercise ${n}` } : { kind: "unit", number: n, title: `Unit Exercise ${n}` };
  }
  if (/intext/.test(base)) return { kind: "intext", number: "", title: "In-text questions" };
  if (/additional/.test(base)) return { kind: "additional", number: "", title: "More practice questions" };
  if (base === "index") {
    const t = meta.exercise || (/miscellaneous/i.test(meta.chapter ?? "") ? "Miscellaneous problems" : "Exercise");
    return { kind: "misc", number: "", title: t };
  }
  return { kind: "bookback", number: "", title: "Book-back questions" };
}

type Draft = { label: string; q: string[]; a: string[]; hasAnswer: boolean; named: boolean };

/** Splits a page into sections and items. */
export function parsePracticePage(md: string, fileName: string): ParsedPage {
  const { meta, body } = frontMatter(md);
  const { kind, number, title } = kindOf(meta, fileName);
  const text = normaliseMath(body)
    // Links → their text; images keep their path but lose the branded alt text.
    .replace(/!\[[^\]]*\]\(([^)\s]+)[^)]*\)/g, "![]($1)")
    .replace(/(?<!!)\[([^\]]*)\]\((?:https?:)?[^)]*\)/g, "$1");
  // Invisible joiners around words like "விடை" would hide the answer markers.
  const lines = text.replace(/[​-‍⁠﻿]/g, "").split("\n");
  const named = lines.filter((l) => NAMED_Q.test(l)).length >= 2;

  const sections: PracticeSection[] = [];
  let section: PracticeSection = { title: null, items: [] };
  let cur: Draft | null = null;
  let preamble: string[] = [];
  let seenHeading = false;

  const flush = () => {
    if (!cur) return;
    const item = cur;
    cur = null;
    const q = item.q.join("\n").trim();
    const a = item.a.join("\n").trim();
    if (!q && !a) return;
    const prev = section.items[section.items.length - 1];
    // A plain-numbered fragment with no answer is usually a numbered list inside the previous answer.
    if (!item.hasAnswer && !item.named && prev) {
      prev.a = `${prev.a}\n\n${item.label} ${q}`.trim();
      return;
    }
    section.items.push(finishItem(item.label, q, a));
  };
  const newSection = (t: string | null) => {
    flush();
    if (preamble.join("").trim()) {
      const note = tidy(preamble.join("\n"));
      if (note) section.note = section.note ? `${section.note}\n\n${note}` : note;
    }
    preamble = [];
    if (section.items.length || section.note) sections.push(section);
    section = { title: t, items: [] };
  };

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, (s) => (s.startsWith("  ") ? "  " : ""));
    const h = HEADING.exec(line);
    if (h) {
      seenHeading = true;
      const t = sectionTitle(h[1]!);
      // The page's main title (H2) is branding; deeper headings start sections.
      if (/^\s*##\s/.test(line) && !/^\s*###/.test(line)) {
        preamble = [];
        continue;
      }
      newSection(t || null);
      continue;
    }
    // Branding lines are dropped, but images on them are kept (their file names carry the branding).
    const images = line.match(/!\[\]\([^)\s]+\)/g) ?? [];
    const words = line.replace(/!\[\]\([^)\s]+\)/g, "").trim();
    if (words && NOISE.test(words) && (!seenHeading || (words.length < 200 && !/[=+×÷]/.test(words)))) {
      if (!images.length) continue;
      const kept = images.join("\n");
      if (cur) (cur.hasAnswer ? cur.a : cur.q).push(kept);
      else preamble.push(kept);
      continue;
    }

    const roman = ROMAN_SECTION.exec(line);
    if (roman && (!cur || cur.hasAnswer)) {
      newSection(sectionTitle(roman[2]!) || roman[2]!.trim());
      continue;
    }
    const letter = LETTER_SECTION.exec(line);
    if (letter && !named && (!cur || cur.hasAnswer) && !/^\s*[A-H]\.\s*\d/.test(line)) {
      newSection(`${letter[1]}. ${letter[2] ?? ""}`.trim());
      continue;
    }

    const ans = ANSWER.exec(line);
    if (ans && cur && !cur.hasAnswer) {
      cur.hasAnswer = true;
      const rest = (ans[1] ?? "").trim();
      if (rest) cur.a.push(rest);
      continue;
    }
    if (ans && !cur) {
      // An answer with no question before it (e.g. an activity) — keep the text before it as the question.
      cur = { label: "", q: preamble.splice(0), a: [], hasAnswer: true, named: true };
      const rest = (ans[1] ?? "").trim();
      if (rest) cur.a.push(rest);
      continue;
    }

    // "Question N." pages still number some parts plainly (fill in the blanks, match the following).
    const namedMatch = named ? NAMED_Q.exec(line) : null;
    const nq = namedMatch ?? (named ? PLAIN_NUM.exec(line) : PLAIN_Q.exec(line));
    // "Question N." always starts a new one; plain numbers only once the current one is answered.
    const startsNew = Boolean(namedMatch) || (nq !== null && (!cur || cur.hasAnswer));
    if (nq && startsNew) {
      flush();
      if (preamble.join("").trim()) {
        const note = tidy(preamble.join("\n"));
        if (note) section.note = section.note ? `${section.note}\n\n${note}` : note;
        preamble = [];
      }
      const rawLabel = nq[1]!.replace(/\s+/g, "");
      const label = namedMatch || /^\d+[.)]$/.test(rawLabel) ? rawLabel.replace(/[.)]$/, "") : `(${rawLabel.replace(/[()]/g, "")})`;
      cur = { label, q: nq[2] ? [nq[2]] : [], a: [], hasAnswer: false, named: Boolean(namedMatch) };
      continue;
    }

    if (cur) (cur.hasAnswer ? cur.a : cur.q).push(line);
    else preamble.push(line);
  }
  newSection(null);

  const clean = sections.filter((s) => s.items.length || s.note);
  const assets = [...new Set([...text.matchAll(/!\[\]\(([^)\s]+)\)/g)].map((m) => m[1]!))];
  return {
    meta,
    kind,
    number,
    title,
    sections: clean,
    itemCount: clean.reduce((n, s) => n + s.items.length, 0),
    mcqCount: clean.reduce((n, s) => n + s.items.filter((i) => i.mcq).length, 0),
    assets,
  };
}

function tidy(s: string): string {
  return s
    .split("\n")
    .map((l) => l.replace(/\s+$/, (x) => (x.startsWith("  ") ? "  " : "")))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function finishItem(label: string, qRaw: string, aRaw: string): PracticeItem {
  const q = tidy(qRaw);
  const a = tidy(aRaw);
  const qLines = q.split("\n");
  const opts = qLines.map((l) => OPTION.exec(l)).filter((m): m is RegExpExecArray => m !== null);
  const firstAns = OPTION.exec(a.split("\n")[0] ?? "") ?? /^\s*\(?([a-dA-D1-4]|அ|ஆ|இ|ஈ)\)?\s*$/.exec(a.split("\n")[0] ?? "");
  if (opts.length >= 3 && opts.length <= 5 && firstAns) {
    const keys = opts.map((o) => o[1]!.toLowerCase());
    const answer = firstAns[1]!.toLowerCase();
    if (keys.includes(answer) && new Set(keys).size === keys.length) {
      const stem = tidy(qLines.filter((l) => !OPTION.test(l)).join("\n"));
      return {
        label,
        q: stem,
        a,
        mcq: { options: opts.map((o) => ({ key: o[1]!.toLowerCase(), text: o[2]!.replace(/\s+$/, "") })), answer },
      };
    }
  }
  return { label, q, a };
}

/** Sort key so 1.2 < 1.10 and unit exercises come after the numbered ones. */
export function practiceOrder(kind: PracticeKind, number: string): number {
  const base = { intext: 0, exercise: 1, unit: 2, misc: 3, bookback: 4, additional: 5 }[kind] * 1_000_000;
  const parts = number.split(".").map(Number);
  return base + (parts[0] || 0) * 1000 + (parts[1] || 0);
}
