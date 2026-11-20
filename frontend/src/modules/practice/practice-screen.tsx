"use client";

import {
  ArrowLeft,
  ArrowRight,
  CaretDown,
  CheckCircle,
  Circle,
  Eye,
  Lightbulb,
  ListChecks,
  Question,
  Sparkle,
  XCircle,
} from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale } from "@/components/locale-provider";
import { useIsStaff, useSessionUser } from "@/components/session-user";
import type { PracticeItem, PracticeSection } from "@/lib/practice-parse";
import { PracticeMarkdown } from "./practice-markdown";

type Medium = "en" | "ta";
type State = "done" | "help" | "right" | "wrong";
type Localized = { en: string; ta: string };
type SetSummary = { id: number; kind: string; number: string; title: string; itemCount: number; mcqCount: number; done: number; help: number };
type ChapterSummary = { id: number; book: string | null; term: number | null; number: number; title: string; appChapterId: string | null; status: string; sets: SetSummary[] };

export const PRACTICE_COPY = {
  en: {
    title: "Exercises & solutions",
    lead: "Every exercise and book-back question from your textbook, with step-by-step answers.",
    classN: (n: number) => `Class ${n}`,
    medium: { en: "English medium", ta: "Tamil medium" },
    questions: (n: number) => `${n} questions`,
    done: (d: number, n: number) => `${d} of ${n} done`,
    chapters: (n: number) => `${n} chapters`,
    term: (n: number) => `Term ${n}`,
    chapter: (n: number) => `Chapter ${n}`,
    loading: "Loading…",
    failed: "Couldn't load. Check the internet connection.",
    retry: "Try again",
    none: "Exercises for this class are being added.",
    noneSubject: "Exercises for this subject are being added.",
    back: "Back",
    allSubjects: "All subjects",
    solution: "Solution",
    showSolution: "Show solution",
    showAnswer: "Show answer",
    nextStep: "Next step",
    showAll: "Show full solution",
    hide: "Hide",
    noAnswer: "No answer is given for this one — try it, then ask your teacher.",
    gotIt: "I got it",
    needHelp: "I need help",
    undo: "Undo",
    pick: "Choose an answer",
    correct: "Correct!",
    wrong: (k: string) => `Not quite — the answer is (${k}).`,
    filter: { all: "All", todo: "Not done", help: "Need help" },
    prev: "Previous",
    next: "Next",
    doneAll: "You finished this exercise!",
    draft: "Draft — students can't see this yet",
    kinds: { bookback: "Book-back", additional: "More practice", intext: "In-text", unit: "Unit exercise", misc: "Exercise", exercise: "Exercise" } as Record<string, string>,
  },
  ta: {
    title: "பயிற்சிகள் & தீர்வுகள்",
    lead: "உங்கள் பாடநூலின் எல்லாப் பயிற்சிகளும் புத்தக வினாக்களும், படிப்படியான விடைகளுடன்.",
    classN: (n: number) => `வகுப்பு ${n}`,
    medium: { en: "ஆங்கில வழி", ta: "தமிழ் வழி" },
    questions: (n: number) => `${n} வினாக்கள்`,
    done: (d: number, n: number) => `${n} இல் ${d} முடிந்தது`,
    chapters: (n: number) => `${n} பாடங்கள்`,
    term: (n: number) => `பருவம் ${n}`,
    chapter: (n: number) => `பாடம் ${n}`,
    loading: "ஏற்றப்படுகிறது…",
    failed: "ஏற்ற முடியவில்லை. இணைய இணைப்பைச் சரிபாருங்கள்.",
    retry: "மீண்டும் முயல்",
    none: "இந்த வகுப்புக்கான பயிற்சிகள் சேர்க்கப்பட்டு வருகின்றன.",
    noneSubject: "இந்தப் பாடத்துக்கான பயிற்சிகள் சேர்க்கப்பட்டு வருகின்றன.",
    back: "பின்செல்",
    allSubjects: "எல்லாப் பாடங்களும்",
    solution: "தீர்வு",
    showSolution: "தீர்வைக் காட்டு",
    showAnswer: "விடையைக் காட்டு",
    nextStep: "அடுத்த படி",
    showAll: "முழுத் தீர்வையும் காட்டு",
    hide: "மறை",
    noAnswer: "இதற்கு விடை தரப்படவில்லை — முயன்று பார்த்து, ஆசிரியரிடம் கேளுங்கள்.",
    gotIt: "புரிந்தது",
    needHelp: "உதவி வேண்டும்",
    undo: "மாற்று",
    pick: "ஒரு விடையைத் தேர்ந்தெடு",
    correct: "சரி!",
    wrong: (k: string) => `இல்லை — சரியான விடை (${k}).`,
    filter: { all: "எல்லாம்", todo: "முடிக்காதவை", help: "உதவி வேண்டியவை" },
    prev: "முந்தையது",
    next: "அடுத்தது",
    doneAll: "இந்தப் பயிற்சியை முடித்துவிட்டீர்கள்!",
    draft: "வரைவு — மாணவர்களுக்கு இன்னும் தெரியாது",
    kinds: { bookback: "புத்தக வினாக்கள்", additional: "கூடுதல் பயிற்சி", intext: "பாட இடை வினாக்கள்", unit: "அலகுப் பயிற்சி", misc: "பயிற்சி", exercise: "பயிற்சி" } as Record<string, string>,
  },
} as const;

