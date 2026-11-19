"use client";

import { ArrowLeft, ArrowRight, ArrowSquareOut, Check, CheckCircle, Copy, Eye, EyeSlash, Trash, WarningCircle } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { saveExplanationAction, setExplanationStatusAction } from "@/app/admin/content/actions";
import { useLocale } from "@/components/locale-provider";
import { parseExplanation } from "@/lib/explanation";
import { ExplanationView } from "@/modules/learn/explanation-view";
import { BTN_DANGER, BTN_PRIMARY, BTN_SECONDARY, Card, FOCUS, INPUT, PageHeader } from "./ui";

type Medium = "en" | "ta";
type Localized = { en: string; ta: string };
type Side = {
  prompt: string;
  pages: { title: string; startPage: number; endPage: number; textbookId: number } | null;
  saved: { status: "draft" | "published"; json: string; updatedAt: string } | null;
};

const COPY = {
  en: {
    back: "Videos & textbooks",
    title: (_n: number, t: string) => `Explanation · ${t}`,
    lead: "Make a simple explanation with real-life analogies using Gemini, check it, then publish it for students.",
    medium: { en: "English medium", ta: "Tamil medium" },
    status: { none: "Not written yet", draft: "Draft (students can't see it)", published: "Published — students see this" },
    step1: "1. Copy the prompt into Gemini",
    step1Lead: "Open Gemini, paste the prompt and send it. For the best result, attach the chapter's textbook pages too.",
    copy: "Copy prompt",
    copied: "Copied",
    openGemini: "Open Gemini",
    openPages: (a: number, b: number) => `Open textbook pages ${a}–${b}`,
    noPages: "Tip: set this chapter's textbook pages first, so Gemini follows the book.",
    step2: "2. Paste Gemini's answer",
    step2Lead: "Copy Gemini's whole reply (the JSON) and paste it here. It is checked as you paste.",
    pasteLabel: "Gemini's answer",
    valid: "Looks good — check the preview below.",
    saveDraft: "Save as draft",
    publish: "Save & publish",
    saved: "Saved.",
    step3: "3. Check before publishing",
    step3Lead: "Read it like a teacher: are the facts right, is the analogy accurate, is the language simple? Fix wording here in the box if needed.",
    unpublish: "Unpublish",
    publishSaved: "Publish",
    remove: "Delete",
    confirmRemove: "Delete this explanation?",
    nextChapter: "Next chapter",
    errors: { server: "Something went wrong. Try again.", not_found: "Chapter not found." } as Record<string, string>,
  },
  ta: {
    back: "காணொளிகள் & பாடநூல்கள்",
    title: (_n: number, t: string) => `விளக்கம் · ${t}`,
    lead: "Gemini உதவியுடன் நிஜ வாழ்க்கை ஒப்புமைகளுடன் எளிய விளக்கம் உருவாக்கி, சரிபார்த்து, மாணவர்களுக்கு வெளியிடுங்கள்.",
    medium: { en: "ஆங்கில வழி", ta: "தமிழ் வழி" },
    status: { none: "இன்னும் எழுதப்படவில்லை", draft: "வரைவு (மாணவர்களுக்குத் தெரியாது)", published: "வெளியிடப்பட்டது — மாணவர்கள் பார்க்கிறார்கள்" },
    step1: "1. கட்டளையை Gemini-இல் ஒட்டுங்கள்",
    step1Lead: "Gemini-ஐத் திறந்து கட்டளையை ஒட்டி அனுப்புங்கள். சிறந்த விளைவுக்கு, பாடநூல் பக்கங்களையும் இணையுங்கள்.",
    copy: "கட்டளையை நகலெடு",
    copied: "நகலெடுக்கப்பட்டது",
    openGemini: "Gemini-ஐத் திற",
    openPages: (a: number, b: number) => `பாடநூல் பக்கங்கள் ${a}–${b} திற`,
    noPages: "குறிப்பு: முதலில் இந்தப் பாடத்தின் பாடநூல் பக்கங்களை அமையுங்கள்; அப்போது Gemini நூலைப் பின்பற்றும்.",
    step2: "2. Gemini-இன் பதிலை ஒட்டுங்கள்",
    step2Lead: "Gemini-இன் முழுப் பதிலையும் (JSON) நகலெடுத்து இங்கே ஒட்டுங்கள். ஒட்டும்போதே சரிபார்க்கப்படும்.",
    pasteLabel: "Gemini-இன் பதில்",
    valid: "சரியாக உள்ளது — கீழே முன்னோட்டத்தைச் சரிபாருங்கள்.",
    saveDraft: "வரைவாகச் சேமி",
    publish: "சேமித்து வெளியிடு",
    saved: "சேமிக்கப்பட்டது.",
    step3: "3. வெளியிடும் முன் சரிபாருங்கள்",
    step3Lead: "ஆசிரியராகப் படியுங்கள்: தகவல்கள் சரியா, ஒப்புமை பொருத்தமா, மொழி எளிதா? தேவைப்பட்டால் பெட்டியிலேயே திருத்துங்கள்.",
    unpublish: "வெளியீட்டை நிறுத்து",
    publishSaved: "வெளியிடு",
    remove: "நீக்கு",
    confirmRemove: "இந்த விளக்கத்தை நீக்கவா?",
    nextChapter: "அடுத்த பாடம்",
    errors: { server: "ஏதோ தவறு. மீண்டும் முயலுங்கள்.", not_found: "பாடம் கிடைக்கவில்லை." } as Record<string, string>,
  },
} as const;

