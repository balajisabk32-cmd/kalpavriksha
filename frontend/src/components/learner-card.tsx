"use client";

import { ArrowLeft, ArrowRight, BookOpen, Flame, Lock, SignOut, Star, Target } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, type MouseEvent } from "react";
import { signOutAction } from "@/app/sign-in/actions";
import { LangSelect } from "@/components/landing/lang-select";
import { useHydrated } from "@/components/learner-setup";
import { useLocale } from "@/components/locale-provider";
import { useProgress } from "@/components/progress-store";
import { useSessionUser, type ClientUser } from "@/components/session-user";
import { ThemeToggle } from "@/components/theme-toggle";
import type { Locale } from "@/lib/i18n";
import { badges, levelOf, localDay, streak, type Progress } from "@/lib/progress";
import { BADGE_INFO } from "@/modules/grow/content";

const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet focus-visible:ring-offset-2 focus-visible:ring-offset-bg";
const CARD = "rounded-2xl border border-line bg-surface p-5 sm:p-6";

const COPY = {
  en: {
    title: "My profile",
    home: "Home",
    classOf: (n: number) => `Class ${n}`,
    medium: { en: "English medium", ta: "Tamil medium" },
    continue: "Continue learning",
    start: "Start learning",
    level: "Level",
    xpToNext: (n: number, next: number) => `${n} XP to Level ${next}`,
    streak: "Day streak",
    days: (n: number) => (n === 1 ? "1 day" : `${n} days`),
    lessons: "Lessons done",
    quiz: "Best quiz score",
    noQuiz: "No quiz yet",
    week: "This week",
    weekNote: (n: number) => (n === 0 ? "Learn something today to start your streak." : `You learned on ${n} of the last 7 days.`),
    badges: "My badges",
    earned: (n: number, total: number) => `${n} of ${total} earned`,
    locked: "Not earned yet",
    account: "Account",
    username: "Username",
    signOut: "Sign out",
    back: "Back",
    confirmTitle: "Sign out?",
    confirmBody: "Your progress is saved. You'll need your username and password to sign in again.",
    cancel: "Stay signed in",
    loading: "Loading your profile…",
    error: "Couldn't load your profile.",
    retry: "Try again",
  },
  ta: {
    title: "என் சுயவிவரம்",
    home: "முகப்பு",
    classOf: (n: number) => `${n}ஆம் வகுப்பு`,
    medium: { en: "ஆங்கில வழி", ta: "தமிழ் வழி" },
    continue: "தொடர்ந்து கற்க",
    start: "கற்கத் தொடங்கு",
    level: "நிலை",
    xpToNext: (n: number, next: number) => `நிலை ${next}க்கு இன்னும் ${n} XP`,
    streak: "தொடர் நாட்கள்",
    days: (n: number) => `${n} நாள்`,
    lessons: "முடித்த பாடங்கள்",
    quiz: "சிறந்த வினாடி வினா மதிப்பெண்",
    noQuiz: "இன்னும் இல்லை",
    week: "இந்த வாரம்",
    weekNote: (n: number) => (n === 0 ? "இன்று ஏதாவது கற்று உன் தொடரைத் தொடங்கு." : `கடந்த 7 நாட்களில் ${n} நாள் கற்றாய்.`),
    badges: "என் பதக்கங்கள்",
    earned: (n: number, total: number) => `${total}இல் ${n} பெற்றாய்`,
    locked: "இன்னும் பெறவில்லை",
    account: "கணக்கு",
    username: "பயனர் பெயர்",
    signOut: "வெளியேறு",
    back: "பின்செல்",
    confirmTitle: "வெளியேறவா?",
    confirmBody: "உன் முன்னேற்றம் சேமிக்கப்பட்டுள்ளது. மீண்டும் உள்நுழைய உன் பயனர் பெயரும் கடவுச்சொல்லும் தேவை.",
    cancel: "உள்நுழைந்தே இரு",
    loading: "உன் சுயவிவரம் ஏற்றப்படுகிறது…",
    error: "சுயவிவரத்தை ஏற்ற முடியவில்லை.",
    retry: "மீண்டும் முயல்",
  },
} as const;
type Copy = (typeof COPY)[Locale];

/** The seven local days ending today, oldest first. */
function lastSevenDays(today: string, locale: Locale) {
  const fmt = new Intl.DateTimeFormat(locale === "ta" ? "ta-IN" : "en-GB", { weekday: "short" });
  const base = new Date(`${today}T12:00:00`);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(base);
    d.setDate(d.getDate() - (6 - i));
    return { key: localDay(d), label: fmt.format(d), isToday: i === 6 };
  });
}

function Stat({ icon: Icon, label, value, note }: { icon: typeof Star; label: string; value: string; note?: string }) {
  return (
    <div className="rounded-xl border border-line bg-bg p-4">
      <Icon size={22} weight="duotone" className="text-violet" aria-hidden />
      <p className="mt-2 font-headline text-2xl font-semibold leading-none">{value}</p>
      <p className="mt-1.5 text-sm text-muted">{label}</p>
      {note && <p className="mt-1 text-xs text-muted">{note}</p>}
    </div>
  );
}