const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet focus-visible:ring-offset-2 focus-visible:ring-offset-bg";
const CARD = "rounded-3xl border border-line bg-surface/85 backdrop-blur-sm";

function useJson<T>(url: string | null) {
  const [state, setState] = useState<{ url: string | null; data?: T; error?: boolean }>({ url: null });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!url) return;
    let alive = true;
    fetch(url, { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error(String(r.status));
        const data = (await r.json()) as T;
        if (alive) setState({ url, data });
      })
      .catch(() => alive && setState({ url, error: true }));
    return () => {
      alive = false;
    };
  }, [url, attempt]);
  const current = state.url === url ? state : { url };
  return { ...current, retry: () => setAttempt((n) => n + 1) };
}

/** Exercises & solutions: subjects → chapters → one exercise, driven by the address (?subject= &set=). */
export function PracticeScreen() {
  const params = useSearchParams();
  const subject = params.get("subject");
  const set = Number(params.get("set")) || null;
  if (set) return <SetView key={set} setId={set} />;
  if (subject) return <SubjectView key={subject} subjectId={subject} />;
  return <HomeView />;
}

function Loading() {
  const { locale } = useLocale();
  return (
    <div aria-busy="true" className="flex flex-col gap-3">
      <span className="sr-only">{PRACTICE_COPY[locale].loading}</span>
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-24 animate-pulse rounded-3xl bg-line/40 motion-reduce:animate-none" />
      ))}
    </div>
  );
}

function Failed({ retry }: { retry: () => void }) {
  const { locale } = useLocale();
  const c = PRACTICE_COPY[locale];
  return (
    <div role="alert" className={`${CARD} flex flex-wrap items-center justify-between gap-3 p-5 text-sm`}>
      <span>{c.failed}</span>
      <button type="button" onClick={retry} className={`min-h-11 rounded-xl border border-line-strong px-4 font-semibold hover:bg-violet/[0.08] ${FOCUS}`}>
        {c.retry}
      </button>
    </div>
  );
}

