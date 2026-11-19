"use client";

import { ArrowLeft, DownloadSimple, FileXls, UserPlus } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { commitImportAction, createStudentAction, previewImportAction, type FormState, type Login, type PreviewState } from "@/app/admin/actions";
import { useLocale } from "@/components/locale-provider";
import { SENIOR_GROUPS } from "@/lib/curriculum";
import type { ErrorCode } from "./copy";
import { BTN_PRIMARY, BTN_SECONDARY, Card, ErrorNote, Field, FOCUS, INPUT, LoginSlips, PageHeader, useStaffCopy } from "./ui";

const STANDARDS = [4, 5, 6, 7, 8, 9, 10, 11, 12];

/**
 * Class picker. Pass `value` + `onChange` to control it (keeps its value when a
 * form is reset after saving) or `defaultValue` for a fresh form.
 */
export function ClassSelect({
  name,
  value,
  defaultValue,
  onChange,
  id,
  ...rest
}: { name: string; value?: number; defaultValue?: number; onChange?: (n: number) => void; id: string; "aria-describedby"?: string }) {
  const c = useStaffCopy();
  const selection = value !== undefined ? { value } : { defaultValue: defaultValue ?? "" };
  return (
    <select id={id} name={name} required {...selection} onChange={(e) => onChange?.(Number(e.target.value))} className={INPUT} {...rest}>
      <option value="" disabled>
        —
      </option>
      {STANDARDS.map((n) => (
        <option key={n} value={n}>
          {c.classN(n)}
        </option>
      ))}
    </select>
  );
}

export function StreamSelect({
  id,
  name,
  value,
  onChange,
  ...rest
}: { id: string; name: string; value?: string | null; onChange?: (v: string) => void; "aria-describedby"?: string }) {
  const c = useStaffCopy();
  const { locale } = useLocale();
  const selection = onChange ? { value: value ?? "" } : { defaultValue: value ?? "" };
  return (
    <select id={id} name={name} {...selection} onChange={(e) => onChange?.(e.target.value)} className={INPUT} {...rest}>
      <option value="">{c.form.streamLater}</option>
      {SENIOR_GROUPS.map((g) => (
        <option key={g.id} value={g.id}>
          {g.name[locale]}
        </option>
      ))}
    </select>
  );
}

export function NewStudentPage() {
  const c = useStaffCopy();
  const [round, setRound] = useState(0);
  return <NewStudentForm key={round} onAnother={() => setRound((r) => r + 1)} c={c} />;
}

