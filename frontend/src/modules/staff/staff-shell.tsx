"use client";

import { SignOut } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { signOutAction } from "@/app/sign-in/actions";
import { BrandMark } from "@/components/brand-mark";
import { LangSelect } from "@/components/landing/lang-select";
import { ThemeToggle } from "@/components/theme-toggle";
import { FOCUS, useStaffCopy } from "./ui";

/** Header and navigation for the admin and teacher area. Plain and fast: no animated backgrounds. */
export function StaffShell({ role, name, children }: { role: "admin" | "teacher"; name: string; children: ReactNode }) {
  const c = useStaffCopy();
  const path = usePathname();
  const links =
    role === "admin"
      ? [
          { href: "/admin", label: c.nav.overview, exact: true },
          { href: "/admin/students", label: c.nav.students },
          { href: "/admin/content", label: c.nav.content },
          { href: "/admin/staff", label: c.nav.staff },
          { href: "/admin/settings", label: c.nav.settings },
          { href: "/teacher", label: c.nav.classes },
        ]
      : [{ href: "/teacher", label: c.nav.classes }];

  return (
    <div className="min-h-[100dvh] bg-bg text-text">
      <header className="sticky top-0 z-30 border-b border-line bg-bg/95 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
          <Link href={role === "admin" ? "/admin" : "/teacher"} className={`flex min-h-11 items-center gap-2 rounded-lg ${FOCUS}`}>
            <BrandMark className="size-6 text-violet" />
            <span className="font-title text-lg">{c.appName}</span>
            <span className="rounded-full border border-violet/40 bg-violet/10 px-2 py-0.5 text-xs font-medium text-violet">
              {role === "admin" ? c.areaAdmin : c.areaTeacher}
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <span className="hidden text-sm text-muted md:inline">
              {c.signedInAs} <span className="font-medium text-text">{name}</span>
            </span>
            <ThemeToggle />
            <LangSelect />
            <form action={signOutAction}>
              <button type="submit" aria-label={c.signOut} className={`inline-flex min-h-11 items-center gap-2 rounded-xl border border-line px-3 text-sm transition-colors hover:bg-violet/[0.08] ${FOCUS}`}>
                <SignOut size={18} aria-hidden />
                <span className="sr-only sm:not-sr-only">{c.signOut}</span>
              </button>
            </form>
          </div>
        </div>
        <nav aria-label={role === "admin" ? c.areaAdmin : c.areaTeacher} className="mx-auto max-w-6xl overflow-x-auto px-2 sm:px-4">
          <ul className="flex gap-1">
            {links.map((l) => {
              const active = l.exact ? path === l.href : path === l.href || path.startsWith(`${l.href}/`);
              return (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    aria-current={active ? "page" : undefined}
                    className={`inline-flex min-h-11 items-center whitespace-nowrap border-b-2 px-3 text-sm transition-colors ${FOCUS} ${
                      active ? "border-violet font-semibold text-text" : "border-transparent text-muted hover:text-text"
                    }`}
                  >
                    {l.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </header>
      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}
