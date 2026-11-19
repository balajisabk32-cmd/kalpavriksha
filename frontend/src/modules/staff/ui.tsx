"use client";

import { Check, Copy, DownloadSimple, Printer, WarningCircle } from "@phosphor-icons/react/ssr";
import { useId, useState, type ReactNode } from "react";
import { useLocale } from "@/components/locale-provider";
import { STAFF_COPY, type ErrorCode, type StaffCopy } from "./copy";

export function useStaffCopy(): StaffCopy {
  const { locale } = useLocale();
  return STAFF_COPY[locale];
}

export const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet focus-visible:ring-offset-2 focus-visible:ring-offset-bg";
export const BTN_PRIMARY = `inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-purple-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-purple-700 disabled:cursor-wait disabled:opacity-60 ${FOCUS}`;
export const BTN_SECONDARY = `inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-line-strong px-4 text-sm font-semibold text-text transition-colors hover:bg-violet/[0.08] disabled:opacity-60 ${FOCUS}`;
export const BTN_DANGER = `inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-danger/50 px-4 text-sm font-semibold text-danger transition-colors hover:bg-danger/[0.08] disabled:opacity-60 ${FOCUS}`;
export const INPUT =
  "min-h-11 w-full rounded-xl border border-line-strong bg-bg/60 px-3 text-sm text-text placeholder:text-muted/70 transition-colors focus:border-violet focus:outline-none focus-visible:ring-2 focus-visible:ring-violet/50";

export function PageHeader({ title, lead, actions }: { title: string; lead?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        {lead && <p className="mt-1.5 text-sm leading-relaxed text-muted">{lead}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, lead, children, className = "" }: { title?: string; lead?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-line bg-surface/80 p-5 sm:p-6 ${className}`}>
      {title && <h2 className="font-display text-lg font-semibold">{title}</h2>}
      {lead && <p className="mt-1 text-sm leading-relaxed text-muted">{lead}</p>}
      <div className={title || lead ? "mt-4" : ""}>{children}</div>
    </section>
  );
}

/** A labelled field. `children` gets the input's id and the hint/error ids to describe it. */
export function Field({
  label,
  hint,
  optional,
  children,
}: {
  label: string;
  hint?: string;
  optional?: boolean;
  children: (props: { id: string; "aria-describedby"?: string }) => ReactNode;
}) {
  const id = useId();
  const c = useStaffCopy();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
        {optional && <span className="ml-1.5 font-normal text-muted">({c.optional})</span>}
      </label>
      {children({ id, "aria-describedby": hint ? `${id}-hint` : undefined })}
      {hint && (
        <p id={`${id}-hint`} className="text-xs leading-relaxed text-muted">
          {hint}
        </p>
      )}
    </div>
  );
}

export function ErrorNote({ code }: { code?: ErrorCode }) {
  const c = useStaffCopy();
  if (!code) return null;
  return (
    <p role="alert" className="flex gap-2 rounded-xl border border-danger/40 bg-danger/[0.08] p-3 text-sm leading-relaxed">
      <WarningCircle size={18} weight="fill" className="mt-0.5 shrink-0 text-danger" aria-hidden />
      <span>{c.errors[code]}</span>
    </p>
  );
}

export function SavedNote({ show, children }: { show: boolean; children?: ReactNode }) {
  const c = useStaffCopy();
  if (!show) return null;
  return (
    <p role="status" className="flex items-center gap-2 text-sm text-success">
      <Check size={16} weight="bold" aria-hidden />
      {children ?? c.detail.saved}
    </p>
  );
}

export function formatWhen(iso: string | null, locale: string, never: string): string {
  if (!iso) return never;
  return new Intl.DateTimeFormat(locale === "ta" ? "ta-IN" : "en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}

export type SlipLogin = { readonly username: string; readonly password: string; readonly displayName: string; readonly standard?: number };

/** UTF-8 CSV with a BOM so Excel shows Tamil names correctly. */
function downloadCsv(rows: readonly SlipLogin[], c: StaffCopy) {
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = [
    [c.students.name, c.students.class, c.slip.username, c.slip.password, c.slip.site].map(esc).join(","),
    ...rows.map((r) => [r.displayName, r.standard ? String(r.standard) : "", r.username, r.password, window.location.origin].map(esc).join(",")),
  ];
  const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `kalpavriksha-logins-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * New logins, shown once. Prints as cut-out slips (one per student) and
 * downloads as a spreadsheet.
 */
export function LoginSlips({ logins }: { logins: readonly SlipLogin[] }) {
  const c = useStaffCopy();
  const [copied, setCopied] = useState(false);
  const site = typeof window === "undefined" ? "" : window.location.host;
  const one = logins.length === 1 ? logins[0] : null;

  const copyOne = async () => {
    if (!one) return;
    try {
      await navigator.clipboard.writeText(`${site}\n${c.slip.username}: ${one.username}\n${c.slip.password}: ${one.password}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked: the details are on screen to copy by hand.
    }
  };

  return (
    <div data-print-slips className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h2 role="status" className="font-display text-lg font-semibold text-success">
            {one ? c.slip.title : c.slip.titleMany(logins.length)}
          </h2>
          <p className="mt-1 text-sm text-muted">{c.slip.lead}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => window.print()} className={BTN_SECONDARY}>
            <Printer size={18} aria-hidden />
            {c.print}
          </button>
          {one ? (
            <button type="button" onClick={copyOne} className={BTN_SECONDARY} aria-live="polite">
              {copied ? <Check size={18} aria-hidden /> : <Copy size={18} aria-hidden />}
              {copied ? c.copied : c.copy}
            </button>
          ) : (
            <button type="button" onClick={() => downloadCsv(logins, c)} className={BTN_SECONDARY}>
              <DownloadSimple size={18} aria-hidden />
              {c.download}
            </button>
          )}
        </div>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 print:grid-cols-2 print:gap-0">
        {logins.map((l) => (
          <li
            key={l.username}
            className="break-inside-avoid rounded-xl border border-dashed border-line-strong bg-bg/40 p-4 print:rounded-none print:border-black print:bg-white print:text-black"
          >
            <p className="font-semibold">{l.displayName}</p>
            {l.standard && <p className="text-xs text-muted print:text-black">{c.classN(l.standard)}</p>}
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
              <dt className="text-muted print:text-black">{c.slip.site}</dt>
              <dd className="font-mono">{site}</dd>
              <dt className="text-muted print:text-black">{c.slip.username}</dt>
              <dd className="font-mono text-base font-semibold">{l.username}</dd>
              <dt className="text-muted print:text-black">{c.slip.password}</dt>
              <dd className="font-mono text-base font-semibold">{l.password}</dd>
            </dl>
          </li>
        ))}
      </ul>
    </div>
  );
}
