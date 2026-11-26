"use client";

import { ArrowRight, CheckCircle, ListChecks } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useLocale } from "@/components/locale-provider";
import { ChapterQuiz } from "./chapter-quiz";
import { PRACTICE_COPY } from "./practice-screen";

type SetSummary = { id: number; kind: string; number: string; title: string; itemCount: number; done: number };
type Chapter = { id: number; book: string | null; number: number; title: string; sets: SetSummary[] };

const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet focus-visible:ring-offset-2 focus-visible:ring-offset-bg";

/** "Practise this chapter": the textbook exercises linked to a lesson. Hidden when there are none. */
export function LessonExercises({ chapterId }: { chapterId: string }) {
  const { locale } = useLocale();
  const c = PRACTICE_COPY[locale];
  const subjectId = chapterId.replace(/-ch\d+$/, "");
  const [chapters, setChapters] = useState<Chapter[] | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/practice?subject=${encodeURIComponent(subjectId)}&chapter=${encodeURIComponent(chapterId)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { chapters: [] }))
      .then((d: { chapters: Chapter[] }) => alive && setChapters(d.chapters))
      .catch(() => alive && setChapters([]));
    return () => {
      alive = false;
    };
  }, [chapterId, subjectId]);

  if (!chapters?.length) return null;
  const label = (s: SetSummary) => (s.kind === "exercise" ? `${c.kinds.exercise} ${s.number}` : s.kind === "unit" ? `${c.kinds.unit} ${s.number}` : s.kind === "bookback" && s.title !== "Book-back questions" ? s.title : (c.kinds[s.kind] ?? s.title));

  return (
    <section aria-labelledby={`ex-${chapterId}`} className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 id={`ex-${chapterId}`} className="flex items-center gap-2 font-display text-xl font-bold tracking-tight">
          <ListChecks size={22} aria-hidden className="text-violet" />
          {locale === "ta" ? "இந்தப் பாடத்தைப் பயிற்சி செய்" : "Practise this chapter"}
        </h2>
        <Link href={`/practice?subject=${subjectId}`} className={`inline-flex min-h-10 items-center gap-1 rounded-lg text-sm text-muted hover:text-text ${FOCUS}`}>
          {c.title} <ArrowRight size={14} aria-hidden />
        </Link>
      </div>
      <ChapterQuiz chapterId={chapterId} />
      {chapters.map((ch) => (
        <div key={ch.id}>
          {chapters.length > 1 && (
            <p className="mb-1.5 text-xs font-medium text-muted">
              {[ch.book, `${c.chapter(ch.number)}: ${ch.title}`].filter(Boolean).join(" · ")}
            </p>
          )}
          <ul className="flex flex-wrap gap-2">
            {ch.sets.map((s) => {
              const complete = s.itemCount > 0 && s.done >= s.itemCount;
              return (
                <li key={s.id}>
                  <Link
                    href={`/practice?set=${s.id}`}
                    className={`inline-flex min-h-11 items-center gap-2 rounded-xl border px-3.5 text-sm font-semibold transition-colors ${FOCUS} ${
                      complete ? "border-success/50 bg-success/10" : "border-line hover:border-violet/60 hover:bg-violet/[0.07]"
                    }`}
                  >
                    {complete && <CheckCircle size={16} weight="fill" className="text-success" aria-hidden />}
                    {label(s)}
                    <span className="text-xs font-normal text-muted tabular-nums">{s.done ? `${s.done}/${s.itemCount}` : c.questions(s.itemCount)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </section>
  );
}
