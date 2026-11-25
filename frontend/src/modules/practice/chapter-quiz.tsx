"use client";

import { ArrowClockwise, ArrowRight, CheckCircle, Lightbulb, Timer, Trophy, XCircle } from "@phosphor-icons/react/ssr";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale } from "@/components/locale-provider";
import { PracticeMarkdown } from "./practice-markdown";

type Question = { setId: number; item: number; q: string; options: { key: string; text: string }[]; answer: string; explanation: string };
type Stats = { attempts: number; best: number | null; last: { correct: number; total: number } | null };

const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet focus-visible:ring-offset-2 focus-visible:ring-offset-bg";

const COPY = {
  en: {
    title: "Chapter quiz",
    lead: (n: number) => `${Math.min(n, 10)} quick questions from this chapter's exercises. A new mix every time.`,
    start: "Take a quiz",
    again: "Try another quiz",
    best: (p: number) => `Best ${p}%`,
    last: (c: number, t: number) => `Last ${c}/${t}`,
    tries: (n: number) => (n === 1 ? "1 try" : `${n} tries`),
    of: (i: number, n: number) => `Question ${i} of ${n}`,
    correct: "Correct!",
    wrong: (k: string) => `Not quite — the answer is (${k}).`,
    why: "Why",
    next: "Next question",
    finish: "See my score",
    saving: "Saving…",
    score: (c: number, t: number) => `You scored ${c} out of ${t}`,
    cheer: (p: number) => (p === 100 ? "Perfect! You know this chapter." : p >= 70 ? "Great work — nearly there." : p >= 40 ? "Good start. Read the answers you missed and try again." : "Go through the chapter once more, then try again."),
    review: "Your answers",
    close: "Close",
    error: "Couldn't load the quiz. Check your connection and try again.",
    saveError: "Your score couldn't be saved, but here is how you did.",
  },
  ta: {
    title: "பாட வினாடி வினா",
    lead: (n: number) => `இந்தப் பாடப் பயிற்சிகளிலிருந்து ${Math.min(n, 10)} விரைவு வினாக்கள். ஒவ்வொரு முறையும் புதிய கலவை.`,
    start: "வினாடி வினா எழுது",
    again: "இன்னொரு வினாடி வினா",
    best: (p: number) => `சிறந்தது ${p}%`,
    last: (c: number, t: number) => `கடைசி ${c}/${t}`,
    tries: (n: number) => `${n} முயற்சி`,
    of: (i: number, n: number) => `வினா ${i} / ${n}`,
    correct: "சரி!",
    wrong: (k: string) => `இல்லை — சரியான விடை (${k}).`,
    why: "ஏன்",
    next: "அடுத்த வினா",
    finish: "என் மதிப்பெண்",
    saving: "சேமிக்கிறது…",
    score: (c: number, t: number) => `உங்கள் மதிப்பெண் ${t}-க்கு ${c}`,
    cheer: (p: number) => (p === 100 ? "முழு மதிப்பெண்! இந்தப் பாடம் உங்களுக்கு நன்றாகத் தெரியும்." : p >= 70 ? "அருமை — கிட்டத்தட்ட முழுமை." : p >= 40 ? "நல்ல தொடக்கம். தவறிய விடைகளைப் படித்து மீண்டும் முயலுங்கள்." : "பாடத்தை இன்னொரு முறை படித்துவிட்டு மீண்டும் முயலுங்கள்."),
    review: "உங்கள் விடைகள்",
    close: "மூடு",
    error: "வினாடி வினாவைத் திறக்க முடியவில்லை. இணைப்பைச் சரிபார்த்து மீண்டும் முயலுங்கள்.",
    saveError: "மதிப்பெண்ணைச் சேமிக்க முடியவில்லை; ஆனால் உங்கள் முடிவு இதோ.",
  },
} as const;

type Phase = { kind: "idle" } | { kind: "loading" } | { kind: "error" } | { kind: "playing"; questions: Question[]; at: number; picks: string[] } | { kind: "done"; questions: Question[]; picks: string[]; saving: boolean; saveFailed: boolean };

