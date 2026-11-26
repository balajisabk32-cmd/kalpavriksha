"use client";

import {
  ArrowRight,
  Atom,
  BookOpenText,
  CaretRight,
  ChartLineUp,
  CheckCircle,
  Code,
  Dna,
  Flask,
  GlobeHemisphereEast,
  IdentificationCard,
  ListChecks,
  MathOperations,
  PencilSimple,
  TestTube,
  Translate,
} from "@phosphor-icons/react/ssr";
import type { Icon } from "@phosphor-icons/react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useLocale } from "@/components/locale-provider";
import { useProgress } from "@/components/progress-store";
import type { Profile } from "@/lib/progress";
import { SENIOR_GROUPS, type ChapterOutline, type SubjectOutline } from "@/lib/curriculum";
import { ReviewHub } from "./review-hub";

interface SeniorDigitalLearningProps {
  currentStandard: number;
  subjects: readonly SubjectOutline[];
  allFlatChapters: Array<{ subject: SubjectOutline; chapter: ChapterOutline }>;
  filter: string;
  setFilter: (f: string) => void;
  onOpenChapter: (chapterId: string) => void;
  onOpenStandardSwitcher?: () => void;
  onSelectStandard?: (std: number) => void;
  continueRecord: { subject: SubjectOutline; chapter: ChapterOutline; isStarter: boolean } | null;
  totalChapters: number;
  completedChaptersCount: number;
  seniorGroupFilter?: string;
  onSelectSeniorGroup?: (group: string) => void;
  profile?: Profile;
}

const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet focus-visible:ring-offset-2 focus-visible:ring-offset-bg";

const SUBJECT_ICON: Record<SubjectOutline["icon"], Icon> = {
  tamil: Translate,
  english: Translate,
  math: MathOperations,
  science: Flask,
  social: GlobeHemisphereEast,
  physics: Atom,
  chemistry: TestTube,
  biology: Dna,
  computer: Code,
  commerce: ChartLineUp,
};

const COPY = {
  en: {
    hello: (n: string) => `Vanakkam, ${n}`,
    klass: (n: number) => `Class ${n}`,
    changeClass: "Change class",
    continueTitle: "Continue where you stopped",
    startTitle: "Start here",
    chapterOf: (n: number, t: string) => `Chapter ${n}: ${t}`,
    continue: "Continue",
    start: "Start",
    done: (d: number, t: number) => `${d} of ${t} chapters done`,
    exercises: "Exercises & solutions",
    exercisesHint: "Every sum, step by step",
    card: "My learner card",
    cardHint: "Your profile and progress",
    subjects: "Subjects",
    chapters: (n: number) => `${n} chapters`,
    minutes: (n: number) => `${n} min`,
    questions: (n: number) => `${n} questions`,
    finished: "Done",
    empty: "No chapters here yet.",
  },
  ta: {
    hello: (n: string) => `வணக்கம், ${n}`,
    klass: (n: number) => `வகுப்பு ${n}`,
    changeClass: "வகுப்பை மாற்று",
    continueTitle: "நிறுத்திய இடத்திலிருந்து தொடருங்கள்",
    startTitle: "இங்கே தொடங்குங்கள்",
    chapterOf: (n: number, t: string) => `பாடம் ${n}: ${t}`,
    continue: "தொடர்",
    start: "தொடங்கு",
    done: (d: number, t: number) => `${t} பாடங்களில் ${d} முடிந்தது`,
    exercises: "பயிற்சிகளும் தீர்வுகளும்",
    exercisesHint: "ஒவ்வொரு கணக்கும் படிப்படியாக",
    card: "என் கற்றல் அட்டை",
    cardHint: "உங்கள் சுயவிவரமும் முன்னேற்றமும்",
    subjects: "பாடப்பிரிவுகள்",
    chapters: (n: number) => `${n} பாடங்கள்`,
    minutes: (n: number) => `${n} நிமி`,
    questions: (n: number) => `${n} வினாக்கள்`,
    finished: "முடிந்தது",
    empty: "இங்கே இன்னும் பாடங்கள் இல்லை.",
  },
} as const;

