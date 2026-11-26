"use client";

import { ArrowLeft, ArrowRight, BookmarkSimple, CheckCircle, Clock, Minus, Plus, X } from "@phosphor-icons/react/ssr";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale } from "@/components/locale-provider";
import { updateProgress, useProgress } from "@/components/progress-store";
import type { ChapterRef, CurriculumChapter, SubjectMeta } from "@/lib/curriculum";
import { completeLesson, localDay, setLastAccessed } from "@/lib/progress";
import { LessonMedia } from "@/modules/learn/lesson-media";
import { LessonExercises } from "@/modules/practice/lesson-exercises";
import { lifeLinksFor } from "./life-link";
import { LifeLinkCard } from "./life-link-card";

const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet focus-visible:ring-offset-2 focus-visible:ring-offset-bg";
const ICON_BTN = `grid size-11 place-items-center rounded-xl text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-text disabled:opacity-40 disabled:hover:bg-transparent ${FOCUS}`;
/** Reading size steps (CSS zoom on the content, so every part grows together). */
const SIZES = [1, 1.12, 1.25] as const;

const COPY = {
  en: {
    back: "Back to subjects",
    klass: (n: number) => `Class ${n}`,
    chapter: (n: number) => `Chapter ${n}`,
    minutes: (n: number) => `About ${n} min`,
    smaller: "Smaller text",
    larger: "Larger text",
    bookmark: "Save this chapter",
    bookmarked: "Saved",
    close: "Close chapter",
    lifeTitle: "Where you see this in real life",
    doneTitle: "Finished this chapter?",
    doneBody: "Mark it done when you have read the explanation and tried the exercises.",
    markDone: "Mark as done",
    isDone: "Chapter done",
    previous: "Previous chapter",
    next: "Next chapter",
  },
  ta: {
    back: "பாடப்பிரிவுகளுக்குத் திரும்பு",
    klass: (n: number) => `வகுப்பு ${n}`,
    chapter: (n: number) => `பாடம் ${n}`,
    minutes: (n: number) => `சுமார் ${n} நிமி`,
    smaller: "எழுத்தைச் சிறிதாக்கு",
    larger: "எழுத்தைப் பெரிதாக்கு",
    bookmark: "இந்தப் பாடத்தைச் சேமி",
    bookmarked: "சேமிக்கப்பட்டது",
    close: "பாடத்தை மூடு",
    lifeTitle: "அன்றாட வாழ்வில் இது எங்கே",
    doneTitle: "இந்தப் பாடம் முடிந்ததா?",
    doneBody: "விளக்கத்தைப் படித்து, பயிற்சிகளை முயன்ற பிறகு முடிந்ததாகக் குறியுங்கள்.",
    markDone: "முடிந்தது எனக் குறி",
    isDone: "பாடம் முடிந்தது",
    previous: "முந்தைய பாடம்",
    next: "அடுத்த பாடம்",
  },
} as const;

const BOOKMARKS = "kalpa_bookmarks";
const SIZE_KEY = "kalpa_reading_size";

