"use client";

import { useState } from "react";
import { ArrowsCounterClockwise, Lightbulb } from "@phosphor-icons/react/ssr";
import { useLocale } from "@/components/locale-provider";
import { updateProgress } from "@/components/progress-store";
import type { PracticeQuestion } from "@/lib/curriculum";
import { localDay, recordAnswer } from "@/lib/progress";
import type { LifeLinkConcept } from "./life-link";
import { LifeLinkCard } from "./life-link-card";

const COPY = {
  en: {
    tryAgain: "Not quite. That option is crossed out — read the question again and try once more.",
    thinkReal: "Still not it. Think about it this way, then try again:",
    thinkAbout: "Think about it this way:",
    correct: "✓ Correct!",
    correctAfter: "✓ Got it! That's how you learn.",
    answerIs: "The answer is",
    why: "Why:",
    comesBack: "This question will come back in your Daily 5 review so you can master it.",
  },
  ta: {
    tryAgain: "சரியில்லை. அந்த விடை அடிக்கப்பட்டுள்ளது — வினாவை மீண்டும் படித்து இன்னொரு முறை முயலுங்கள்.",
    thinkReal: "இன்னும் சரியில்லை. இப்படி யோசித்துப் பாருங்கள், பிறகு மீண்டும் முயலுங்கள்:",
    thinkAbout: "இப்படி யோசித்துப் பாருங்கள்:",
    correct: "✓ சரியான விடை!",
    correctAfter: "✓ சரி! இப்படித்தான் கற்றுக்கொள்கிறோம்.",
    answerIs: "சரியான விடை",
    why: "காரணம்:",
    comesBack: "இந்த வினா உங்கள் தினசரி 5 மீள்பார்வையில் மீண்டும் வரும்.",
  },
} as const;

type Status = "open" | "solved" | "revealed";

/**
 * A multiple-choice question that teaches instead of just marking:
 * 1st wrong try → the option is crossed out and the student tries again;
 * 2nd wrong try → a Life Link real-life comparison (when the chapter has one);
 * after that → the answer and explanation. The first try is what counts for
 * spaced review: a wrong first try puts the question in the mistake notebook.
 */