/** "Chapter quiz": random multiple-choice questions from the chapter's exercises, scored as you go. Hidden when there are none. */
export function ChapterQuiz({ chapterId }: { chapterId: string }) {
  const { locale } = useLocale();
  const c = COPY[locale];
  const [available, setAvailable] = useState(0);
  const [stats, setStats] = useState<Stats | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const top = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/quiz?chapter=${encodeURIComponent(chapterId)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { available: 0, stats: null }))
      .then((d: { available: number; stats: Stats | null }) => {
        if (!alive) return;
        setAvailable(d.available);
        setStats(d.stats);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [chapterId]);

  const start = useCallback(async () => {
    setPhase({ kind: "loading" });
    try {
      const r = await fetch(`/api/quiz?chapter=${encodeURIComponent(chapterId)}&start=1`, { cache: "no-store" });
      const d = (await r.json()) as { questions?: Question[] };
      if (!r.ok || !d.questions?.length) throw new Error("empty");
      setPhase({ kind: "playing", questions: d.questions, at: 0, picks: [] });
      top.current?.scrollIntoView({ block: "start", behavior: "smooth" });
    } catch {
      setPhase({ kind: "error" });
    }
  }, [chapterId]);

  const finish = useCallback(
    async (questions: Question[], picks: string[]) => {
      setPhase({ kind: "done", questions, picks, saving: true, saveFailed: false });
      try {
        const r = await fetch("/api/quiz", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chapter: chapterId, answers: questions.map((q, i) => ({ setId: q.setId, item: q.item, key: picks[i]! })) }),
        });
        if (!r.ok) throw new Error(String(r.status));
        const d = (await r.json()) as { stats: Stats };
        setStats(d.stats);
        setPhase({ kind: "done", questions, picks, saving: false, saveFailed: false });
      } catch {
        setPhase({ kind: "done", questions, picks, saving: false, saveFailed: true });
      }
    },
    [chapterId],
  );

  if (!available) return null;

  return (
    <div ref={top} className="scroll-mt-24 rounded-2xl border border-violet/30 bg-violet/[0.05] p-4 sm:p-5">
      {(phase.kind === "idle" || phase.kind === "loading" || phase.kind === "error") && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="flex items-center gap-2 font-display text-lg font-bold">
              <Timer size={20} aria-hidden className="text-violet" /> {c.title}
            </h3>
            <p className="text-sm text-muted">{c.lead(available)}</p>
            {stats && stats.attempts > 0 && (
              <p className="mt-1 flex flex-wrap gap-x-3 text-xs font-medium text-muted tabular-nums">
                {stats.best !== null && (
                  <span className="inline-flex items-center gap-1 text-text">
                    <Trophy size={14} weight="fill" className="text-amber-400" aria-hidden /> {c.best(stats.best)}
                  </span>
                )}
                {stats.last && <span>{c.last(stats.last.correct, stats.last.total)}</span>}
                <span>{c.tries(stats.attempts)}</span>
              </p>
            )}
            {phase.kind === "error" && (
              <p role="alert" className="mt-2 text-sm text-danger">
                {c.error}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={start}
            disabled={phase.kind === "loading"}
            className={`inline-flex min-h-11 items-center gap-2 rounded-xl bg-purple-600 px-4 text-sm font-semibold text-white hover:bg-purple-500 disabled:opacity-60 ${FOCUS}`}
          >
            {stats?.attempts ? c.again : c.start} <ArrowRight size={16} aria-hidden />
          </button>
        </div>
      )}

      {phase.kind === "playing" && <Play c={c} phase={phase} setPhase={setPhase} onFinish={finish} />}

      {phase.kind === "done" && <Result c={c} phase={phase} onAgain={start} onClose={() => setPhase({ kind: "idle" })} />}
    </div>
  );
}

type Copy = (typeof COPY)[keyof typeof COPY];

