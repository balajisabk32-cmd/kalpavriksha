"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, BookmarkSimple, CalendarCheck, CheckCircle, X } from "@phosphor-icons/react/ssr";
import { useLocale } from "@/components/locale-provider";
import { useProgress } from "@/components/progress-store";
import { DAILY_REVIEW_SIZE, XP, dueReviews, localDay, mistakes } from "@/lib/progress";
import { prefetchChapter, useChapterDetail } from "@/lib/curriculum-client";
import { HintedQuestion } from "./hinted-question";
import { lifeLinksFor } from "./life-link";

const COPY = {
  en: {
    panelTitle: "Remember what you learned",
    panelSub: "A few minutes a day stops you forgetting.",
    dueMeter: (n: number) => `${n} of 5 due today`,
    dailyTitle: "Daily 5",
    dailyDue: (n: number) => `${n} question${n === 1 ? "" : "s"} ready to review today`,
    dailyNone: "All caught up for today. Come back tomorrow!",
    dailyEmpty: "Answer practice questions in any chapter — they come back here a few days later so you don't forget.",
    start: "Start review",
    mistakesTitle: "My mistakes",
    mistakesSome: (n: number) => `${n} question${n === 1 ? "" : "s"} to fix`,
    mistakesNone: "No mistakes waiting. Wrong answers land here so you can try them again.",
    practise: "Practise mistakes",
    sessionDaily: "Daily 5 review",
    sessionMistakes: "Mistake practice",
    of: "of",
    next: "Next question",
    finish: "Finish",
    close: "Close",
    doneTitle: "Review done!",
    doneScore: (right: number, total: number) => `${right} of ${total} right on the first try`,
    doneXp: (xp: number) => `+${xp} XP`,
    doneNote: "Right answers come back later and later. Wrong ones come back tomorrow.",
    missing: "This question is no longer in the syllabus. Skip it.",
    loading: "Loading question…",
    offline: "Couldn't load this question. Check the internet connection.",
    retry: "Try again",
    classLabel: "Class",
  },
  ta: {
    panelTitle: "கற்றதை நினைவில் வையுங்கள்",
    panelSub: "தினமும் சில நிமிடங்கள் — மறதி இல்லை.",
    dueMeter: (n: number) => `இன்று 5-இல் ${n} தயார்`,
    dailyTitle: "தினசரி 5",
    dailyDue: (n: number) => `இன்று மீள்பார்வைக்கு ${n} ${n === 1 ? "வினா" : "வினாக்கள்"} தயார்`,
    dailyNone: "இன்றைய மீள்பார்வை முடிந்தது. நாளை வாருங்கள்!",
    dailyEmpty: "எந்தப் பாடத்திலும் பயிற்சி வினாக்களுக்குப் பதிலளியுங்கள் — மறக்காமல் இருக்க அவை சில நாள்கள் கழித்து இங்கே மீண்டும் வரும்.",
    start: "மீள்பார்வை தொடங்கு",
    mistakesTitle: "என் தவறுகள்",
    mistakesSome: (n: number) => `சரி செய்ய ${n} ${n === 1 ? "வினா" : "வினாக்கள்"}`,
    mistakesNone: "தவறுகள் எதுவும் இல்லை. தவறான விடைகள் மீண்டும் முயல இங்கே வரும்.",
    practise: "தவறுகளைப் பயிற்சி செய்",
    sessionDaily: "தினசரி 5 மீள்பார்வை",
    sessionMistakes: "தவறுகள் பயிற்சி",
    of: "/",
    next: "அடுத்த வினா",
    finish: "முடி",
    close: "மூடு",
    doneTitle: "மீள்பார்வை முடிந்தது!",
    doneScore: (right: number, total: number) => `${total} வினாக்களில் ${right} முதல் முயற்சியிலேயே சரி`,
    doneXp: (xp: number) => `+${xp} XP`,
    doneNote: "சரியான விடைகள் இன்னும் தாமதமாக மீண்டும் வரும். தவறானவை நாளை வரும்.",
    missing: "இந்த வினா பாடத்திட்டத்தில் இப்போது இல்லை. தவிர்த்து விடுங்கள்.",
    loading: "வினா ஏற்றப்படுகிறது…",
    offline: "வினாவை ஏற்ற முடியவில்லை. இணைய இணைப்பைச் சரிபாருங்கள்.",
    retry: "மீண்டும் முயல்",
    classLabel: "வகுப்பு",
  },
} as const;

