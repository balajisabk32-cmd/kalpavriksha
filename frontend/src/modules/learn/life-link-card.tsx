"use client";

import { useState } from "react";
import { CaretRight, Plant, SpeakerHigh, Stop, ThumbsDown, ThumbsUp, Warning } from "@phosphor-icons/react/ssr";
import { useLocale } from "@/components/locale-provider";
import { updateProgress, useProgress } from "@/components/progress-store";
import { useReadAloud } from "@/components/read-aloud";
import { voteAnalogy } from "@/lib/progress";
import { THEME_EMOJI, THEME_LABEL, type LifeLinkConcept } from "./life-link";

const COPY = {
  en: {
    label: "Life Link",
    sub: "this idea in real life",
    themes: "Explain it through",
    breaks: "Where this comparison breaks",
    helped: "Did this help?",
    yes: "Yes",
    no: "Not really",
    thanks: "Thanks — your teacher sees which comparisons work.",
    listen: "Listen",
    stop: "Stop",
  },
  ta: {
    label: "வாழ்க்கை இணைப்பு",
    sub: "இந்தக் கருத்து அன்றாட வாழ்வில்",
    themes: "இதன் வழியாக விளக்கு",
    breaks: "இந்த ஒப்புமை எங்கே பொருந்தாது",
    helped: "இது உதவியதா?",
    yes: "ஆம்",
    no: "இல்லை",
    thanks: "நன்றி — எந்த ஒப்புமைகள் பயனுள்ளவை என்று ஆசிரியர் அறிவார்.",
    listen: "கேளுங்கள்",
    stop: "நிறுத்து",
  },
} as const;

const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

/**
 * One concept explained through everyday life. Amber is Life Link's identity
 * colour (warm, "from home"); everything else uses the shared theme tokens so the
 * card works in light and dark without per-theme class pairs.
 */
export function LifeLinkCard({ concept, compact = false }: { concept: LifeLinkConcept; compact?: boolean }) {
  const { locale } = useLocale();
  const progress = useProgress();
  const { state: speech, play, stop } = useReadAloud();
  const [index, setIndex] = useState(0);
  const copy = COPY[locale];
  const analogy = concept.analogies[index] ?? concept.analogies[0];
  if (!analogy) return null;

  const vote = progress.analogyVotes[analogy.id];
  const reading = speech.id === analogy.id;
  const castVote = (v: 1 | -1) => updateProgress((p) => voteAnalogy(p, analogy.id, vote === v ? null : v));
  const titleId = `${concept.id}-title`;

  return (
    <section
      aria-labelledby={titleId}
      className={`relative overflow-hidden rounded-2xl border border-line bg-surface/80 text-text shadow-sm ${
        compact ? "p-4" : "p-5 sm:p-6"
      }`}
    >
      {/* Identity rail */}
      <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-amber" />

      <header className="flex items-start gap-3">
        <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-xl bg-amber/15 text-amber">
          <Plant size={18} weight="fill" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted">
            <span className="font-semibold text-amber">{copy.label}</span> · {copy.sub}
          </p>
          <h4 id={titleId} className="mt-0.5 font-display text-base font-semibold leading-snug sm:text-lg">
            {concept.concept[locale]}
          </h4>
        </div>
        <button
          type="button"
          onClick={() => (reading ? stop() : play(analogy.id, [analogy.body[locale]], locale))}
          aria-pressed={reading}
          className={`flex shrink-0 items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-muted transition-colors hover:border-amber/50 hover:text-text active:scale-[0.98] ${FOCUS}`}
        >
          {reading ? <Stop size={13} weight="fill" aria-hidden /> : <SpeakerHigh size={13} aria-hidden />}
          <span>{reading ? copy.stop : copy.listen}</span>
        </button>
      </header>

      {concept.analogies.length > 1 && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted">{copy.themes}</span>
          <div role="tablist" aria-label={copy.themes} className="inline-flex gap-1 rounded-xl border border-line bg-bg/40 p-1">
            {concept.analogies.map((a, i) => {
              const active = i === index;
              return (
                <button
                  key={a.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    stop();
                    setIndex(i);
                  }}
                  className={`rounded-lg px-3 py-1 text-xs transition-colors ${FOCUS} ${
                    active ? "bg-amber/20 font-semibold text-text" : "text-muted hover:text-text"
                  }`}
                >
                  <span aria-hidden>{THEME_EMOJI[a.theme]}</span> {THEME_LABEL[a.theme][locale]}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <p className={`mt-4 max-w-prose leading-relaxed ${compact ? "text-sm" : "text-sm sm:text-[15px]"}`}>
        {analogy.body[locale]}
      </p>

      <details className="group mt-4 rounded-xl border border-line bg-bg/30">
        <summary
          className={`flex cursor-pointer list-none items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-muted transition-colors hover:text-text [&::-webkit-details-marker]:hidden ${FOCUS}`}
        >
          <Warning size={14} weight="fill" className="text-amber" aria-hidden />
          <span className="flex-1">{copy.breaks}</span>
          <CaretRight size={12} aria-hidden className="transition-transform group-open:rotate-90 motion-reduce:transition-none" />
        </summary>
        <p className="px-3 pb-3 text-xs leading-relaxed text-muted sm:text-sm">{analogy.breaksDown[locale]}</p>
      </details>

      <footer className="mt-4 flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted">{copy.helped}</span>
        {([
          [1, copy.yes, ThumbsUp],
          [-1, copy.no, ThumbsDown],
        ] as const).map(([v, label, Icon]) => {
          const on = vote === v;
          return (
            <button
              key={v}
              type="button"
              aria-pressed={on}
              onClick={() => castVote(v)}
              className={`flex items-center gap-1 rounded-full border px-3 py-1 text-xs transition-colors active:scale-[0.98] ${FOCUS} ${
                on ? "border-amber/60 bg-amber/15 font-semibold text-text" : "border-line text-muted hover:text-text"
              }`}
            >
              <Icon size={13} weight={on ? "fill" : "regular"} aria-hidden /> {label}
            </button>
          );
        })}
        {vote !== undefined && (
          <span role="status" className="text-[11px] text-muted">
            {copy.thanks}
          </span>
        )}
      </footer>
    </section>
  );
}
