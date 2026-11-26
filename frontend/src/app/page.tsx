"use client";

import { ArrowRight, BookOpenText, CheckCircle, ListNumbers, PlayCircle, Target } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { LangSelect } from "@/components/landing/lang-select";
import { HOME_COPY } from "@/components/landing/home-copy";
import { useLocale } from "@/components/locale-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { accentOf } from "@/modules/accents";
import { MODULES } from "@/modules/registry";

const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet focus-visible:ring-offset-2 focus-visible:ring-offset-bg";
const PRIMARY = `inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-violet px-5 text-[15px] font-semibold text-white shadow-[0_1px_2px_rgb(24_18_43/0.2)] transition-[background-color,transform] duration-150 hover:bg-violet/90 active:scale-[0.98] dark:text-[#120e1f] ${FOCUS}`;
const SECONDARY = `inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-line-strong px-5 text-[15px] font-semibold transition-colors duration-150 hover:bg-surface-2 ${FOCUS}`;
const INSIDE_ICONS = [BookOpenText, PlayCircle, ListNumbers, Target] as const;

export default function Home() {
  const { locale } = useLocale();
  const c = HOME_COPY[locale];
  const ta = locale === "ta";

  return (
    <div className="min-h-[100dvh] bg-bg text-text">
      <a href="#main" className={`sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2 ${FOCUS}`}>
        {c.nav.inside}
      </a>

      <header className="sticky top-0 z-40 border-b border-line bg-bg/95 backdrop-blur supports-[backdrop-filter]:bg-bg/80">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link href="/" className={`flex items-center gap-2 rounded-lg font-headline text-lg font-semibold tracking-tight ${FOCUS}`}>
            <BrandMark className="size-7 text-violet" strokeWidth={1.8} />
            <span>{ta ? "கல்பவிருக்ஷா" : "Kalpavriksha"}</span>
          </Link>
          <nav aria-label="Sections" className="hidden items-center gap-1 text-sm font-medium text-muted md:flex">
            {(
              [
                ["#inside", c.nav.inside],
                ["#subjects", c.nav.subjects],
                ["#start", c.nav.start],
              ] as const
            ).map(([href, label]) => (
              <a key={href} href={href} className={`rounded-lg px-3 py-2 transition-colors duration-150 hover:bg-surface-2 hover:text-text ${FOCUS}`}>
                {label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <LangSelect />
            <ThemeToggle />
            <Link href="/sign-in" className={`hidden h-11 items-center rounded-xl bg-violet px-4 text-sm font-semibold text-white transition-colors duration-150 hover:bg-violet/90 dark:text-[#120e1f] sm:inline-flex ${FOCUS}`}>
              {ta ? "உள்நுழை" : "Sign in"}
            </Link>
          </div>
        </div>
      </header>

      <main id="main">
        {/* Hero: what it is, who it's for, one action. */}
        <section className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-4 pb-16 pt-10 sm:px-6 sm:pt-14 lg:grid-cols-[1.05fr_1fr] lg:gap-14 lg:pb-24 lg:pt-20">
          <div className="min-w-0">
            <h1 className={`font-headline font-semibold tracking-[-0.02em] text-balance ${ta ? "text-[2rem] leading-[1.25] sm:text-[2.6rem]" : "text-[2.5rem] leading-[1.05] sm:text-[3.6rem]"}`}>
              {c.title[0]} <span className="text-violet">{c.title[1]}</span>
            </h1>
            <p className="mt-5 max-w-[34rem] text-[17px] leading-relaxed text-muted sm:text-lg">{c.lead}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/sign-in" className={PRIMARY}>
                {c.signIn} <ArrowRight size={18} weight="bold" aria-hidden />
              </Link>
              <a href="#inside" className={SECONDARY}>
                {c.seeInside}
              </a>
            </div>
            <p className="mt-3 text-sm text-muted">{c.loginNote}</p>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 border-t border-line pt-6 text-sm font-medium">
              {c.facts.map((f) => (
                <li key={f} className="flex items-center gap-2">
                  <CheckCircle size={18} weight="fill" className="text-success" aria-hidden />
                  {f}
                </li>
              ))}
            </ul>
          </div>
          <ProductPreview c={c.preview} />
        </section>

        {/* Inside a chapter */}
        <section id="inside" className="scroll-mt-20 border-y border-line bg-surface">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16 lg:py-24">
            <div>
              <h2 className="font-headline text-3xl font-semibold tracking-[-0.02em] text-balance sm:text-4xl">{c.insideTitle}</h2>
              <p className="mt-4 max-w-md text-[17px] leading-relaxed text-muted">{c.insideLead}</p>
            </div>
            <ul className="grid gap-x-10 gap-y-9 sm:grid-cols-2">
              {c.inside.map((item, i) => {
                const Icon = INSIDE_ICONS[i]!;
                return (
                  <li key={item.title}>
                    <Icon size={28} weight="duotone" className="text-violet" aria-hidden />
                    <h3 className="mt-3 text-lg font-semibold leading-snug">{item.title}</h3>
                    <p className="mt-1.5 leading-relaxed text-muted">{item.body}</p>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        {/* Subjects */}
        <section id="subjects" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16 sm:px-6 lg:py-24">
          <h2 className="font-headline text-3xl font-semibold tracking-[-0.02em] text-balance sm:text-4xl">{c.subjectsTitle}</h2>
          <p className="mt-4 max-w-2xl text-[17px] leading-relaxed text-muted">{c.subjectsLead}</p>
          <ul className="mt-8 flex flex-wrap gap-2.5">
            {c.subjects.map((s) => (
              <li key={s} className="rounded-full border border-line bg-surface px-4 py-2 text-[15px] font-medium">
                {s}
              </li>
            ))}
          </ul>

          <h2 className="mt-20 font-headline text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">{c.modulesTitle}</h2>
          <ul className="mt-6 divide-y divide-line border-y border-line">
            {MODULES.map((m) => {
              const Icon = m.icon;
              return (
                <li key={m.id}>
                  <Link href={`/m/${m.slug}`} className={`group flex items-center gap-4 rounded-lg py-5 transition-colors duration-150 hover:bg-surface-2/60 sm:px-2 ${FOCUS}`}>
                    <span className={`grid size-12 shrink-0 place-items-center rounded-xl bg-surface-2 ${accentOf(m.accent).text}`}>
                      <Icon size={24} weight="duotone" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-lg font-semibold">{m.title[locale]}</span>
                      <span className="block text-muted">{m.summary[locale]}</span>
                    </span>
                    <ArrowRight size={20} className="shrink-0 text-muted transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-text" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        {/* How to start */}
        <section id="start" className="scroll-mt-20 border-t border-line bg-surface">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
            <h2 className="font-headline text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">{c.startTitle}</h2>
            <ol className="mt-10 grid gap-8 sm:grid-cols-3">
              {c.steps.map((s, i) => (
                <li key={s.title} className="flex gap-4 sm:flex-col">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-violet-deep font-semibold tabular-nums text-violet-ink">{i + 1}</span>
                  <div>
                    <h3 className="text-lg font-semibold">{s.title}</h3>
                    <p className="mt-1 leading-relaxed text-muted">{s.body}</p>
                  </div>
                </li>
              ))}
            </ol>
            <Link href="/sign-in" className={`${PRIMARY} mt-12`}>
              {c.signIn} <ArrowRight size={18} weight="bold" aria-hidden />
            </Link>
          </div>
        </section>

        {/* Trust */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
            <BrandMark className="size-12 shrink-0 text-violet" strokeWidth={1.6} />
            <div>
              <h2 className="font-headline text-2xl font-semibold tracking-[-0.02em]">{c.trustTitle}</h2>
              <p className="mt-2 max-w-2xl leading-relaxed text-muted">{c.trustBody}</p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>
            © {new Date().getFullYear()} {c.rights}
          </p>
          <Link href="/sign-in" className={`rounded font-medium text-text underline-offset-4 hover:underline ${FOCUS}`}>
            {ta ? "உள்நுழை" : "Sign in"}
          </Link>
        </div>
      </footer>
    </div>
  );
}

type PreviewCopy = (typeof HOME_COPY)[keyof typeof HOME_COPY]["preview"];

/** A still of the real lesson and quiz screens, drawn in HTML so it is sharp and costs nothing to load. */
function ProductPreview({ c }: { c: PreviewCopy }) {
  return (
    <figure className="relative min-w-0">
      <div aria-hidden className="overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_24px_60px_-28px_rgb(36_24_72/0.35)]">
        <div className="border-b border-line px-5 py-4">
          <p className="text-xs font-medium text-muted">{c.crumbs}</p>
          <p className="mt-0.5 font-headline text-lg font-semibold">{c.chapter}</p>
          <div className="mt-3 flex gap-1.5 overflow-hidden">
            {c.tabs.map((tab, i) => (
              <span key={tab} className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-[13px] font-medium ${i === 3 ? "bg-violet text-white dark:text-[#120e1f]" : "bg-surface-2 text-muted"}`}>
                {tab}
              </span>
            ))}
          </div>
        </div>
        <div className="p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[13px] font-semibold text-violet">{c.question}</p>
            <div className="flex gap-1">
              {Array.from({ length: 10 }, (_, i) => (
                <span key={i} className={`h-1.5 w-3.5 rounded-full ${i < 3 ? "bg-success" : i === 3 ? "bg-violet" : "bg-line-strong"}`} />
              ))}
            </div>
          </div>
          <p className="mt-3 text-[17px] font-semibold">{c.q}</p>
          <ul className="mt-4 flex flex-col gap-2">
            {c.options.map((o, i) => (
              <li
                key={o}
                className={`flex items-center justify-between rounded-xl border px-4 py-3 font-mono text-[15px] ${i === 1 ? "border-success/60 bg-success/10" : "border-line"}`}
              >
                <span>
                  <span className="mr-2 font-sans font-semibold text-muted">({String.fromCharCode(97 + i)})</span>
                  {o}
                </span>
                {i === 1 && <CheckCircle size={20} weight="fill" className="text-success" />}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm font-semibold text-success">{c.right}</p>
        </div>
      </div>
      <figcaption className="mt-3 text-center text-sm text-muted">{c.caption}</figcaption>
    </figure>
  );
}