export function HintedQuestion({
  question,
  number,
  chapterId,
  lifeLinks = [],
  fromReview = false,
  onFirstAnswer,
  onDone,
}: {
  question: PracticeQuestion;
  number?: number;
  chapterId: string;
  lifeLinks?: readonly LifeLinkConcept[];
  fromReview?: boolean;
  /** Called once, with whether the first try was right. */
  onFirstAnswer?: (correct: boolean) => void;
  /** Called once the question is finished (solved or answer shown). */
  onDone?: (firstTryCorrect: boolean) => void;
}) {
  const { locale } = useLocale();
  const copy = COPY[locale];
  const [wrong, setWrong] = useState<number[]>([]);
  const [status, setStatus] = useState<Status>("open");
  const [picked, setPicked] = useState<number | null>(null);

  const remainingWrong = question.options.length - 1 - wrong.length;
  // Once shown, the comparison stays on screen while the student finishes the question.
  const showLifeLink = wrong.length >= 2 && lifeLinks.length > 0;

  const choose = (optIdx: number) => {
    if (status !== "open" || wrong.includes(optIdx)) return;
    const correct = optIdx === question.answerIndex;
    const firstTry = wrong.length === 0;
    setPicked(optIdx);

    if (firstTry) {
      updateProgress((p) => recordAnswer(p, { questionId: question.id, chapterId, correct, fromReview }, localDay()));
      onFirstAnswer?.(correct);
    }

    if (correct) {
      setStatus("solved");
      onDone?.(firstTry);
      return;
    }

    const nextWrong = [...wrong, optIdx];
    setWrong(nextWrong);
    // Reveal after the third wrong try, after the second when there's no Life Link to offer,
    // or when only the right answer is left.
    const limit = lifeLinks.length > 0 ? 3 : 2;
    if (nextWrong.length >= limit || remainingWrong - 1 <= 0) {
      setStatus("revealed");
      onDone?.(false);
    }
  };

  const FOCUS =
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

  const optionState = (optIdx: number): "answer" | "wrong" | "muted" | "open" => {
    if (status !== "open" && optIdx === question.answerIndex) return "answer";
    if (wrong.includes(optIdx)) return "wrong";
    if (status !== "open") return "muted";
    return "open";
  };

  const OPTION: Record<ReturnType<typeof optionState>, string> = {
    open: "border-line bg-surface/70 hover:border-violet/60 hover:bg-violet/[0.06] active:scale-[0.99] cursor-pointer",
    answer: "border-success/70 bg-success/10 ring-1 ring-success/40",
    wrong: "border-danger/30 bg-danger/[0.06] text-muted line-through decoration-danger/60 cursor-not-allowed",
    muted: "border-line bg-surface/40 text-muted",
  };
  const BADGE: Record<ReturnType<typeof optionState>, string> = {
    open: "bg-violet/15 text-violet",
    answer: "bg-success text-white",
    wrong: "bg-danger/15 text-danger",
    muted: "bg-line text-muted",
  };

  const answerText = question.options[question.answerIndex]?.[locale] ?? question.options[question.answerIndex]?.en;

  return (
    <div className="rounded-2xl border border-line bg-surface/60 p-4 text-text sm:p-5">
      <p className="mb-3 flex gap-2 font-display text-sm font-semibold leading-snug sm:text-base">
        {number !== undefined && <span className="shrink-0 font-mono text-xs font-semibold text-pink sm:text-sm">Q{number}</span>}
        <span>{question.question[locale] || question.question.en}</span>
      </p>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {question.options.map((opt, optIdx) => {
          const state = optionState(optIdx);
          return (
            <button
              key={optIdx}
              type="button"
              disabled={state !== "open"}
              aria-pressed={picked === optIdx}
              onClick={() => choose(optIdx)}
              className={`flex min-h-11 items-center gap-2.5 rounded-xl border p-3 text-left text-sm transition-[background-color,border-color,transform] duration-150 disabled:cursor-default ${FOCUS} ${OPTION[state]}`}
            >
              <span
                aria-hidden
                className={`grid size-6 shrink-0 place-items-center rounded-lg font-mono text-xs font-semibold ${BADGE[state]}`}
              >
                {state === "answer" ? "✓" : state === "wrong" ? "✕" : String.fromCharCode(65 + optIdx)}
              </span>
              <span className="leading-snug">{opt[locale] || opt.en}</span>
            </button>
          );
        })}
      </div>

      <div aria-live="polite">
        {status === "open" && wrong.length === 1 && (
          <p className="mt-4 flex items-start gap-2 rounded-xl border border-violet/30 bg-violet/[0.08] p-3 text-sm leading-relaxed">
            <ArrowsCounterClockwise size={16} className="mt-0.5 shrink-0 text-violet" aria-hidden />
            <span>{copy.tryAgain}</span>
          </p>
        )}

        {showLifeLink && (
          <div className="mt-4 flex flex-col gap-2">
            <p className="flex items-center gap-2 text-sm font-semibold text-amber">
              <Lightbulb size={16} weight="fill" aria-hidden />
              {status === "open" ? copy.thinkReal : copy.thinkAbout}
            </p>
            {lifeLinks.map((c) => (
              <LifeLinkCard key={c.id} concept={c} compact />
            ))}
          </div>
        )}

        {status !== "open" && (
          <div
            className={`mt-4 rounded-xl border p-3 text-sm leading-relaxed ${
              status === "solved" ? "border-success/40 bg-success/[0.08]" : "border-amber/40 bg-amber/[0.08]"
            }`}
          >
            <p className={`font-semibold ${status === "solved" ? "text-success" : "text-amber"}`}>
              {status === "solved"
                ? wrong.length === 0
                  ? copy.correct
                  : copy.correctAfter
                : `${copy.answerIs}: ${String.fromCharCode(65 + question.answerIndex)}. ${answerText}`}
            </p>
            <p className="mt-1 text-muted">
              <span className="font-medium text-text">{copy.why} </span>
              {question.explanation[locale] || question.explanation.en}
            </p>
            {wrong.length > 0 && <p className="mt-1.5 text-xs text-muted">{copy.comesBack}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