function ProgressBar({ value, total, label }: { value: number; total: number; label: string }) {
  const pct = total ? Math.round((value / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div role="progressbar" aria-label={label} aria-valuenow={value} aria-valuemin={0} aria-valuemax={total} className="h-2 flex-1 overflow-hidden rounded-full bg-line/60">
        <div className="h-full rounded-full bg-gradient-to-r from-purple-500 to-fuchsia-400 transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-10 text-right text-xs tabular-nums text-muted">{pct}%</span>
    </div>
  );
}

function MediumSwitch({ medium, onChange }: { medium: Medium; onChange: (m: Medium) => void }) {
  const { locale } = useLocale();
  const c = PRACTICE_COPY[locale];
  return (
    <div role="radiogroup" aria-label={c.medium[medium]} className="inline-grid grid-cols-2 gap-1 rounded-2xl border border-line bg-bg/40 p-1 text-sm">
      {(["en", "ta"] as const).map((m) => (
        <button
          key={m}
          type="button"
          role="radio"
          aria-checked={medium === m}
          onClick={() => onChange(m)}
          className={`min-h-10 rounded-xl px-3 font-semibold ${FOCUS} ${medium === m ? "bg-purple-600 text-white" : "text-muted hover:text-text"}`}
        >
          {c.medium[m]}
        </button>
      ))}
    </div>
  );
}

// --- Home: the class's subjects ------------------------------------------------

type SubjectsResponse = {
  standard: number;
  medium: Medium;
  subjects: { subjectId: string; medium: Medium | null; name: Localized; chapters: number; sets: number; items: number; done: number }[];
};

function HomeView() {
  const { locale } = useLocale();
  const c = PRACTICE_COPY[locale];
  const session = useSessionUser();
  const staff = useIsStaff();
  const user = session.status === "ready" ? session.user : null;
  const [standard, setStandard] = useState<number | null>(null);
  const [medium, setMedium] = useState<Medium | null>(null);
  const std = user?.student?.standard ?? standard ?? 10;
  const med = medium ?? user?.student?.medium ?? "en";
  const { data, error, retry } = useJson<SubjectsResponse>(user ? `/api/practice?standard=${std}&medium=${med}` : null);

  return (
    <div className="flex flex-col gap-5">
      <header className={`${CARD} relative overflow-hidden p-5 sm:p-7`}>
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 size-64 rounded-full bg-fuchsia-500/20 blur-3xl" />
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-violet">
          <ListChecks size={16} aria-hidden /> {c.classN(std)}
        </p>
        <h1 className="mt-2 font-display text-2xl font-bold tracking-tight sm:text-3xl">{c.title}</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">{c.lead}</p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {staff && (
            <label className="flex items-center gap-2 text-sm">
              <span className="sr-only">{c.classN(std)}</span>
              <select
                value={std}
                onChange={(e) => setStandard(Number(e.target.value))}
                className={`min-h-10 rounded-xl border border-line bg-bg/60 px-3 ${FOCUS}`}
              >
                {[4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
                  <option key={n} value={n}>
                    {c.classN(n)}
                  </option>
                ))}
              </select>
            </label>
          )}
          <MediumSwitch medium={med} onChange={setMedium} />
        </div>
      </header>

      {error ? (
        <Failed retry={retry} />
      ) : !data ? (
        <Loading />
      ) : data.subjects.length === 0 ? (
        <p className={`${CARD} p-6 text-center text-sm text-muted`}>{c.none}</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.subjects.map((s) => (
            <li key={`${s.subjectId}-${s.medium}`}>
              <Link
                href={`/practice?subject=${s.subjectId}&medium=${s.medium ?? med}`}
                className={`${CARD} group flex h-full flex-col gap-3 p-5 transition-colors hover:border-violet/60 hover:bg-surface ${FOCUS}`}
              >
                <span className="flex items-start justify-between gap-2">
                  <span className="font-display text-lg font-bold">{s.name[locale] || s.name.en}</span>
                  <ArrowRight size={18} aria-hidden className="mt-1 shrink-0 text-violet transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
                </span>
                <span className="text-xs text-muted">
                  {c.chapters(s.chapters)} · {c.questions(s.items)}
                </span>
                <span className="mt-auto">
                  <ProgressBar value={s.done} total={s.items} label={c.done(s.done, s.items)} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// --- Subject: chapters and their exercises ------------------------------------

type SubjectResponse = { subject: { id: string; name: Localized; standard: number }; medium: Medium; single: boolean; chapters: ChapterSummary[] };

function setLabel(s: SetSummary, c: (typeof PRACTICE_COPY)[keyof typeof PRACTICE_COPY]) {
  if (s.kind === "exercise") return s.number;
  if (s.kind === "unit") return `${c.kinds.unit} ${s.number}`;
  // Tamil and English lessons carry their own title ("1.2 Tamil lesson", "His First Flight").
  if (s.kind === "bookback" && s.title !== "Book-back questions") return s.title;
  return c.kinds[s.kind] ?? s.title;
}

function SubjectView({ subjectId }: { subjectId: string }) {
  const { locale } = useLocale();
  const c = PRACTICE_COPY[locale];
  const params = useSearchParams();
  const router = useRouter();
  const asked = params.get("medium") === "ta" ? "ta" : params.get("medium") === "en" ? "en" : null;
  const { data, error, retry } = useJson<SubjectResponse>(`/api/practice?subject=${encodeURIComponent(subjectId)}${asked ? `&medium=${asked}` : ""}`);

  const groups = useMemo(() => {
    const out: { key: string; label: string | null; chapters: ChapterSummary[] }[] = [];
    for (const ch of data?.chapters ?? []) {
      const label = [ch.term ? c.term(ch.term) : null, ch.book].filter(Boolean).join(" · ") || null;
      const g = out.find((x) => x.label === label);
      if (g) g.chapters.push(ch);
      else out.push({ key: label ?? "all", label, chapters: [ch] });
    }
    return out;
  }, [data, c]);

  return (
    <div className="flex flex-col gap-5">
      <Link href="/practice" className={`inline-flex min-h-11 w-fit items-center gap-2 rounded-lg text-sm text-muted hover:text-text ${FOCUS}`}>
        <ArrowLeft size={16} aria-hidden /> {c.allSubjects}
      </Link>
      {error ? (
        <Failed retry={retry} />
      ) : !data ? (
        <Loading />
      ) : (
        <>
          <header className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-violet">{c.classN(data.subject.standard)}</p>
              <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{data.subject.name[locale] || data.subject.name.en}</h1>
            </div>
            {!data.single && <MediumSwitch medium={data.medium} onChange={(m) => router.replace(`/practice?subject=${subjectId}&medium=${m}`)} />}
          </header>
          {data.chapters.length === 0 ? (
            <p className={`${CARD} p-6 text-center text-sm text-muted`}>{c.noneSubject}</p>
          ) : (
            groups.map((g) => (
              <section key={g.key} aria-label={g.label ?? undefined} className="flex flex-col gap-3">
                {g.label && <h2 className="px-1 text-sm font-semibold text-muted">{g.label}</h2>}
                <ol className="flex flex-col gap-3">
                  {g.chapters.map((ch) => {
                    const total = ch.sets.reduce((n, s) => n + s.itemCount, 0);
                    const done = ch.sets.reduce((n, s) => n + s.done, 0);
                    return (
                      <li key={ch.id} className={`${CARD} p-4 sm:p-5`}>
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <h3 className="min-w-0 flex-1 font-semibold">
                            <span className="mr-2 text-violet tabular-nums">{ch.number}.</span>
                            {ch.title}
                          </h3>
                          {ch.status !== "published" && <span className="rounded-md bg-amber-400/15 px-2 py-0.5 text-[11px] font-medium">{c.draft}</span>}
                        </div>
                        <div className="mt-2">
                          <ProgressBar value={done} total={total} label={c.done(done, total)} />
                        </div>
                        <ul className="mt-3 flex flex-wrap gap-2">
                          {ch.sets.map((s) => {
                            const complete = s.itemCount > 0 && s.done >= s.itemCount;
                            return (
                              <li key={s.id}>
                                <Link
                                  href={`/practice?set=${s.id}`}
                                  className={`inline-flex min-h-10 items-center gap-1.5 rounded-xl border px-3 text-sm font-medium transition-colors ${FOCUS} ${
                                    complete ? "border-success/50 bg-success/10" : s.done ? "border-violet/50 bg-violet/10" : "border-line hover:border-violet/50 hover:bg-violet/[0.06]"
                                  }`}
                                >
                                  {complete ? <CheckCircle size={16} weight="fill" className="text-success" aria-hidden /> : null}
                                  {setLabel(s, c)}
                                  <span className="text-xs font-normal text-muted tabular-nums">
                                    {s.done ? `${s.done}/` : ""}
                                    {s.itemCount}
                                  </span>
                                  {s.help > 0 && <Question size={14} className="text-amber-400" aria-label={c.needHelp} />}
                                </Link>
                              </li>
                            );
                          })}
                        </ul>
                      </li>
                    );
                  })}
                </ol>
              </section>
            ))
          )}
        </>
      )}
    </div>
  );
}

// --- One exercise ---------------------------------------------------------------

type SetResponse = {
  set: { id: number; kind: string; number: string; title: string; itemCount: number };
  chapter: { id: number; subjectId: string; subjectName: Localized | null; standard: number; medium: Medium | null; book: string | null; term: number | null; number: number; title: string };
  sections: PracticeSection[];
  progress: Record<number, State>;
  prev: { id: number; title: string } | null;
  next: { id: number; title: string } | null;
};

function SetView({ setId }: { setId: number }) {
  const { locale } = useLocale();
  const c = PRACTICE_COPY[locale];
  const { data, error, retry } = useJson<SetResponse>(`/api/practice/set/${setId}`);
  const [progress, setProgressState] = useState<Record<number, State> | null>(null);
  const [filter, setFilter] = useState<"all" | "todo" | "help">("all");
  const current = progress ?? data?.progress ?? {};

  const record = useCallback(
    (item: number, state: State | null) => {
      setProgressState((p) => {
        const next = { ...(p ?? data?.progress ?? {}) };
        if (state) next[item] = state;
        else delete next[item];
        return next;
      });
      void fetch("/api/practice/progress", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ setId, item, state }) }).catch(() => {});
    },
    [data, setId],
  );

  if (error) return <Failed retry={retry} />;
  if (!data) return <Loading />;
  const { set, chapter, sections } = data;
  const total = set.itemCount;
  const done = Object.values(current).filter((s) => s === "done" || s === "right").length;
  let index = -1;

  return (
    <div className="flex flex-col gap-5">
      <Link
        href={`/practice?subject=${chapter.subjectId}${chapter.medium ? `&medium=${chapter.medium}` : ""}`}
        className={`inline-flex min-h-11 w-fit items-center gap-2 rounded-lg text-sm text-muted hover:text-text ${FOCUS}`}
      >
        <ArrowLeft size={16} aria-hidden /> {chapter.subjectName?.[locale] || chapter.subjectName?.en}
      </Link>

      <header className={`${CARD} sticky top-2 z-10 flex flex-col gap-3 p-4 shadow-lg sm:p-5`}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-xs text-muted">
              {[c.classN(chapter.standard), chapter.term ? c.term(chapter.term) : null, chapter.book, `${c.chapter(chapter.number)}: ${chapter.title}`].filter(Boolean).join(" · ")}
            </p>
            <h1 className="font-display text-xl font-bold tracking-tight sm:text-2xl">{set.kind === "exercise" ? `${c.kinds.exercise} ${set.number}` : set.kind === "unit" ? `${c.kinds.unit} ${set.number}` : set.kind === "bookback" && set.title !== "Book-back questions" ? set.title : (c.kinds[set.kind] ?? set.title)}</h1>
          </div>
          <div role="radiogroup" aria-label={c.filter.all} className="flex gap-1 rounded-xl border border-line bg-bg/40 p-1 text-xs">
            {(["all", "todo", "help"] as const).map((f) => (
              <button
                key={f}
                type="button"
                role="radio"
                aria-checked={filter === f}
                onClick={() => setFilter(f)}
                className={`min-h-9 rounded-lg px-2.5 font-semibold ${FOCUS} ${filter === f ? "bg-purple-600 text-white" : "text-muted hover:text-text"}`}
              >
                {c.filter[f]}
              </button>
            ))}
          </div>
        </div>
        <ProgressBar value={done} total={total} label={c.done(done, total)} />
        {done === total && total > 0 && (
          <p className="flex items-center gap-2 text-sm font-semibold text-success">
            <Sparkle size={16} weight="fill" aria-hidden /> {c.doneAll}
          </p>
        )}
      </header>

      {sections.map((s, si) => {
        const items = s.items.map((item) => ({ item, i: ++index }));
        const shown = items.filter(({ i }) => filter === "all" || (filter === "todo" ? !(current[i] === "done" || current[i] === "right") : current[i] === "help" || current[i] === "wrong"));
        if (!shown.length && filter !== "all") return null;
        return (
          <section key={si} aria-label={s.title ?? undefined} className="flex flex-col gap-3">
            {s.title && <h2 className="px-1 font-display text-lg font-semibold">{s.title}</h2>}
            {s.note && (
              <div className="rounded-2xl bg-violet/[0.07] px-4 py-3 text-sm">
                <PracticeMarkdown text={s.note} />
              </div>
            )}
            <ol className="flex flex-col gap-3">
              {shown.map(({ item, i }) => (
                <QuestionCard key={i} item={item} state={current[i] ?? null} onState={(st) => record(i, st)} />
              ))}
            </ol>
          </section>
        );
      })}

      <nav aria-label={`${c.prev} / ${c.next}`} className="grid grid-cols-2 gap-3">
        {data.prev ? (
          <Link href={`/practice?set=${data.prev.id}`} className={`${CARD} flex min-h-14 items-center gap-2 p-4 text-sm font-semibold hover:border-violet/60 ${FOCUS}`}>
            <ArrowLeft size={18} aria-hidden /> <span className="truncate">{data.prev.title}</span>
          </Link>
        ) : (
          <span />
        )}
        {data.next && (
          <Link href={`/practice?set=${data.next.id}`} className={`${CARD} flex min-h-14 items-center justify-end gap-2 p-4 text-right text-sm font-semibold hover:border-violet/60 ${FOCUS}`}>
            <span className="truncate">{data.next.title}</span> <ArrowRight size={18} aria-hidden />
          </Link>
        )}
      </nav>
    </div>
  );
}

/** Splits a long solution into steps, so it can be revealed one step at a time. */
function stepsOf(answer: string): string[] {
  const paras = answer.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  if (paras.length > 1) return paras;
  const lines = answer.split("\n").filter((l) => l.trim());
  if (lines.length <= 4) return [answer];
  const out: string[] = [];
  for (let i = 0; i < lines.length; i += 2) out.push(lines.slice(i, i + 2).join("\n"));
  return out;
}

function QuestionCard({ item, state, onState }: { item: PracticeItem; state: State | null; onState: (s: State | null) => void }) {
  const { locale } = useLocale();
  const c = PRACTICE_COPY[locale];
  const steps = useMemo(() => stepsOf(item.a), [item.a]);
  const [shown, setShown] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const solved = state === "done" || state === "right";
  // Multiple choice: the answer's first line is the option; anything after it explains why.
  const explanation = item.mcq
    ? item.a
        .split("\n")
        .slice(1)
        .join("\n")
        .replace(/^\s*(explaination|explanation|solution|hint)\s*:?\s*/i, "")
        .trim()
    : "";

  const pick = (key: string) => {
    if (picked) return;
    setPicked(key);
    onState(key === item.mcq!.answer ? "right" : "wrong");
  };

  return (
    <li className={`${CARD} p-4 sm:p-5 ${solved ? "border-success/40" : state === "help" || state === "wrong" ? "border-amber-400/40" : ""}`}>
      <div className="flex gap-3">
        <span className={`grid size-8 shrink-0 place-items-center rounded-full text-xs font-bold tabular-nums ${solved ? "bg-success/20 text-success" : "bg-purple-600 text-white"}`}>
          {solved ? <CheckCircle size={18} weight="fill" aria-label={c.gotIt} /> : item.label || "•"}
        </span>
        <div className="min-w-0 flex-1">
          {item.q && <PracticeMarkdown text={item.q} />}

          {item.mcq ? (
            <fieldset className="mt-3">
              <legend className="sr-only">{c.pick}</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {item.mcq.options.map((o) => {
                  const isAnswer = o.key === item.mcq!.answer;
                  const reveal = picked !== null || state === "right" || state === "wrong";
                  const mine = picked === o.key;
                  return (
                    <button
                      key={o.key}
                      type="button"
                      disabled={reveal}
                      onClick={() => pick(o.key)}
                      className={`flex min-h-11 items-start gap-2 rounded-xl border px-3 py-2 text-left text-sm transition-colors ${FOCUS} ${
                        reveal && isAnswer
                          ? "border-success/60 bg-success/10"
                          : reveal && mine
                            ? "border-danger/60 bg-danger/10"
                            : "border-line hover:border-violet/60 hover:bg-violet/[0.06] disabled:opacity-70"
                      }`}
                    >
                      <span className="font-semibold">({o.key})</span>
                      <span className="min-w-0 flex-1">
                        <PracticeMarkdown text={o.text} />
                      </span>
                      {reveal && isAnswer && <CheckCircle size={18} weight="fill" className="shrink-0 text-success" aria-hidden />}
                      {reveal && mine && !isAnswer && <XCircle size={18} weight="fill" className="shrink-0 text-danger" aria-hidden />}
                    </button>
                  );
                })}
              </div>
              {(picked || state === "right" || state === "wrong") && (
                <p role="status" className={`mt-2 text-sm font-semibold ${(picked ? picked === item.mcq.answer : state === "right") ? "text-success" : "text-amber-400"}`}>
                  {(picked ? picked === item.mcq.answer : state === "right") ? c.correct : c.wrong(item.mcq.answer)}
                </p>
              )}
              {(picked || state === "right" || state === "wrong") && explanation && (
                <div className="mt-3 rounded-2xl border-l-4 border-violet bg-violet/[0.06] p-3 sm:p-4">
                  <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-violet">
                    <Lightbulb size={14} weight="fill" aria-hidden /> {c.solution}
                  </p>
                  <PracticeMarkdown text={explanation} />
                </div>
              )}
              {(picked || state) && (
                <button type="button" onClick={() => (setPicked(null), onState(null))} className={`mt-2 min-h-9 rounded-lg px-2 text-xs text-muted hover:text-text ${FOCUS}`}>
                  {c.undo}
                </button>
              )}
            </fieldset>
          ) : (
            <>
              {shown > 0 && (
                <div className="mt-3 rounded-2xl border-l-4 border-violet bg-violet/[0.06] p-3 sm:p-4">
                  <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-violet">
                    <Lightbulb size={14} weight="fill" aria-hidden /> {c.solution}
                  </p>
                  {item.a ? (
                    <div className="flex flex-col gap-2">
                      {steps.slice(0, shown).map((s, k) => (
                        <div key={k} className={k === shown - 1 ? "animate-[fadeIn_.25s_ease-out] motion-reduce:animate-none" : ""}>
                          <PracticeMarkdown text={s} />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted">{c.noAnswer}</p>
                  )}
                </div>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {shown === 0 ? (
                  <button type="button" onClick={() => setShown(1)} className={`inline-flex min-h-11 items-center gap-2 rounded-xl bg-purple-600 px-4 text-sm font-semibold text-white hover:bg-purple-700 ${FOCUS}`}>
                    <Eye size={16} aria-hidden /> {steps.length > 1 ? c.showSolution : c.showAnswer}
                  </button>
                ) : shown < steps.length ? (
                  <>
                    <button type="button" onClick={() => setShown((n) => n + 1)} className={`inline-flex min-h-11 items-center gap-2 rounded-xl bg-purple-600 px-4 text-sm font-semibold text-white hover:bg-purple-700 ${FOCUS}`}>
                      <CaretDown size={16} aria-hidden /> {c.nextStep} ({shown}/{steps.length})
                    </button>
                    <button type="button" onClick={() => setShown(steps.length)} className={`min-h-11 rounded-xl border border-line-strong px-4 text-sm font-semibold hover:bg-violet/[0.08] ${FOCUS}`}>
                      {c.showAll}
                    </button>
                  </>
                ) : (
                  <button type="button" onClick={() => setShown(0)} className={`min-h-11 rounded-xl px-3 text-sm text-muted hover:text-text ${FOCUS}`}>
                    {c.hide}
                  </button>
                )}
                <span className="ml-auto flex gap-2">
                  <button
                    type="button"
                    aria-pressed={state === "done"}
                    onClick={() => onState(state === "done" ? null : "done")}
                    className={`inline-flex min-h-11 items-center gap-1.5 rounded-xl border px-3 text-sm font-semibold ${FOCUS} ${state === "done" ? "border-success/60 bg-success/15 text-success" : "border-line hover:border-success/50"}`}
                  >
                    {state === "done" ? <CheckCircle size={16} weight="fill" aria-hidden /> : <Circle size={16} aria-hidden />} {c.gotIt}
                  </button>
                  <button
                    type="button"
                    aria-pressed={state === "help"}
                    onClick={() => onState(state === "help" ? null : "help")}
                    className={`inline-flex min-h-11 items-center gap-1.5 rounded-xl border px-3 text-sm font-semibold ${FOCUS} ${state === "help" ? "border-amber-400/60 bg-amber-400/15 text-amber-300" : "border-line hover:border-amber-400/50"}`}
                  >
                    <Question size={16} aria-hidden /> {c.needHelp}
                  </button>
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </li>
  );
}
