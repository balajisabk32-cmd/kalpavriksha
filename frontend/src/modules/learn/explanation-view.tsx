"use client";

import { BookBookmark, CaretDown, Lightbulb, ListChecks, Question, Sparkle } from "@phosphor-icons/react/ssr";
import { useLocale } from "@/components/locale-provider";
import type { Explanation } from "@/lib/explanation";

const COPY = {
  en: {
    title: "Understand the chapter",
    lead: "Simple explanations with examples from everyday life.",
    analogy: "Real-life example",
    example: "Example",
    keyPoints: "Remember",
    words: "Important words",
    check: "Check yourself",
    showAnswer: "Show answer",
    draft: "Draft — only staff can see this until it is published.",
    otherMedium: { en: "Shown in English: the Tamil version is not ready yet.", ta: "Shown in Tamil: the English version is not ready yet." },
  },
  ta: {
    title: "பாடத்தைப் புரிந்துகொள்",
    lead: "அன்றாட வாழ்க்கை உதாரணங்களுடன் எளிய விளக்கம்.",
    analogy: "நிஜ வாழ்க்கை ஒப்புமை",
    example: "எடுத்துக்காட்டு",
    keyPoints: "நினைவில் கொள்",
    words: "முக்கியச் சொற்கள்",
    check: "உன்னைச் சோதித்துப் பார்",
    showAnswer: "விடையைக் காட்டு",
    draft: "வரைவு — வெளியிடும் வரை ஆசிரியர்களுக்கு மட்டுமே தெரியும்.",
    otherMedium: { en: "ஆங்கிலத்தில் காட்டப்படுகிறது: தமிழ்ப் பதிப்பு இன்னும் தயாராகவில்லை.", ta: "தமிழில் காட்டப்படுகிறது: ஆங்கிலப் பதிப்பு இன்னும் தயாராகவில்லை." },
  },
} as const;

const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet focus-visible:ring-offset-2 focus-visible:ring-offset-bg";

/** Splits on blank lines / "\n" so long answers read as paragraphs. */
function Paragraphs({ text, className = "" }: { text: string; className?: string }) {
  return (
    <>
      {text
        .split(/\n+/)
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p, i) => (
          <p key={i} className={className}>
            {p}
          </p>
        ))}
    </>
  );
}

/**
 * A chapter explanation. `lang` is the language it is written in (sets `lang`
 * for screen readers and Tamil fonts); `note` explains a fallback or a draft.
 */
export function ExplanationView({
  data,
  lang,
  draft = false,
  fallbackFrom,
}: {
  data: Explanation;
  lang: "en" | "ta";
  draft?: boolean;
  /** Set when this is the other medium's version (the reader's isn't ready). */
  fallbackFrom?: "en" | "ta";
}) {
  const { locale } = useLocale();
  const c = COPY[locale];
  return (
    <section aria-labelledby="explain-title" className="flex flex-col gap-4 rounded-3xl border border-line bg-surface/85 p-4 sm:p-6">
      <div>
        <h2 id="explain-title" className="flex items-center gap-2 font-display text-xl font-bold tracking-tight">
          <Sparkle size={22} weight="fill" aria-hidden className="text-violet" />
          {c.title}
        </h2>
        <p className="mt-1 text-sm text-muted">{c.lead}</p>
        {draft && <p className="mt-2 rounded-lg bg-amber-500/15 px-3 py-2 text-sm font-medium">{c.draft}</p>}
        {fallbackFrom && <p className="mt-2 text-xs text-muted">{c.otherMedium[lang]}</p>}
      </div>

      <div lang={lang} className="flex flex-col gap-4">
        <div className="rounded-2xl bg-violet/[0.08] p-4 text-[15px] leading-relaxed">
          <Paragraphs text={data.summary} className="[&+p]:mt-2" />
        </div>

        <ol className="flex flex-col gap-4">
          {data.sections.map((s, i) => (
            <li key={i} className="rounded-2xl border border-line bg-bg/30 p-4">
              <h3 className="flex items-baseline gap-2 text-base font-semibold">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-purple-600 text-xs font-bold text-white tabular-nums">{i + 1}</span>
                {s.heading}
              </h3>
              <div className="mt-2 flex flex-col gap-2 text-[15px] leading-relaxed">
                <Paragraphs text={s.explanation} />
              </div>
              <div className="mt-3 rounded-xl border-l-4 border-amber-400 bg-amber-400/10 p-3">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                  <Lightbulb size={16} weight="fill" aria-hidden />
                  {c.analogy}: <span className="normal-case tracking-normal">{s.analogy.title}</span>
                </p>
                <div className="mt-1.5 flex flex-col gap-2 text-[15px] leading-relaxed">
                  <Paragraphs text={s.analogy.story} />
                </div>
              </div>
              {s.example && (
                <div className="mt-3 text-sm leading-relaxed">
                  <p className="text-xs font-semibold text-muted">{c.example}</p>
                  <Paragraphs text={s.example} />
                </div>
              )}
            </li>
          ))}
        </ol>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-line p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <ListChecks size={18} aria-hidden className="text-violet" />
              {c.keyPoints}
            </h3>
            <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-5 text-sm leading-relaxed marker:text-violet">
              {data.keyPoints.map((k, i) => (
                <li key={i}>{k}</li>
              ))}
            </ul>
          </div>
          {data.words.length > 0 && (
            <div className="rounded-2xl border border-line p-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <BookBookmark size={18} aria-hidden className="text-violet" />
                {c.words}
              </h3>
              <dl className="mt-2 flex flex-col gap-1.5 text-sm">
                {data.words.map((w, i) => (
                  <div key={i}>
                    <dt className="inline font-semibold">{w.term}</dt> <dd className="inline text-muted">— {w.meaning}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </div>

        {data.checkYourself.length > 0 && (
          <div className="rounded-2xl border border-line p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <Question size={18} aria-hidden className="text-violet" />
              {c.check}
            </h3>
            <ol className="mt-2 flex flex-col gap-2">
              {data.checkYourself.map((q, i) => (
                <li key={i} className="rounded-xl bg-bg/40">
                  <details className="group">
                    <summary className={`flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm font-medium ${FOCUS}`}>
                      <span>
                        {i + 1}. {q.question}
                      </span>
                      <span className="flex shrink-0 items-center gap-1 text-xs text-muted">
                        {c.showAnswer}
                        <CaretDown size={14} aria-hidden className="transition-transform group-open:rotate-180 motion-reduce:transition-none" />
                      </span>
                    </summary>
                    <div className="px-3 pb-3 text-sm leading-relaxed text-text/90">
                      <Paragraphs text={q.answer} />
                    </div>
                  </details>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </section>
  );
}
