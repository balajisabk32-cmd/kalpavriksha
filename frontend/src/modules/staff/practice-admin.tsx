"use client";

import { ArrowLeft, ArrowSquareOut, Eye, EyeSlash } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { linkPracticeAction, publishPracticeAction } from "@/app/admin/practice/actions";
import { useLocale } from "@/components/locale-provider";
import { BTN_PRIMARY, BTN_SECONDARY, Card, FOCUS, INPUT, PageHeader } from "./ui";

type Medium = "en" | "ta";
type Localized = { en: string; ta: string };

const COPY = {
  en: {
    title: "Exercises & solutions",
    lead: "Book-back questions and exercises imported from the content folder. Publish a subject when it has been checked; link textbook chapters to lessons so they show inside the lesson.",
    empty: "Nothing imported yet. Run: npm run practice:import -- \"<content folder>\"",
    cols: { cls: "Class", subject: "Subject", medium: "Medium", chapters: "Chapters", linked: "Linked to a lesson", questions: "Questions", status: "Students see it" },
    single: "One language",
    medium: { en: "English", ta: "Tamil" },
    publish: "Publish",
    unpublish: "Unpublish",
    yes: "Yes",
    partly: (a: number, b: number) => `${a} of ${b}`,
    no: "No",
    open: "Chapters",
    preview: "Preview as student",
    back: "Exercises",
    link: "Lesson",
    notLinked: "Not linked",
    linkLead: "The textbook has more chapters than the app's lesson list. Link each one to the lesson it belongs to, or leave it unlinked — it still shows under Exercises.",
    manual: "set by hand",
    sets: (n: number, q: number) => `${n} exercises · ${q} questions`,
  },
  ta: {
    title: "பயிற்சிகள் & தீர்வுகள்",
    lead: "உள்ளடக்கக் கோப்புறையிலிருந்து சேர்த்த புத்தக வினாக்களும் பயிற்சிகளும். சரிபார்த்த பின் பாடத்தை வெளியிடுங்கள்; பாடநூல் பாடங்களைப் பாடங்களுடன் இணைத்தால் அவை பாடத்துக்குள்ளும் தெரியும்.",
    empty: "இன்னும் எதுவும் சேர்க்கப்படவில்லை.",
    cols: { cls: "வகுப்பு", subject: "பாடம்", medium: "வழி", chapters: "பாடங்கள்", linked: "இணைக்கப்பட்டவை", questions: "வினாக்கள்", status: "மாணவர்களுக்குத் தெரியும்" },
    single: "ஒரே மொழி",
    medium: { en: "ஆங்கிலம்", ta: "தமிழ்" },
    publish: "வெளியிடு",
    unpublish: "நிறுத்து",
    yes: "ஆம்",
    partly: (a: number, b: number) => `${b} இல் ${a}`,
    no: "இல்லை",
    open: "பாடங்கள்",
    preview: "மாணவராகப் பார்",
    back: "பயிற்சிகள்",
    link: "பாடம்",
    notLinked: "இணைக்கப்படவில்லை",
    linkLead: "பாடநூலில் பயன்பாட்டின் பாடப் பட்டியலை விட அதிகப் பாடங்கள் உள்ளன. ஒவ்வொன்றையும் உரிய பாடத்துடன் இணையுங்கள்; இணைக்காவிட்டாலும் பயிற்சிகள் பகுதியில் தெரியும்.",
    manual: "கையால் அமைத்தது",
    sets: (n: number, q: number) => `${n} பயிற்சிகள் · ${q} வினாக்கள்`,
  },
} as const;

type Row = { standard: number; subjectId: string; medium: Medium | null; name: Localized; chapters: number; linked: number; published: number; sets: number; items: number };