/** The student's Digital Learning home: carry on, review, then every subject and chapter of their class. */
export function SeniorDigitalLearning({
  currentStandard,
  subjects,
  onOpenChapter,
  onOpenStandardSwitcher,
  continueRecord,
  totalChapters,
  completedChaptersCount,
  seniorGroupFilter,
  profile,
}: SeniorDigitalLearningProps) {
  const { locale } = useLocale();
  const c = COPY[locale];
  const progress = useProgress();
  const done = useMemo(() => new Set(progress.lessonsDone), [progress.lessonsDone]);
  const [picked, setPicked] = useState<string | null>(null);
  const activeId = picked && subjects.some((s) => s.id === picked) ? picked : (continueRecord?.subject.id ?? subjects[0]?.id ?? null);
  const active = subjects.find((s) => s.id === activeId) ?? null;
  const stream = currentStandard >= 11 ? SENIOR_GROUPS.find((g) => g.id === seniorGroupFilter) : undefined;
  const name = (profile?.name ?? progress.profile?.name ?? "").split(" ")[0] || "";
  const pct = totalChapters > 0 ? Math.round((completedChaptersCount / totalChapters) * 100) : 0;

  return (
    <div className="flex flex-col gap-8">
      {/* Greeting */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-headline text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">{name ? c.hello(name) : c.klass(currentStandard)}</h1>
          <p className="mt-1 text-muted">
            {[c.klass(currentStandard), stream?.name[locale] ?? stream?.badge].filter(Boolean).join(" · ")}
          </p>
        </div>
        {onOpenStandardSwitcher && (
          <button type="button" onClick={onOpenStandardSwitcher} className={`inline-flex min-h-11 items-center gap-2 rounded-xl border border-line-strong px-4 text-sm font-semibold transition-colors duration-150 hover:bg-surface-2 ${FOCUS}`}>
            <PencilSimple size={16} aria-hidden /> {c.changeClass}
          </button>
        )}
      </div>

      {/* Continue + shortcuts */}
      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        {continueRecord ? (
          <section aria-labelledby="continue-title" className="flex flex-col gap-5 rounded-2xl border border-line bg-surface p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p id="continue-title" className="text-sm font-medium text-muted">
                  {continueRecord.isStarter ? c.startTitle : c.continueTitle}
                </p>
                <p className="mt-2 text-sm font-semibold text-violet">{continueRecord.subject.name[locale]}</p>
                <h2 className="mt-0.5 font-headline text-xl font-semibold leading-snug sm:text-2xl">
                  {c.chapterOf(continueRecord.chapter.chapterNumber, continueRecord.chapter.title[locale])}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => onOpenChapter(continueRecord.chapter.id)}
                className={`inline-flex min-h-12 shrink-0 items-center gap-2 rounded-xl bg-violet px-5 font-semibold text-white transition-[background-color,transform] duration-150 hover:bg-violet/90 active:scale-[0.98] dark:text-[#120e1f] ${FOCUS}`}
              >
                {continueRecord.isStarter ? c.start : c.continue} <ArrowRight size={18} weight="bold" aria-hidden />
              </button>
            </div>
            <div>
              <div className="h-2 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={c.done(completedChaptersCount, totalChapters)}>
                <div className="h-full rounded-full bg-success transition-[width] duration-500" style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-2 text-sm text-muted tabular-nums">{c.done(completedChaptersCount, totalChapters)}</p>
            </div>
          </section>
        ) : (
          <div />
        )}
        <nav aria-label={c.exercises} className="flex flex-col divide-y divide-line rounded-2xl border border-line bg-surface">
          {(
            [
              ["/practice", ListChecks, c.exercises, c.exercisesHint],
              ["/me", IdentificationCard, c.card, c.cardHint],
            ] as const
          ).map(([href, Ico, label, hint]) => (
            <Link key={href} href={href} className={`group flex flex-1 items-center gap-3 px-5 py-4 transition-colors duration-150 first:rounded-t-2xl last:rounded-b-2xl hover:bg-surface-2 ${FOCUS}`}>
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-violet-deep text-violet-ink">
                <Ico size={20} weight="duotone" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{label}</span>
                <span className="block text-sm text-muted">{hint}</span>
              </span>
              <CaretRight size={18} className="text-muted transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden />
            </Link>
          ))}
        </nav>
      </div>

      {currentStandard >= 4 && <ReviewHub />}

      {/* Subjects and their chapters */}
      <section aria-labelledby="subjects-title" className="flex flex-col gap-4">
        <h2 id="subjects-title" className="font-headline text-2xl font-semibold tracking-[-0.02em]">
          {c.subjects}
        </h2>
        <div role="tablist" aria-label={c.subjects} className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
          {subjects.map((s) => {
            const Ico = SUBJECT_ICON[s.icon] ?? BookOpenText;
            const selected = s.id === activeId;
            const finished = s.chapters.filter((ch) => done.has(ch.id)).length;
            return (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls="chapter-list"
                onClick={() => setPicked(s.id)}
                className={`flex min-h-[5.5rem] flex-col items-start justify-between gap-2 rounded-xl border p-3.5 text-left transition-colors duration-150 ${FOCUS} ${
                  selected ? "border-violet bg-violet-deep/60" : "border-line bg-surface hover:border-line-strong hover:bg-surface-2"
                }`}
              >
                <Ico size={22} weight={selected ? "fill" : "duotone"} className="text-violet" aria-hidden />
                <span className="w-full">
                  <span className="block font-semibold leading-tight">{s.name[locale]}</span>
                  <span className="mt-0.5 block text-xs text-muted tabular-nums">{finished ? `${finished}/${s.chapters.length}` : c.chapters(s.chapters.length)}</span>
                </span>
              </button>
            );
          })}
        </div>

        <div id="chapter-list" role="tabpanel" aria-label={active?.name[locale]} className="overflow-hidden rounded-2xl border border-line bg-surface">
          {active?.chapters.length ? (
            <ol className="divide-y divide-line">
              {active.chapters.map((ch) => {
                const isDone = done.has(ch.id);
                return (
                  <li key={ch.id}>
                    <button
                      type="button"
                      onClick={() => onOpenChapter(ch.id)}
                      className={`group flex w-full items-center gap-4 px-4 py-4 text-left transition-colors duration-150 hover:bg-surface-2 sm:px-5 ${FOCUS} focus-visible:ring-inset focus-visible:ring-offset-0`}
                    >
                      <span
                        className={`grid size-10 shrink-0 place-items-center rounded-full text-sm font-semibold tabular-nums ${isDone ? "bg-success/15 text-success" : "bg-surface-2 text-muted"}`}
                      >
                        {isDone ? <CheckCircle size={22} weight="fill" aria-label={c.finished} /> : ch.chapterNumber}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold leading-snug">{ch.title[locale]}</span>
                        <span className="mt-0.5 block truncate text-sm text-muted">{ch.summary[locale]}</span>
                      </span>
                      <span className="hidden shrink-0 text-right text-xs text-muted tabular-nums sm:block">
                        {c.minutes(ch.estimatedMinutes)}
                        {ch.questionCount > 0 && <span className="block">{c.questions(ch.questionCount)}</span>}
                      </span>
                      <CaretRight size={18} className="shrink-0 text-muted transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden />
                    </button>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="p-6 text-muted">{c.empty}</p>
          )}
        </div>
      </section>
    </div>
  );
}