function NewStudentForm({ onAnother, c }: { onAnother: () => void; c: ReturnType<typeof useStaffCopy> }) {
  const [state, action, pending] = useActionState<FormState, FormData>(createStudentAction, {});
  const [standard, setStandard] = useState<number | null>(null);

  if (state.ok && state.login) {
    return (
      <>
        <LoginSlips logins={[state.login]} />
        <div className="flex flex-wrap gap-2 print:hidden">
          <button type="button" onClick={onAnother} className={BTN_PRIMARY}>
            <UserPlus size={18} aria-hidden />
            {c.form.another}
          </button>
          <Link href="/admin/students" className={BTN_SECONDARY}>
            {c.nav.students}
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <Link href="/admin/students" className={`inline-flex min-h-11 w-fit items-center gap-2 rounded-lg text-sm text-muted hover:text-text ${FOCUS}`}>
        <ArrowLeft size={16} aria-hidden />
        {c.nav.students}
      </Link>
      <PageHeader title={c.form.addTitle} lead={c.form.addLead} />
      <Card className="max-w-2xl">
        <form action={action} className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label={c.form.name} hint={c.form.nameHint}>
              {(p) => <input {...p} name="displayName" required maxLength={60} autoComplete="off" className={INPUT} />}
            </Field>
          </div>
          <Field label={c.form.class}>{(p) => <ClassSelect {...p} name="standard" onChange={setStandard} />}</Field>
          <Field label={c.form.medium}>
            {(p) => (
              <select {...p} name="medium" defaultValue="en" className={INPUT}>
                <option value="en">{c.medium.en}</option>
                <option value="ta">{c.medium.ta}</option>
              </select>
            )}
          </Field>
          {standard !== null && standard >= 11 && (
            <div className="sm:col-span-2">
              <Field label={c.form.stream}>{(p) => <StreamSelect {...p} name="groupId" />}</Field>
            </div>
          )}
          <Field label={c.form.section} optional>
            {(p) => <input {...p} name="section" maxLength={10} className={INPUT} />}
          </Field>
          <div className="hidden sm:block" />
          <Field label={c.form.username} hint={c.form.usernameHint} optional>
            {(p) => <input {...p} name="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} maxLength={32} className={`${INPUT} font-mono`} />}
          </Field>
          <Field label={c.form.password} hint={c.form.passwordHint} optional>
            {(p) => <input {...p} name="password" autoComplete="new-password" className={`${INPUT} font-mono`} />}
          </Field>
          <div className="flex flex-col gap-3 sm:col-span-2">
            <ErrorNote code={state.error} />
            <button type="submit" disabled={pending} className={`${BTN_PRIMARY} w-fit`}>
              <UserPlus size={18} aria-hidden />
              {pending ? c.form.creating : c.form.create}
            </button>
          </div>
        </form>
      </Card>
    </>
  );
}

const IMPORT_PROBLEM: Record<string, ErrorCode> = {
  name: "name",
  standard: "standard",
  medium: "medium",
  group: "group",
  username: "username",
  username_taken: "username_taken",
  password_short: "password_short",
  duplicate: "username_taken",
};

export function ImportStudentsPage() {
  const c = useStaffCopy();
  const [preview, previewAction, checking] = useActionState<PreviewState, FormData>(previewImportAction, {});
  const [creating, startCreating] = useTransition();
  const [done, setDone] = useState<{ logins: Login[]; failed: { row: number; error: ErrorCode }[] } | null>(null);
  const [progress, setProgress] = useState(0);

  const rows = preview.rows ?? [];
  const ready = rows.filter((r) => !r.problem && r.standard !== null);
  const bad = rows.filter((r) => r.problem);

  const create = () =>
    startCreating(async () => {
      const logins: Login[] = [];
      const failed: { row: number; error: ErrorCode }[] = [];
      for (let i = 0; i < ready.length; i += 50) {
        const res = await commitImportAction(ready.slice(i, i + 50));
        logins.push(...res.logins);
        failed.push(...res.failed);
        setProgress(Math.min(ready.length, i + 50));
      }
      setDone({ logins, failed });
    });

  if (done) {
    return (
      <>
        {done.failed.length > 0 && (
          <Card title={c.importer.previewTitle(done.logins.length, done.failed.length)} className="print:hidden">
            <ProblemTable items={done.failed.map((f) => ({ row: f.row, code: f.error }))} />
          </Card>
        )}
        {done.logins.length > 0 && <LoginSlips logins={done.logins} />}
        <Link href="/admin/students" className={`${BTN_SECONDARY} w-fit print:hidden`}>
          {c.nav.students}
        </Link>
      </>
    );
  }

  const fileError = preview.error === "bad_file" ? c.importer.badFile : preview.error === "no_name" ? c.importer.noName : preview.error === "too_many" ? c.importer.tooMany : null;

  return (
    <>
      <Link href="/admin/students" className={`inline-flex min-h-11 w-fit items-center gap-2 rounded-lg text-sm text-muted hover:text-text ${FOCUS}`}>
        <ArrowLeft size={16} aria-hidden />
        {c.nav.students}
      </Link>
      <PageHeader
        title={c.importer.title}
        lead={c.importer.lead}
        actions={
          <a href="/api/admin/students/template" className={BTN_SECONDARY}>
            <DownloadSimple size={18} aria-hidden />
            {c.importer.template}
          </a>
        }
      />
      <Card className="max-w-2xl">
        <form action={previewAction} className="flex flex-col gap-4">
          <Field label={c.importer.file}>
            {(p) => (
              <input
                {...p}
                type="file"
                name="file"
                required
                accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                className="text-sm file:mr-3 file:min-h-11 file:rounded-xl file:border-0 file:bg-surface-2 file:px-4 file:text-sm file:font-semibold file:text-text"
              />
            )}
          </Field>
          {fileError && (
            <p role="alert" className="rounded-xl border border-danger/40 bg-danger/[0.08] p-3 text-sm">
              {fileError}
            </p>
          )}
          {preview.error === "server" && <ErrorNote code="server" />}
          <button type="submit" disabled={checking} className={`${BTN_SECONDARY} w-fit`}>
            <FileXls size={18} aria-hidden />
            {checking ? c.importer.checking : c.importer.check}
          </button>
        </form>
      </Card>

      {preview.rows && (
        <Card title={c.importer.previewTitle(ready.length, bad.length)} lead={bad.length ? c.importer.previewLead : undefined}>
          {rows.length === 0 ? (
            <p className="text-sm text-muted">{c.importer.nothing}</p>
          ) : (
            <div className="flex flex-col gap-4">
              {bad.length > 0 && <ProblemTable items={bad.map((r) => ({ row: r.row, name: r.displayName, code: IMPORT_PROBLEM[r.problem!] ?? "server" }))} />}
              {ready.length > 0 && (
                <>
                  <ul className="flex max-h-64 flex-wrap gap-1.5 overflow-y-auto text-xs">
                    {ready.map((r) => (
                      <li key={r.row} className="rounded-full border border-line px-2.5 py-1">
                        {r.displayName} · {c.classN(r.standard!)}
                      </li>
                    ))}
                  </ul>
                  <div className="flex flex-wrap items-center gap-3">
                    <button type="button" onClick={create} disabled={creating} className={BTN_PRIMARY}>
                      <UserPlus size={18} aria-hidden />
                      {creating ? `${c.importer.creating} ${progress}/${ready.length}` : c.importer.confirm(ready.length)}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </Card>
      )}
    </>
  );
}

function ProblemTable({ items }: { items: { row: number; name?: string; code: ErrorCode }[] }) {
  const c = useStaffCopy();
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-xs text-muted">
          <tr>
            <th scope="col" className="py-2 pr-4 font-medium">{c.importer.row}</th>
            <th scope="col" className="py-2 pr-4 font-medium">{c.students.name}</th>
            <th scope="col" className="py-2 font-medium">{c.importer.problem}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it) => (
            <tr key={it.row} className="border-t border-line/60">
              <td className="py-2 pr-4 tabular-nums">{it.row}</td>
              <td className="py-2 pr-4">{it.name || "—"}</td>
              <td className="py-2 text-danger">{c.errors[it.code]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