type SessionKind = "daily" | "mistakes";
/** A question to review and the chapter it lives in (the chapter is fetched on demand). */
type ReviewRef = { readonly id: string; readonly chapterId: string };

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet focus-visible:ring-offset-2 focus-visible:ring-offset-surface";
const PRIMARY = `inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-purple-600 px-4 py-2 font-display text-sm font-semibold text-white shadow-sm transition-[background-color,transform,opacity] duration-150 hover:bg-purple-700 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 ${FOCUS}`;
const SECONDARY = `inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-line px-4 py-2 font-display text-sm font-semibold text-text transition-[background-color,border-color,transform,opacity] duration-150 hover:border-violet/60 hover:bg-violet/[0.06] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 ${FOCUS}`;

/**
 * The two "Remember" tools on the Learn dashboard: the Daily 5 spaced review and
 * the mistake notebook. Both are built from practice questions the student has
 * already answered in chapters (see `recordAnswer` in lib/progress.ts).
 * Daily 5 is the one focal action; the notebook is deliberately secondary.
 */
export function ReviewHub() {
  const { locale } = useLocale();
  const progress = useProgress();
  const copy = COPY[locale];
  const today = localDay();
  const [session, setSession] = useState<{ kind: SessionKind; items: ReviewRef[] } | null>(null);
  const refs = (ids: readonly string[]): ReviewRef[] =>
    ids.flatMap((id) => {
      const item = progress.review[id];
      return item ? [{ id, chapterId: item.chapterId }] : [];
    });

  const due = useMemo(() => dueReviews(progress, today), [progress, today]);
  const fix = useMemo(() => mistakes(progress), [progress]);
  const hasAny = Object.keys(progress.review).length > 0;

  return (
    <section
      aria-labelledby="review-hub-title"
      className="rounded-3xl border border-line bg-surface/75 p-5 text-text shadow-sm backdrop-blur-md sm:p-6"
    >
      <header className="mb-4">
        <h2 id="review-hub-title" className="font-display text-lg font-semibold">
          {copy.panelTitle}
        </h2>
        <p className="text-sm text-muted">{copy.panelSub}</p>
      </header>

      <div className="grid gap-3 sm:grid-cols-[1.4fr_1fr]">
        {/* Daily 5: the focal action */}
        <div className="flex flex-col gap-4 rounded-2xl border border-violet/30 bg-violet/[0.07] p-4">
          <div className="flex items-start gap-3">
            <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-xl bg-purple-600 text-white">
              <CalendarCheck size={20} weight="fill" />
            </span>
            <div className="min-w-0">
              <h3 className="font-display text-base font-semibold">{copy.dailyTitle}</h3>
              <p className="text-sm text-muted">
                {due.length > 0 ? copy.dailyDue(due.length) : hasAny ? copy.dailyNone : copy.dailyEmpty}
              </p>
            </div>
          </div>
          <div className="mt-auto flex flex-wrap items-center justify-between gap-3">
            <div role="img" aria-label={copy.dueMeter(due.length)} className="flex gap-1.5">
              {Array.from({ length: DAILY_REVIEW_SIZE }, (_, i) => (
                <span key={i} className={`size-2.5 rounded-full ${i < due.length ? "bg-violet" : "bg-line"}`} />
              ))}
            </div>
            <button
              type="button"
              disabled={due.length === 0}
              className={PRIMARY}
              onClick={() => setSession({ kind: "daily", items: refs(due) })}
            >
              {copy.start} <ArrowRight size={14} weight="bold" aria-hidden />
            </button>
          </div>
        </div>

        {/* Mistake notebook: secondary */}
        <div className="flex flex-col gap-4 rounded-2xl border border-line bg-bg/30 p-4">
          <div className="flex items-start gap-3">
            <span aria-hidden className="relative grid size-10 shrink-0 place-items-center rounded-xl bg-pink/15 text-pink">
              <BookmarkSimple size={20} weight="fill" />
              {fix.length > 0 && (
                <span className="absolute -right-1.5 -top-1.5 grid min-w-5 place-items-center rounded-full bg-pink px-1 font-mono text-[11px] font-semibold text-white">
                  {fix.length}
                </span>
              )}
            </span>
            <div className="min-w-0">
              <h3 className="font-display text-base font-semibold">{copy.mistakesTitle}</h3>
              <p className="text-sm text-muted">{fix.length > 0 ? copy.mistakesSome(fix.length) : copy.mistakesNone}</p>
            </div>
          </div>
          <div className="mt-auto flex justify-end">
            <button
              type="button"
              disabled={fix.length === 0}
              className={SECONDARY}
              onClick={() => setSession({ kind: "mistakes", items: refs(fix.slice(0, 10)) })}
            >
              {copy.practise} <ArrowRight size={14} weight="bold" aria-hidden />
            </button>
          </div>
        </div>
      </div>

      {session && <ReviewSession kind={session.kind} items={session.items} onClose={() => setSession(null)} />}
    </section>
  );
}