function readBookmarks(): string[] {
  try {
    const list = JSON.parse(localStorage.getItem(BOOKMARKS) || "[]");
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/**
 * One chapter, as one page to read top to bottom: the explanation, videos and
 * textbook pages, then the exercises and quiz, then marking it done.
 */
export function InteractiveChapterClassroom({
  standard,
  subject,
  chapter,
  allChapters,
  onClose,
  onSelectChapter,
}: {
  standard: number;
  subject: SubjectMeta | null;
  chapter: CurriculumChapter | null;
  allChapters: readonly ChapterRef[];
  onClose: () => void;
  onSelectChapter: (chapterId: string) => void;
}) {
  const { locale } = useLocale();
  const c = COPY[locale];
  const progress = useProgress();
  const [size, setSize] = useState(() => {
    try {
      const s = Number(localStorage.getItem(SIZE_KEY));
      return s >= 0 && s < SIZES.length ? s : 0;
    } catch {
      return 0;
    }
  });
  // Bookmarks live on this device; `savedTick` re-reads them after a change.
  const [savedTick, setSavedTick] = useState(0);
  const saved = useMemo(() => (chapter ? readBookmarks().includes(chapter.id) : false), [chapter, savedTick]); // eslint-disable-line react-hooks/exhaustive-deps
  const scroller = useRef<HTMLDivElement>(null);
  const isDone = chapter ? progress.lessonsDone.includes(chapter.id) : false;
  const lifeLinks = useMemo(() => (chapter ? lifeLinksFor(chapter.id) : []), [chapter]);

  // While open, the module page underneath is hidden (globals.css), and Escape closes.
  useEffect(() => {
    if (!chapter) return;
    const root = document.documentElement;
    root.dataset.overlay = "open";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      delete root.dataset.overlay;
      window.removeEventListener("keydown", onKey);
    };
  }, [chapter, onClose]);

  // New chapter: back to the top, remember it as the place to continue, restore saved state.
  useEffect(() => {
    if (!chapter || !subject) return;
    scroller.current?.scrollTo({ top: 0 });
    updateProgress((p) => setLastAccessed(p, { standard, subjectId: subject.id, chapterId: chapter.id }));
  }, [chapter, subject, standard]);

  if (!chapter || !subject) return null;

  const index = allChapters.findIndex((r) => r.chapter.id === chapter.id);
  const prev = index > 0 ? allChapters[index - 1] : null;
  const next = index >= 0 && index < allChapters.length - 1 ? allChapters[index + 1] : null;
  const title = chapter.title[locale] || chapter.title.en;
  const summary = chapter.summary[locale] || chapter.summary.en;

  const changeSize = (d: number) => {
    const s = Math.min(SIZES.length - 1, Math.max(0, size + d));
    setSize(s);
    try {
      localStorage.setItem(SIZE_KEY, String(s));
    } catch {}
  };
  const toggleSaved = () => {
    const list = readBookmarks().filter((id) => id !== chapter.id);
    const nowSaved = !saved;
    try {
      localStorage.setItem(BOOKMARKS, JSON.stringify(nowSaved ? [...list, chapter.id] : list));
    } catch {}
    setSavedTick((t) => t + 1);
  };
  const markDone = () =>
    updateProgress((p) => setLastAccessed(completeLesson(p, chapter.id, localDay()), { standard, subjectId: subject.id, chapterId: chapter.id }));

  return (
    <div ref={scroller} role="dialog" aria-modal="true" aria-label={title} className="visible fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-bg text-text">
      <header className="sticky top-0 z-10 border-b border-line bg-bg/95 backdrop-blur supports-[backdrop-filter]:bg-bg/85">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between gap-2 px-3 sm:px-6">
          <button type="button" onClick={onClose} className={`flex min-h-11 min-w-0 items-center gap-2 rounded-xl px-2 text-sm font-semibold transition-colors duration-150 hover:bg-surface-2 ${FOCUS}`}>
            <ArrowLeft size={18} className="shrink-0" aria-hidden />
            <span className="truncate">
              <span className="sr-only">{c.back}: </span>
              {c.klass(standard)} · {subject.name[locale]}
            </span>
          </button>
          <div className="flex shrink-0 items-center gap-0.5">
            <button type="button" onClick={() => changeSize(-1)} disabled={size === 0} aria-label={c.smaller} title={c.smaller} className={ICON_BTN}>
              <Minus size={16} weight="bold" aria-hidden />
            </button>
            <span aria-hidden className="w-6 text-center text-sm font-semibold">
              A
            </span>
            <button type="button" onClick={() => changeSize(1)} disabled={size === SIZES.length - 1} aria-label={c.larger} title={c.larger} className={ICON_BTN}>
              <Plus size={16} weight="bold" aria-hidden />
            </button>
            <button type="button" onClick={toggleSaved} aria-pressed={saved} aria-label={saved ? c.bookmarked : c.bookmark} title={saved ? c.bookmarked : c.bookmark} className={ICON_BTN}>
              <BookmarkSimple size={20} weight={saved ? "fill" : "regular"} className={saved ? "text-violet" : undefined} aria-hidden />
            </button>
            <button type="button" onClick={onClose} aria-label={c.close} title={c.close} className={ICON_BTN}>
              <X size={20} aria-hidden />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-4xl flex-col gap-10 px-4 pb-16 pt-8 sm:px-6 sm:pt-12" style={{ zoom: SIZES[size] }}>
        <div>
          <p className="text-sm font-semibold text-violet">
            {subject.name[locale]} · {c.chapter(chapter.chapterNumber)}
          </p>
          <h1 className="mt-2 font-headline text-3xl font-semibold leading-tight tracking-[-0.02em] text-balance sm:text-[2.5rem]">{title}</h1>
          {summary && <p className="mt-3 max-w-[65ch] text-[17px] leading-relaxed text-muted">{summary}</p>}
          <p className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted">
            <span className="inline-flex items-center gap-1.5">
              <Clock size={16} aria-hidden /> {c.minutes(chapter.estimatedMinutes)}
            </span>
            {isDone && (
              <span className="inline-flex items-center gap-1.5 font-semibold text-success">
                <CheckCircle size={16} weight="fill" aria-hidden /> {c.isDone}
              </span>
            )}
          </p>
        </div>

        <LessonMedia key={chapter.id} chapterId={chapter.id} />
        <LessonExercises key={`ex-${chapter.id}`} chapterId={chapter.id} />

        {lifeLinks.length > 0 && (
          <section aria-labelledby="life-title" className="flex flex-col gap-4">
            <h2 id="life-title" className="font-headline text-2xl font-semibold tracking-[-0.02em]">
              {c.lifeTitle}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {lifeLinks.map((l) => (
                <LifeLinkCard key={l.id} concept={l} />
              ))}
            </div>
          </section>
        )}

        <section aria-labelledby="done-title" className="flex flex-col gap-4 rounded-2xl bg-surface-2 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <h2 id="done-title" className="text-lg font-semibold">
              {isDone ? c.isDone : c.doneTitle}
            </h2>
            {!isDone && <p className="mt-1 text-muted">{c.doneBody}</p>}
          </div>
          {isDone ? (
            <CheckCircle size={36} weight="fill" className="shrink-0 text-success" aria-hidden />
          ) : (
            <button type="button" onClick={markDone} className={`inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-violet px-5 font-semibold text-white transition-[background-color,transform] duration-150 hover:bg-violet/90 active:scale-[0.98] dark:text-[#120e1f] ${FOCUS}`}>
              <CheckCircle size={20} weight="bold" aria-hidden /> {c.markDone}
            </button>
          )}
        </section>

        {(prev || next) && (
          <nav aria-label={`${c.previous} / ${c.next}`} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {prev ? <ChapterLink dir="prev" label={c.previous} item={prev} onSelect={onSelectChapter} /> : <span className="hidden sm:block" />}
            {next && <ChapterLink dir="next" label={c.next} item={next} onSelect={onSelectChapter} />}
          </nav>
        )}
      </main>
    </div>
  );
}

function ChapterLink({ dir, label, item, onSelect }: { dir: "prev" | "next"; label: string; item: ChapterRef; onSelect: (id: string) => void }) {
  const { locale } = useLocale();
  const next = dir === "next";
  return (
    <button
      type="button"
      onClick={() => onSelect(item.chapter.id)}
      className={`group flex min-h-20 min-w-0 items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 text-left transition-colors duration-150 hover:border-line-strong hover:bg-surface-2 ${next ? "flex-row-reverse text-right sm:col-start-2" : ""} ${FOCUS}`}
    >
      {next ? (
        <ArrowRight size={20} className="shrink-0 text-muted transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden />
      ) : (
        <ArrowLeft size={20} className="shrink-0 text-muted transition-transform duration-150 group-hover:-translate-x-0.5" aria-hidden />
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-sm text-muted">{label}</span>
        <span className="block truncate font-semibold">
          {item.subject.name[locale]} · {item.chapter.title[locale] || item.chapter.title.en}
        </span>
      </span>
    </button>
  );
}