export function ExplainEditor({
  standard,
  subjectId,
  subjectName,
  chapterId,
  chapterTitle,
  chapterNumber,
  next,
  media,
}: {
  standard: number;
  subjectId: string;
  subjectName: Localized;
  chapterId: string;
  chapterTitle: Localized;
  chapterNumber: number;
  next: string | null;
  media: Record<Medium, Side>;
}) {
  const { locale } = useLocale();
  const c = COPY[locale];
  const router = useRouter();
  const [medium, setMedium] = useState<Medium>(media.en.saved && !media.ta.saved ? "ta" : "en");
  const side = media[medium];

  return (
    <>
      <Link href={`/admin/content/${subjectId}`} className={`inline-flex min-h-11 w-fit items-center gap-2 rounded-lg text-sm text-muted hover:text-text ${FOCUS}`}>
        <ArrowLeft size={16} aria-hidden />
        {c.back} · {subjectName[locale]} · {standard}
      </Link>
      <PageHeader title={c.title(chapterNumber, chapterTitle[locale] || chapterTitle.en)} lead={c.lead} />

      <div role="tablist" aria-label={c.lead} className="grid w-full max-w-md grid-cols-2 gap-1 rounded-2xl border border-line bg-surface p-1">
        {(["en", "ta"] as const).map((m) => (
          <button
            key={m}
            role="tab"
            type="button"
            aria-selected={medium === m}
            onClick={() => setMedium(m)}
            className={`flex min-h-11 flex-col items-center justify-center rounded-xl px-2 text-sm font-semibold ${FOCUS} ${medium === m ? "bg-purple-600 text-white" : "text-muted hover:text-text"}`}
          >
            {c.medium[m]}
            <span className={`text-[11px] font-normal ${medium === m ? "text-white/85" : ""}`}>{c.status[media[m].saved?.status ?? "none"]}</span>
          </button>
        ))}
      </div>

      {/* Keyed by medium and saved version, so the box resets to what is saved. */}
      <MediumEditor key={`${medium}-${side.saved?.updatedAt ?? "new"}`} chapterId={chapterId} medium={medium} side={side} onSaved={() => router.refresh()} />

      {next && (
        <Link href={`/admin/content/${subjectId}/explain/${next}`} className={`${BTN_SECONDARY} w-fit`}>
          {c.nextChapter}
          <ArrowRight size={16} aria-hidden />
        </Link>
      )}
    </>
  );
}