/** Sign out, after a confirm dialog (native <dialog>: Escape and the backdrop close it, focus stays inside). */
function SignOutButton({ c }: { c: Copy }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const close = () => dialog.current?.close();
  return (
    <>
      <button type="button" onClick={() => dialog.current?.showModal()} className={`mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl border border-line-strong px-4 text-[15px] font-semibold transition-colors duration-150 hover:bg-surface-2 ${FOCUS}`}>
        <SignOut size={18} aria-hidden /> {c.signOut}
      </button>
      <dialog
        ref={dialog}
        aria-labelledby="signout-title"
        onClick={(e) => e.target === e.currentTarget && close()}
        className="fixed inset-0 m-auto h-fit w-[calc(100%_-_2rem)] max-w-md rounded-2xl border border-line bg-surface p-6 text-text shadow-[0_24px_60px_-20px_rgb(24_18_43/0.45)] backdrop:bg-[rgb(24_18_43/0.5)]"
      >
        <h2 id="signout-title" className="font-headline text-xl font-semibold">{c.confirmTitle}</h2>
        <p className="mt-2 text-[15px] leading-relaxed text-muted">{c.confirmBody}</p>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" autoFocus onClick={close} className={`inline-flex min-h-11 items-center justify-center rounded-xl border border-line-strong px-4 text-[15px] font-semibold transition-colors duration-150 hover:bg-surface-2 ${FOCUS}`}>
            {c.cancel}
          </button>
          <form action={signOutAction}>
            <button type="submit" className={`inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-danger px-4 text-[15px] font-semibold text-white transition-opacity dark:text-[#120e1f] duration-150 hover:opacity-90 ${FOCUS}`}>
              <SignOut size={18} aria-hidden /> {c.signOut}
            </button>
          </form>
        </div>
      </dialog>
    </>
  );
}

/** Back to the previous page when it was in this app; otherwise to the student's lessons (never the landing page). */
function BackLink({ c }: { c: Copy }) {
  const router = useRouter();
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    const fromHere = document.referrer && new URL(document.referrer).origin === location.origin && !/^\/(sign-in)?$/.test(new URL(document.referrer).pathname);
    if (fromHere && history.length > 1) {
      e.preventDefault();
      router.back();
    }
  };
  return (
    <Link href="/m/learn" onClick={onClick} className={`inline-flex min-h-11 items-center gap-2 rounded-xl px-2 text-[15px] font-medium text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-text ${FOCUS}`}>
      <ArrowLeft size={18} aria-hidden /> {c.back}
    </Link>
  );
}

