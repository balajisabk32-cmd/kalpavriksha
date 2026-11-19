"use client";

import { Eye, EyeSlash, SignIn, WarningCircle } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { useActionState, useState } from "react";
import { BrandMark } from "@/components/brand-mark";
import { LangSelect } from "@/components/landing/lang-select";
import { useLocale } from "@/components/locale-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { signInAction, type SignInState } from "./actions";

const COPY = {
  en: {
    title: "Sign in",
    lead: "Use the username and password your teacher gave you.",
    username: "Username",
    password: "Password",
    show: "Show password",
    hide: "Hide password",
    submit: "Sign in",
    working: "Signing in…",
    forgot: "Forgot your password? Ask your teacher or the Kalpavriksha office to reset it.",
    home: "Kalpavriksha home",
    errors: {
      missing: "Enter your username and password.",
      invalid: "That username and password don't match. Check them and try again.",
      locked: "Too many wrong tries. Wait 15 minutes, or ask your teacher to reset your password.",
      archived: "This account is closed. Ask the Kalpavriksha office if you need it back.",
      server: "Something went wrong on our side. Try again in a minute.",
    },
  },
  ta: {
    title: "உள்நுழை",
    lead: "உங்கள் ஆசிரியர் தந்த பயனர் பெயரையும் கடவுச்சொல்லையும் பயன்படுத்துங்கள்.",
    username: "பயனர் பெயர்",
    password: "கடவுச்சொல்",
    show: "கடவுச்சொல்லைக் காட்டு",
    hide: "கடவுச்சொல்லை மறை",
    submit: "உள்நுழை",
    working: "உள்நுழைகிறது…",
    forgot: "கடவுச்சொல் மறந்துவிட்டதா? உங்கள் ஆசிரியரிடமோ கல்பவிருட்சம் அலுவலகத்திலோ புதிதாக அமைக்கக் கேளுங்கள்.",
    home: "கல்பவிருட்சம் முகப்பு",
    errors: {
      missing: "பயனர் பெயரையும் கடவுச்சொல்லையும் உள்ளிடுங்கள்.",
      invalid: "பயனர் பெயரும் கடவுச்சொல்லும் பொருந்தவில்லை. சரிபார்த்து மீண்டும் முயலுங்கள்.",
      locked: "பலமுறை தவறாக உள்ளிட்டீர்கள். 15 நிமிடம் காத்திருங்கள், அல்லது ஆசிரியரிடம் கடவுச்சொல்லை மாற்றக் கேளுங்கள்.",
      archived: "இந்தக் கணக்கு மூடப்பட்டுள்ளது. மீண்டும் வேண்டுமெனில் கல்பவிருட்சம் அலுவலகத்தைக் கேளுங்கள்.",
      server: "எங்கள் பக்கம் ஏதோ தவறு. ஒரு நிமிடம் கழித்து மீண்டும் முயலுங்கள்.",
    },
  },
} as const;

const FIELD =
  "min-h-12 w-full rounded-xl border border-line-strong bg-bg/60 px-4 text-base text-text placeholder:text-muted/70 transition-colors focus:border-violet focus:outline-none focus-visible:ring-2 focus-visible:ring-violet/60";

export function SignInForm({ next }: { next: string }) {
  const { locale } = useLocale();
  const c = COPY[locale];
  const [state, action, pending] = useActionState<SignInState, FormData>(signInAction, {});
  const [showPassword, setShowPassword] = useState(false);
  const errorId = "sign-in-error";

  return (
    <div className="relative isolate flex min-h-[100dvh] flex-col bg-bg text-text">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,color-mix(in_srgb,var(--glow-a)_22%,transparent),transparent_60%)]"
      />
      <header className="flex items-center justify-between gap-3 px-4 py-4 sm:px-8">
        <Link
          href="/"
          aria-label={c.home}
          className="flex min-h-11 items-center gap-2 rounded-xl px-2 font-title text-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet"
        >
          <BrandMark className="size-6 text-violet" />
          <span>Kalpavriksha</span>
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <LangSelect />
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 pb-16">
        <div className="w-full max-w-sm rounded-3xl border border-line bg-surface/90 p-6 shadow-[0_30px_80px_-40px_rgb(0_0_0/0.8)] backdrop-blur-sm sm:p-8">
          <h1 className="font-display text-2xl font-bold tracking-tight">{c.title}</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">{c.lead}</p>

          <form action={action} className="mt-6 flex flex-col gap-4" aria-describedby={state.error ? errorId : undefined}>
            <input type="hidden" name="next" value={next} />
            <div className="flex flex-col gap-1.5">
              <label htmlFor="username" className="text-sm font-medium">
                {c.username}
              </label>
              <input
                id="username"
                name="username"
                defaultValue={state.username}
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                required
                aria-invalid={state.error === "invalid" || state.error === "missing" || undefined}
                className={FIELD}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className="text-sm font-medium">
                {c.password}
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  aria-invalid={state.error === "invalid" || state.error === "missing" || undefined}
                  className={`${FIELD} pr-12`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? c.hide : c.show}
                  aria-pressed={showPassword}
                  className="absolute inset-y-0 right-0 grid w-12 place-items-center rounded-r-xl text-muted transition-colors hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet"
                >
                  {showPassword ? <EyeSlash size={20} aria-hidden /> : <Eye size={20} aria-hidden />}
                </button>
              </div>
            </div>

            {state.error && (
              <p id={errorId} role="alert" className="flex gap-2 rounded-xl border border-danger/40 bg-danger/[0.08] p-3 text-sm leading-relaxed">
                <WarningCircle size={18} weight="fill" className="mt-0.5 shrink-0 text-danger" aria-hidden />
                <span>{c.errors[state.error]}</span>
              </p>
            )}

            <button
              type="submit"
              disabled={pending}
              className="mt-1 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-purple-600 px-5 text-base font-semibold text-white transition-colors hover:bg-purple-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-wait disabled:opacity-70"
            >
              <SignIn size={20} aria-hidden />
              {pending ? c.working : c.submit}
            </button>
          </form>

          <p className="mt-5 text-xs leading-relaxed text-muted">{c.forgot}</p>
        </div>
      </main>
    </div>
  );
}
