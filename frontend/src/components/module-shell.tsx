"use client";

import { ArrowLeft, Fire, IdentificationCard } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { type ReactNode } from "react";
import { Avatar } from "@/components/avatar";
import { BrandMark } from "@/components/brand-mark";
import { LangSelect } from "@/components/landing/lang-select";
import { useLocale } from "@/components/locale-provider";
import { useHydrated } from "@/components/learner-setup";
import { useSessionUser } from "@/components/session-user";
import { useProgress } from "@/components/progress-store";
import { SoundToggle } from "@/components/sound-toggle";
import { ThemeToggle } from "@/components/theme-toggle";
import { BAND_INFO } from "@/lib/bands";
import { bandOf, localDay, streak, type Band, type Profile } from "@/lib/progress";
import { MODULES, type KalpaModule } from "@/modules/registry";
import { accentOf } from "@/modules/accents";

/** Streak and profile avatar: the shared student profile, visible on every module. */
function ProgressPill() {
  const { t } = useLocale();
  const progress = useProgress();
  const days = streak(progress.activeDays, localDay());

  return (
    <div className="flex items-center gap-2" data-xp-pill>
      {days > 0 && (
        <span
          className="flex h-11 items-center gap-1.5 rounded-xl border border-amber/25 bg-amber/10 px-3 font-mono text-[12px] text-amber"
          title={`${days} ${t.streak}`}
        >
          <Fire size={16} weight="fill" aria-hidden />
          {days}
          <span className="sr-only">{t.streak}</span>
        </span>
      )}
      <Link
        href="/me"
        aria-label={progress.profile ? `${t.myCard}: ${progress.profile.name}` : t.myCard}
        className="grid size-11 place-items-center rounded-xl border border-line bg-surface transition-colors duration-150 hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet"
      >
        {progress.profile ? (
          <Avatar id={progress.profile.avatar} className="size-8" iconSize={18} />
        ) : (
          <IdentificationCard size={20} className="text-violet" />
        )}
      </Link>
    </div>
  );
}

/**
 * Full-screen edge-to-edge layout shared by every module screen.
 * Houses the top navigation header, module banner, and entire module content
 * without artificial bounding boxes or borders.
 */
export function ModuleShell({
  module,
  children,
}: {
  module: KalpaModule;
  children: (band: Band, profile: Profile) => ReactNode;
}) {
  const { t, locale } = useLocale();
  const progress = useProgress();
  const hydrated = useHydrated();
  const Icon = module.icon;
  const accent = accentOf(module.accent);
  const profile = progress.profile;
  const band = profile ? bandOf(profile.grade) : null;

  const session = useSessionUser();

  return (
    <div
      data-band={band ?? undefined}
      style={band ? ({ "--band": BAND_INFO[band].accent } as React.CSSProperties) : undefined}
      className="relative isolate min-h-[100dvh] w-full"
    >
      {/* Main Full-Screen Content Layer */}
      <div data-shell-content className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-7xl flex-col px-4 py-3 sm:px-6 sm:py-4 lg:px-8">
        {/* 1. Header: Back to home, module switcher tabs, XP pill & language selector */}
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
            <div className="flex items-center gap-2">
              <Link
                href="/"
                className="group flex h-11 items-center gap-2 rounded-xl px-2 text-sm font-semibold transition-colors duration-150 hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet"
              >
                <ArrowLeft size={16} className="transition-transform duration-200 group-hover:-translate-x-0.5" />
                <BrandMark className="size-5 text-violet" />
                <span className="sr-only sm:not-sr-only">{t.appName}</span>
              </Link>
              <nav aria-label={t.modulesTitle} className="flex gap-1 rounded-xl border border-line bg-surface p-1">
                {MODULES.map((m) => {
                  const ModIcon = m.icon;
                  const active = m.slug === module.slug;
                  const tabAccent = accentOf(m.accent);
                  return (
                    <Link
                      key={m.id}
                      href={`/m/${m.slug}`}
                      aria-current={active ? "page" : undefined}
                      title={m.title[locale]}
                      className={`grid size-10 place-items-center rounded-lg transition-colors duration-200 ${
                        active ? tabAccent.tabActive : "text-muted hover:bg-surface-2 hover:text-text"
                      }`}
                    >
                      <ModIcon size={18} weight={active ? "fill" : "regular"} aria-hidden />
                      <span className="sr-only">{m.title[locale]}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>
            <div className="flex items-center gap-2">
              <ProgressPill />
              <SoundToggle />
              <ThemeToggle />
              <LangSelect />
            </div>
          </header>

        {/* 2. Module title (Digital Learning draws its own greeting). */}
        {module.slug !== "learn" && (
          <div className="mt-6 flex items-center gap-3">
            <span className={`grid size-11 place-items-center rounded-xl bg-surface-2 ${accent.text}`}>
              <Icon size={22} weight="duotone" aria-hidden />
            </span>
            <div>
              <h1 className="font-headline text-2xl font-semibold tracking-tight sm:text-3xl">{module.title[locale]}</h1>
              <p className="text-sm text-muted">{module.summary[locale]}</p>
            </div>
          </div>
        )}

        {/* 3. Main Content: Full Screen Width across all modules */}
        <main className="mt-6 w-full flex-1 pb-10">
          {session.status === "error" ? (
            <div role="alert" className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-3xl border border-line bg-surface p-6 text-center">
              <p className="text-sm">{t.sessionError}</p>
              <button
                type="button"
                onClick={session.retry}
                className="min-h-11 rounded-xl bg-purple-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-purple-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet"
              >
                {t.retry}
              </button>
            </div>
          ) : hydrated && session.status === "ready" && profile && band ? (
            children(band, profile)
          ) : (
            <div role="status" aria-label={t.loading} className="h-72 animate-pulse rounded-3xl border border-line bg-surface/60 motion-reduce:animate-none" />
          )}
        </main>
      </div>
    </div>
  );
}