function Profile({ user, progress, c, locale }: { user: ClientUser; progress: Progress; c: Copy; locale: Locale }) {
  const today = localDay();
  const { level, into, span } = levelOf(progress.xp);
  const days = streak(progress.activeDays, today);
  const active = new Set(progress.activeDays);
  const week = lastSevenDays(today, locale);
  const weekCount = week.filter((d) => active.has(d.key)).length;
  const earned = badges(progress, today);
  const last = progress.profile?.lastAccessed;
  const continueHref = last ? `/m/learn?subject=${last.subjectId}&chapter=${last.chapterId}` : "/m/learn";
  const name = user.displayName || user.username;

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] lg:items-start lg:gap-6">
      {/* `contents` on phones lets the account card move to the very end (order-last). */}
      <div className="contents lg:flex lg:flex-col lg:gap-5">
        {/* Who I am, and the one main action */}
        <section className={CARD} aria-labelledby="me-name">
          <div className="flex items-center gap-4">
            <div aria-hidden className="grid size-16 shrink-0 place-items-center rounded-full bg-violet-deep font-headline text-2xl font-semibold text-violet-ink dark:text-violet">
              {name.trim().charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h1 id="me-name" className="truncate font-headline text-2xl font-semibold tracking-tight">{name}</h1>
              {user.student && (
                <p className="mt-1 text-[15px] text-muted">
                  {c.classOf(user.student.standard)} · {c.medium[user.student.medium]}
                </p>
              )}
            </div>
          </div>
          <Link href={continueHref} className={`mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-violet px-5 text-[15px] font-semibold text-white transition-[background-color,transform] duration-150 hover:bg-violet/90 active:scale-[0.98] dark:text-[#120e1f] ${FOCUS}`}>
            {last ? c.continue : c.start} <ArrowRight size={18} weight="bold" aria-hidden />
          </Link>
        </section>

        {/* Level */}
        <section className={CARD} aria-labelledby="me-level">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="me-level" className="font-headline text-lg font-semibold">
              {c.level} {level}
            </h2>
            <span className="text-sm text-muted">{progress.xp} XP</span>
          </div>
          <div className="mt-3 h-3 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuemin={0} aria-valuemax={span} aria-valuenow={into} aria-label={`${c.level} ${level}`}>
            <div className="h-full rounded-full bg-violet transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${Math.round((into / span) * 100)}%` }} />
          </div>
          <p className="mt-2 text-sm text-muted">{c.xpToNext(span - into, level + 1)}</p>
        </section>

        {/* Account: last on phones, under the level card on wide screens */}
        <section className={`${CARD} order-last lg:order-none`} aria-labelledby="me-account">
          <h2 id="me-account" className="font-headline text-lg font-semibold">{c.account}</h2>
          <dl className="mt-3 text-[15px]">
            <div className="flex justify-between gap-3 border-b border-line py-2.5">
              <dt className="text-muted">{c.username}</dt>
              <dd className="truncate font-medium">{user.username}</dd>
            </div>
          </dl>
          <SignOutButton c={c} />
        </section>
      </div>

      <div className="flex flex-col gap-5">
        {/* Real numbers only */}
        <section aria-label={c.title} className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat icon={Flame} label={c.streak} value={c.days(days)} />
          <Stat icon={BookOpen} label={c.lessons} value={String(progress.lessonsDone.length)} />
          <div className="col-span-2 sm:col-span-1">
            <Stat icon={Target} label={c.quiz} value={progress.quizBest > 0 ? `${progress.quizBest}%` : "—"} note={progress.quizBest > 0 ? undefined : c.noQuiz} />
          </div>
        </section>

        {/* This week */}
        <section className={CARD} aria-labelledby="me-week">
          <h2 id="me-week" className="font-headline text-lg font-semibold">{c.week}</h2>
          <ol className="mt-4 grid grid-cols-7 gap-1 sm:gap-1.5">
            {week.map((d) => {
              const on = active.has(d.key);
              return (
                <li key={d.key} className="flex flex-col items-center gap-1.5">
                  <span
                    className={`grid size-8 place-items-center sm:size-9 rounded-full border text-sm ${on ? "border-violet bg-violet text-white dark:text-[#120e1f]" : "border-line-strong text-muted"} ${d.isToday ? "ring-2 ring-violet/40 ring-offset-2 ring-offset-surface" : ""}`}
                  >
                    {on ? <Flame size={16} weight="fill" aria-hidden /> : null}
                    <span className="sr-only">{on ? "✓" : "–"}</span>
                  </span>
                  <span className={`text-xs ${d.isToday ? "font-semibold text-text" : "text-muted"}`}>{d.label}</span>
                </li>
              );
            })}
          </ol>
          <p className="mt-4 text-[15px] text-muted">{c.weekNote(weekCount)}</p>
        </section>

        {/* Badges, earned or with how to earn them */}
        <section className={CARD} aria-labelledby="me-badges">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="me-badges" className="font-headline text-lg font-semibold">{c.badges}</h2>
            <span className="text-sm text-muted">{c.earned(earned.filter((b) => b.earned).length, earned.length)}</span>
          </div>
          <ul className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {earned.map(({ id, earned: got }) => {
              const info = BADGE_INFO[id];
              const Icon = info.icon;
              return (
                <li key={id} className={`flex items-center gap-3 rounded-xl border p-3 ${got ? "border-violet/40 bg-violet-deep/50" : "border-line"}`}>
                  <span aria-hidden className={`grid size-10 shrink-0 place-items-center rounded-lg ${got ? "bg-violet text-white dark:text-[#120e1f]" : "bg-surface-2 text-muted"}`}>
                    {got ? <Icon size={20} weight="fill" /> : <Lock size={18} />}
                  </span>
                  <span className="min-w-0">
                    <span className={`block text-[15px] font-semibold ${got ? "" : "text-muted"}`}>{info.name[locale]}</span>
                    <span className="block text-sm text-muted">{got ? info.how[locale] : `${c.locked} · ${info.how[locale]}`}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </div>
  );
}

/** "My profile" for the signed-in account (/me). */
export function MyCardScreen() {
  const { locale } = useLocale();
  const c = COPY[locale];
  const progress = useProgress();
  const hydrated = useHydrated();
  const session = useSessionUser();

  return (
    <div className="min-h-[100dvh] bg-bg text-text">
      <header className="sticky top-0 z-40 border-b border-line bg-bg/95">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
          <BackLink c={c} />
          <div className="flex items-center gap-2">
            <LangSelect />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
        {session.status === "error" ? (
          <div role="alert" className={`${CARD} text-center`}>
            <p className="text-[15px]">{c.error}</p>
            <button type="button" onClick={session.retry} className={`mt-4 inline-flex min-h-11 items-center rounded-xl bg-violet px-5 text-[15px] font-semibold text-white dark:text-[#120e1f] ${FOCUS}`}>
              {c.retry}
            </button>
          </div>
        ) : !hydrated || session.status !== "ready" ? (
          <div role="status" aria-label={c.loading} className="grid gap-5 lg:grid-cols-[1fr_1.4fr]">
            <div className="h-72 animate-pulse rounded-2xl bg-surface-2 motion-reduce:animate-none" />
            <div className="h-72 animate-pulse rounded-2xl bg-surface-2 motion-reduce:animate-none" />
          </div>
        ) : (
          <Profile user={session.user} progress={progress} c={c} locale={locale} />
        )}
      </main>
    </div>
  );
}