export function PracticeOverview({ rows }: { rows: Row[] }) {
  const { locale } = useLocale();
  const c = COPY[locale];
  const router = useRouter();
  const [busy, start] = useTransition();
  const classes = useMemo(() => [...new Set(rows.map((r) => r.standard))], [rows]);
  const [cls, setCls] = useState<number | "all">("all");
  const shown = rows.filter((r) => cls === "all" || r.standard === cls);
  const toggle = (r: Row, on: boolean) =>
    start(async () => {
      await publishPracticeAction(r.subjectId, r.medium, on);
      router.refresh();
    });

  return (
    <>
      <PageHeader title={c.title} lead={c.lead} />
      {rows.length === 0 ? (
        <Card>
          <p className="text-sm text-muted">{c.empty}</p>
        </Card>
      ) : (
        <Card>
          <div className="mb-3 flex flex-wrap gap-2">
            {(["all", ...classes] as const).map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={cls === k}
                onClick={() => setCls(k)}
                className={`min-h-10 rounded-xl border px-3 text-sm font-medium ${FOCUS} ${cls === k ? "border-violet bg-violet/15" : "border-line hover:bg-violet/[0.06]"}`}
              >
                {k === "all" ? (locale === "ta" ? "அனைத்தும்" : "All") : `${c.cols.cls} ${k}`}
              </button>
            ))}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="text-xs text-muted">
                <tr>
                  {[c.cols.cls, c.cols.subject, c.cols.medium, c.cols.chapters, c.cols.linked, c.cols.questions, c.cols.status, ""].map((h, i) => (
                    <th key={i} scope="col" className="py-2 pr-3 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={`${r.subjectId}-${r.medium}`} className="border-t border-line">
                    <td className="py-2 pr-3 tabular-nums">{r.standard}</td>
                    <td className="py-2 pr-3 font-medium">
                      <Link href={`/admin/practice/${r.subjectId}`} className={`rounded underline-offset-2 hover:underline ${FOCUS}`}>
                        {r.name[locale] || r.name.en}
                      </Link>
                    </td>
                    <td className="py-2 pr-3">{r.medium ? c.medium[r.medium] : c.single}</td>
                    <td className="py-2 pr-3 tabular-nums">{r.chapters}</td>
                    <td className={`py-2 pr-3 tabular-nums ${r.linked < r.chapters ? "text-amber-400" : ""}`}>{c.partly(r.linked, r.chapters)}</td>
                    <td className="py-2 pr-3 tabular-nums">{r.items.toLocaleString()}</td>
                    <td className={`py-2 pr-3 ${r.published === r.chapters ? "text-success" : r.published ? "" : "text-muted"}`}>
                      {r.published === r.chapters ? c.yes : r.published ? c.partly(r.published, r.chapters) : c.no}
                    </td>
                    <td className="py-2">
                      {r.published === r.chapters ? (
                        <button type="button" disabled={busy} onClick={() => toggle(r, false)} className={`${BTN_SECONDARY} min-h-9 px-3`}>
                          <EyeSlash size={14} aria-hidden /> {c.unpublish}
                        </button>
                      ) : (
                        <button type="button" disabled={busy} onClick={() => toggle(r, true)} className={`${BTN_PRIMARY} min-h-9 px-3`}>
                          <Eye size={14} aria-hidden /> {c.publish}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}

type AdminChapter = {
  id: number;
  medium: Medium | null;
  book: string | null;
  term: number | null;
  number: number;
  title: string;
  appChapterId: string | null;
  manual: boolean;
  status: "draft" | "published";
  sets: number;
  items: number;
};

export function PracticeSubjectAdmin({
  subjectId,
  name,
  appChapters,
  chapters,
}: {
  subjectId: string;
  name: Localized;
  appChapters: { id: string; chapterNumber: number; title: Localized }[];
  chapters: AdminChapter[];
}) {
  const { locale } = useLocale();
  const c = COPY[locale];
  const router = useRouter();
  const [busy, start] = useTransition();
  const link = (id: number, value: string) =>
    start(async () => {
      await linkPracticeAction(id, value || null);
      router.refresh();
    });

  return (
    <>
      <Link href="/admin/practice" className={`inline-flex min-h-11 w-fit items-center gap-2 rounded-lg text-sm text-muted hover:text-text ${FOCUS}`}>
        <ArrowLeft size={16} aria-hidden /> {c.back}
      </Link>
      <PageHeader
        title={name[locale] || name.en}
        lead={c.linkLead}
        actions={
          <Link href={`/practice?subject=${subjectId}`} className={BTN_SECONDARY}>
            {c.preview} <ArrowSquareOut size={14} aria-hidden />
          </Link>
        }
      />
      <Card>
        <ol className="flex flex-col divide-y divide-line">
          {chapters.map((ch) => (
            <li key={ch.id} className="flex flex-wrap items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  <span className="mr-1 text-violet tabular-nums">{ch.number}.</span> {ch.title}
                </p>
                <p className="text-xs text-muted">
                  {[ch.medium ? c.medium[ch.medium] : c.single, ch.term ? `Term ${ch.term}` : null, ch.book, c.sets(ch.sets, ch.items), ch.status === "published" ? c.yes : null].filter(Boolean).join(" · ")}
                </p>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <span className="text-xs text-muted">
                  {c.link}
                  {ch.manual ? ` (${c.manual})` : ""}
                </span>
                {/* Keyed by the saved link, so it shows the saved value after a refresh. */}
                <select key={ch.appChapterId ?? "none"} defaultValue={ch.appChapterId ?? ""} disabled={busy} onChange={(e) => link(ch.id, e.target.value)} className={`${INPUT} max-w-[22rem]`}>
                  <option value="">{c.notLinked}</option>
                  {appChapters.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.chapterNumber}. {a.title[locale] || a.title.en}
                    </option>
                  ))}
                </select>
              </label>
            </li>
          ))}
        </ol>
      </Card>
    </>
  );
}