function MediumEditor({ chapterId, medium, side, onSaved }: { chapterId: string; medium: Medium; side: Side; onSaved: () => void }) {
  const { locale } = useLocale();
  const c = COPY[locale];
  const [raw, setRaw] = useState(side.saved?.json ?? "");
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, start] = useTransition();
  const parsed = useMemo(() => (raw.trim() ? parseExplanation(raw) : null), [raw]);
  const status = side.saved?.status ?? null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(side.prompt);
    } catch {
      // Older browsers: select the text so Ctrl+C works.
      (document.getElementById(`prompt-${medium}`) as HTMLTextAreaElement | null)?.select();
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const save = (publish: boolean) =>
    start(async () => {
      const r = await saveExplanationAction({ chapterId, medium, raw, publish });
      setMessage(r.ok ? { ok: true, text: c.saved } : { ok: false, text: c.errors[r.error] ?? r.error });
      if (r.ok) onSaved();
    });
  const setStatus = (to: "draft" | "published" | "delete") =>
    start(async () => {
      if (to === "delete" && !window.confirm(c.confirmRemove)) return;
      const r = await setExplanationStatusAction({ chapterId, medium, status: to });
      setMessage(r.ok ? { ok: true, text: c.saved } : { ok: false, text: c.errors[r.error] ?? r.error });
      if (r.ok) onSaved();
    });

  return (
    <>
      <Card title={c.step1} lead={c.step1Lead}>
        <label htmlFor={`prompt-${medium}`} className="sr-only">
          {c.step1}
        </label>
        <textarea id={`prompt-${medium}`} readOnly value={side.prompt} rows={10} className={`${INPUT} min-h-48 w-full font-mono text-xs leading-relaxed`} />
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={copy} className={BTN_PRIMARY}>
            {copied ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}
            {copied ? c.copied : c.copy}
          </button>
          <a href="https://gemini.google.com/app" target="_blank" rel="noopener noreferrer" className={BTN_SECONDARY}>
            {c.openGemini} <ArrowSquareOut size={14} aria-hidden />
          </a>
          {side.pages && (
            <a href={`/api/textbooks/${side.pages.textbookId}#page=${side.pages.startPage}`} target="_blank" rel="noopener" className={BTN_SECONDARY}>
              {c.openPages(side.pages.startPage, side.pages.endPage)} <ArrowSquareOut size={14} aria-hidden />
            </a>
          )}
        </div>
        {!side.pages && <p className="mt-2 text-xs text-muted">{c.noPages}</p>}
      </Card>

      <Card title={c.step2} lead={c.step2Lead}>
        <label htmlFor={`raw-${medium}`} className="sr-only">
          {c.pasteLabel}
        </label>
        <textarea
          id={`raw-${medium}`}
          value={raw}
          onChange={(e) => {
            setRaw(e.target.value);
            setMessage(null);
          }}
          rows={12}
          spellCheck={false}
          placeholder='{ "summary": "…", "sections": [ … ] }'
          className={`${INPUT} min-h-56 w-full font-mono text-xs leading-relaxed`}
        />
        {parsed && (
          <p role="status" className={`mt-2 flex items-start gap-1.5 text-sm ${parsed.ok ? "text-success" : "text-danger"}`}>
            {parsed.ok ? <CheckCircle size={18} aria-hidden className="mt-px shrink-0" /> : <WarningCircle size={18} aria-hidden className="mt-px shrink-0" />}
            {parsed.ok ? c.valid : parsed.error}
          </p>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" disabled={!parsed?.ok || busy} onClick={() => save(false)} className={BTN_SECONDARY}>
            {c.saveDraft}
          </button>
          <button type="button" disabled={!parsed?.ok || busy} onClick={() => save(true)} className={BTN_PRIMARY}>
            <Eye size={16} aria-hidden />
            {c.publish}
          </button>
          {status === "published" && (
            <button type="button" disabled={busy} onClick={() => setStatus("draft")} className={BTN_SECONDARY}>
              <EyeSlash size={16} aria-hidden />
              {c.unpublish}
            </button>
          )}
          {status === "draft" && raw === side.saved?.json && (
            <button type="button" disabled={busy} onClick={() => setStatus("published")} className={BTN_SECONDARY}>
              <Eye size={16} aria-hidden />
              {c.publishSaved}
            </button>
          )}
          {status && (
            <button type="button" disabled={busy} onClick={() => setStatus("delete")} className={BTN_DANGER}>
              <Trash size={16} aria-hidden />
              {c.remove}
            </button>
          )}
          {message && (
            <span role="status" className={`text-sm ${message.ok ? "text-success" : "text-danger"}`}>
              {message.text}
            </span>
          )}
        </div>
      </Card>

      {parsed?.ok && (
        <Card title={c.step3} lead={c.step3Lead}>
          <ExplanationView data={parsed.data} lang={medium} />
        </Card>
      )}
    </>
  );
}