function ReviewSession({ kind, items, onClose }: { kind: SessionKind; items: readonly ReviewRef[]; onClose: () => void }) {
  const { locale } = useLocale();
  const copy = COPY[locale];
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const [firstTry, setFirstTry] = useState<Record<string, boolean>>({});
  const [finishedStep, setFinishedStep] = useState(-1);
  const panelRef = useRef<HTMLDivElement>(null);
  const title = kind === "daily" ? copy.sessionDaily : copy.sessionMistakes;

  // Escape closes; focus moves into the dialog, and back to the opener on close.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      opener?.focus?.();
    };
  }, [onClose]);

  const item = items[step];
  const chapter = useChapterDetail(item?.chapterId);
  const question =
    chapter.status === "ready" ? chapter.data.chapter.practiceQuestions?.find((q) => q.id === item?.id) : undefined;
  const missing = !item || (chapter.status === "ready" && !question);
  const isLast = step >= items.length - 1;
  const right = Object.values(firstTry).filter(Boolean).length;
  const answered = finishedStep >= step || missing || chapter.status === "error";
  const progressPct = ((step + (answered ? 1 : 0)) / items.length) * 100;

  // Fetch the next question's chapter while this one is being answered.
  const nextChapterId = items[step + 1]?.chapterId;
  useEffect(() => {
    if (nextChapterId) prefetchChapter(nextChapterId);
  }, [nextChapterId]);

  const next = () => {
    if (isLast) setDone(true);
    else setStep((s) => s + 1);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto overscroll-contain bg-black/70 p-3 sm:items-center sm:p-6"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className="relative my-auto flex w-full max-w-2xl flex-col gap-4 rounded-3xl border border-line bg-surface p-5 text-text shadow-2xl outline-none sm:p-7"
      >
        <header className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-pink">{title}</p>
            {!done && (
              <p className="font-display text-base font-semibold">
                {step + 1} <span className="text-muted">{copy.of} {items.length}</span>
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={copy.close}
            className={`grid size-10 place-items-center rounded-xl border border-line text-muted transition-colors hover:text-text ${FOCUS}`}
          >
            <X size={16} aria-hidden />
          </button>
        </header>

        {!done && (
          <div
            role="progressbar"
            aria-label={title}
            aria-valuemin={0}
            aria-valuemax={items.length}
            aria-valuenow={step + (answered ? 1 : 0)}
            className="h-1.5 w-full overflow-hidden rounded-full bg-line"
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet to-pink transition-[width] duration-300 motion-reduce:transition-none"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        )}

        {done ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <CheckCircle size={52} weight="fill" className="text-success" aria-hidden />
            <h3 className="font-display text-xl font-semibold">{copy.doneTitle}</h3>
            <p className="text-sm">{copy.doneScore(right, Object.keys(firstTry).length)}</p>
            <p className="rounded-full bg-amber/15 px-3 py-1 font-mono text-sm font-semibold text-amber">
              {copy.doneXp(right * XP.reviewCorrect)}
            </p>
            <p className="max-w-sm text-sm text-muted">{copy.doneNote}</p>
            <button type="button" onClick={onClose} className={`${PRIMARY} mt-3`}>
              {copy.close}
            </button>
          </div>
        ) : chapter.status === "loading" && !missing ? (
          <div role="status" aria-busy="true" className="flex flex-col gap-3">
            <span className="sr-only">{copy.loading}</span>
            <div className="h-3 w-2/3 animate-pulse rounded-full bg-line motion-reduce:animate-none" />
            <div className="h-28 animate-pulse rounded-2xl bg-line/60 motion-reduce:animate-none" />
          </div>
        ) : chapter.status === "error" ? (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-danger/40 bg-danger/[0.06] p-4 text-sm">
            <span>{copy.offline}</span>
            <button type="button" onClick={chapter.retry} className={SECONDARY}>
              {copy.retry}
            </button>
          </div>
        ) : chapter.status === "ready" && question ? (
          <>
            <p className="text-xs text-muted">
              {copy.classLabel} {chapter.data.standard} · {chapter.data.subject.name[locale]} ·{" "}
              {chapter.data.chapter.title[locale] || chapter.data.chapter.title.en}
            </p>
            <HintedQuestion
              key={question.id}
              question={question}
              chapterId={chapter.data.chapter.id}
              lifeLinks={lifeLinksFor(chapter.data.chapter.id)}
              fromReview
              onFirstAnswer={(correct) => setFirstTry((m) => ({ ...m, [question.id]: correct }))}
              onDone={() => setFinishedStep(step)}
            />
          </>
        ) : (
          <p className="rounded-xl border border-dashed border-line p-4 text-sm text-muted">{copy.missing}</p>
        )}

        {!done && (
          <div className="flex justify-end">
            <button type="button" disabled={!answered} onClick={next} className={PRIMARY}>
              {isLast ? copy.finish : copy.next} <ArrowRight size={14} weight="bold" aria-hidden />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