function Play({ c, phase, setPhase, onFinish }: { c: Copy; phase: Extract<Phase, { kind: "playing" }>; setPhase: (p: Phase) => void; onFinish: (q: Question[], p: string[]) => void }) {
  const { questions, at, picks } = phase;
  const q = questions[at]!;
  const picked = picks[at] ?? null;
  const last = at === questions.length - 1;
  const right = picked === q.answer;
  const heading = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    heading.current?.focus();
  }, [at]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <p ref={heading} tabIndex={-1} className="text-xs font-semibold uppercase tracking-wide text-violet outline-none">
          {c.of(at + 1, questions.length)}
        </p>
        <div className="flex gap-1" aria-hidden>
          {questions.map((x, i) => (
            <span key={i} className={`h-1.5 w-4 rounded-full sm:w-6 ${i < at || (i === at && picked) ? (picks[i] === x.answer ? "bg-success" : "bg-danger") : i === at ? "bg-violet" : "bg-line"}`} />
          ))}
        </div>
      </div>
      <PracticeMarkdown text={q.q} />
      <fieldset>
        <legend className="sr-only">{c.of(at + 1, questions.length)}</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {q.options.map((o) => {
            const isAnswer = o.key === q.answer;
            const mine = picked === o.key;
            return (
              <button
                key={o.key}
                type="button"
                disabled={picked !== null}
                onClick={() => setPhase({ ...phase, picks: Object.assign([...picks], { [at]: o.key }) })}
                className={`flex min-h-11 items-start gap-2 rounded-xl border px-3 py-2 text-left text-sm transition-colors ${FOCUS} ${
                  picked && isAnswer ? "border-success/60 bg-success/10" : picked && mine ? "border-danger/60 bg-danger/10" : "border-line bg-surface hover:border-violet/60 hover:bg-violet/[0.06] disabled:opacity-70"
                }`}
              >
                <span className="font-semibold">({o.key})</span>
                <span className="min-w-0 flex-1">
                  <PracticeMarkdown text={o.text} />
                </span>
                {picked && isAnswer && <CheckCircle size={18} weight="fill" className="shrink-0 text-success" aria-hidden />}
                {picked && mine && !isAnswer && <XCircle size={18} weight="fill" className="shrink-0 text-danger" aria-hidden />}
              </button>
            );
          })}
        </div>
      </fieldset>
      {picked && (
        <>
          <p role="status" className={`text-sm font-semibold ${right ? "text-success" : "text-amber-400"}`}>
            {right ? c.correct : c.wrong(q.answer)}
          </p>
          {q.explanation && (
            <div className="rounded-2xl border-l-4 border-violet bg-violet/[0.06] p-3">
              <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-violet">
                <Lightbulb size={14} weight="fill" aria-hidden /> {c.why}
              </p>
              <PracticeMarkdown text={q.explanation} />
            </div>
          )}
          <button
            type="button"
            onClick={() => (last ? onFinish(questions, picks) : setPhase({ ...phase, at: at + 1 }))}
            className={`inline-flex min-h-11 items-center gap-2 self-end rounded-xl bg-purple-600 px-4 text-sm font-semibold text-white hover:bg-purple-500 ${FOCUS}`}
          >
            {last ? c.finish : c.next} <ArrowRight size={16} aria-hidden />
          </button>
        </>
      )}
    </div>
  );
}

function Result({ c, phase, onAgain, onClose }: { c: Copy; phase: Extract<Phase, { kind: "done" }>; onAgain: () => void; onClose: () => void }) {
  const { questions, picks } = phase;
  const correct = questions.filter((q, i) => picks[i] === q.answer).length;
  const pct = Math.round((100 * correct) / questions.length);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3" role="status">
        <span className={`grid size-14 shrink-0 place-items-center rounded-full font-display text-lg font-bold tabular-nums ${pct >= 70 ? "bg-success/15 text-success" : pct >= 40 ? "bg-amber-400/15 text-amber-400" : "bg-danger/15 text-danger"}`}>{pct}%</span>
        <div>
          <p className="font-display text-lg font-bold">{c.score(correct, questions.length)}</p>
          <p className="text-sm text-muted">{phase.saving ? c.saving : c.cheer(pct)}</p>
        </div>
      </div>
      {phase.saveFailed && <p className="text-sm text-amber-400">{c.saveError}</p>}
      <details className="rounded-xl border border-line bg-surface p-3">
        <summary className={`min-h-9 cursor-pointer rounded text-sm font-semibold ${FOCUS}`}>{c.review}</summary>
        <ol className="mt-2 flex flex-col gap-2">
          {questions.map((q, i) => {
            const ok = picks[i] === q.answer;
            return (
              <li key={`${q.setId}-${q.item}`} className="flex gap-2 text-sm">
                {ok ? <CheckCircle size={18} weight="fill" className="mt-0.5 shrink-0 text-success" aria-label={c.correct} /> : <XCircle size={18} weight="fill" className="mt-0.5 shrink-0 text-danger" aria-label={c.wrong(q.answer)} />}
                <div className="min-w-0 flex-1">
                  <PracticeMarkdown text={q.q} />
                  {!ok && <p className="text-xs text-muted">{c.wrong(q.answer)}</p>}
                </div>
              </li>
            );
          })}
        </ol>
      </details>
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" onClick={onClose} className={`min-h-11 rounded-xl px-4 text-sm text-muted hover:text-text ${FOCUS}`}>
          {c.close}
        </button>
        <button type="button" onClick={onAgain} className={`inline-flex min-h-11 items-center gap-2 rounded-xl bg-purple-600 px-4 text-sm font-semibold text-white hover:bg-purple-500 ${FOCUS}`}>
          <ArrowClockwise size={16} aria-hidden /> {c.again}
        </button>
      </div>
    </div>
  );
}
