/**
 * The title a textbook gets from its place in the sorted textbooks folder
 * (`<subject>/<en|ta>/<term-1|volume-2|book|bio-botany>.pdf`). The folder upload
 * and the page-range import both use it, so a file can be found again by title.
 */
const SUBJECT_NAME: Record<string, string> = {
  tamil: "Tamil", english: "English", math: "Mathematics", science: "Science", social: "Social Science",
  physics: "Physics", chemistry: "Chemistry", "comp-sci": "Computer Science", "comp-app": "Computer Applications",
  biology: "Biology", botany: "Botany", zoology: "Zoology",
  commerce: "Commerce", accountancy: "Accountancy", economics: "Economics", "business-math": "Business Mathematics & Statistics",
};

export function textbookTitle(subjectId: string, medium: "en" | "ta", fileName: string): { title: string; term: number | null } {
  const [, cls, key] = /^c(\d+)-(.+)$/.exec(subjectId) ?? [, "?", subjectId];
  const term = /^term-(\d)\.pdf$/i.exec(fileName)?.[1];
  const vol = /^volume-(\d)\.pdf$/i.exec(fileName)?.[1];
  // Any other name (e.g. bio-botany.pdf) becomes part of the title, so two books of one subject stay apart.
  const other = !term && !vol && !/^book\.pdf$/i.test(fileName) ? fileName.replace(/\.pdf$/i, "").replace(/[-_]+/g, " ").replace(/\b\w/g, (ch) => ch.toUpperCase()) : "";
  const part = term ? ` — Term ${term}` : vol ? ` — Volume ${vol}` : other ? ` — ${other}` : "";
  return { title: `Class ${cls} ${SUBJECT_NAME[key!] ?? key} (${medium === "ta" ? "Tamil" : "English"} medium)${part}`, term: term ? Number(term) : null };
}
