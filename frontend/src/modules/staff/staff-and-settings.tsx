"use client";

import { ArrowsClockwise, BookOpen, Key, UserPlus, Users } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { useActionState, useState } from "react";
import { createStaffAction, resetPasswordAction, runPromotionAction, setArchivedAction, setPromotionDateAction, type FormState } from "@/app/admin/actions";
import { useLocale } from "@/components/locale-provider";
import { StudentsTable, type StudentListItem } from "./students-list";
import { BTN_DANGER, BTN_PRIMARY, BTN_SECONDARY, Card, ErrorNote, Field, FOCUS, formatWhen, INPUT, LoginSlips, PageHeader, SavedNote, useStaffCopy } from "./ui";

export type StaffItem = {
  id: string;
  role: "admin" | "teacher" | "student";
  username: string;
  displayName: string;
  status: "active" | "archived";
  lastLoginAt: string | null;
  locked: boolean;
};

export function StaffPage({ staff, meId }: { staff: readonly StaffItem[]; meId: string }) {
  const c = useStaffCopy();
  const [round, setRound] = useState(0);
  return (
    <>
      <PageHeader title={c.staff.title} lead={c.staff.lead} />
      <div className="overflow-x-auto rounded-2xl border border-line bg-surface/80">
        <table className="w-full min-w-[640px] text-left text-sm">
          <caption className="sr-only">{c.staff.title}</caption>
          <thead className="border-b border-line text-xs text-muted">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">{c.staff.name}</th>
              <th scope="col" className="px-4 py-3 font-medium">{c.staff.username}</th>
              <th scope="col" className="px-4 py-3 font-medium">{c.staff.role}</th>
              <th scope="col" className="px-4 py-3 font-medium">{c.staff.lastSignIn}</th>
              <th scope="col" className="px-4 py-3 font-medium">
                <span className="sr-only">{c.students.statusLabel}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {staff.map((s) => (
              <StaffRow key={s.id} s={s} isMe={s.id === meId} />
            ))}
          </tbody>
        </table>
      </div>
      <Card title={c.staff.add} className="max-w-2xl">
        <AddStaffForm key={round} onAnother={() => setRound((r) => r + 1)} />
      </Card>
    </>
  );
}

function StaffRow({ s, isMe }: { s: StaffItem; isMe: boolean }) {
  const c = useStaffCopy();
  const { locale } = useLocale();
  const [pw, pwAction, resetting] = useActionState<FormState, FormData>(resetPasswordAction, {});
  const [arch, archAction, archiving] = useActionState<FormState, FormData>(setArchivedAction, {});
  const archived = s.status === "archived";
  return (
    <>
      <tr className="border-b border-line/60 last:border-0">
        <th scope="row" className="px-4 py-2.5 font-medium">
          {s.displayName}
          {isMe && <span className="ml-1.5 text-xs font-normal text-muted">({c.staff.you})</span>}
          {archived && <span className="ml-2 rounded-full border border-line-strong px-2 py-0.5 text-[11px] text-muted">{c.status.archived}</span>}
        </th>
        <td className="px-4 py-2.5 font-mono text-[13px]">{s.username}</td>
        <td className="px-4 py-2.5">{c.role[s.role]}</td>
        <td className="px-4 py-2.5 text-muted">{formatWhen(s.lastLoginAt, locale, c.never)}</td>
        <td className="px-4 py-2.5">
          {!isMe && (
            <div className="flex flex-wrap justify-end gap-2">
              {!archived && (
                <form action={pwAction}>
                  <input type="hidden" name="id" value={s.id} />
                  <button type="submit" disabled={resetting} className={`${BTN_SECONDARY} min-h-9 px-3 text-xs`}>
                    <Key size={14} aria-hidden />
                    {c.staff.resetPassword}
                  </button>
                </form>
              )}
              <form action={archAction}>
                <input type="hidden" name="id" value={s.id} />
                <input type="hidden" name="archived" value={archived ? "false" : "true"} />
                <button type="submit" disabled={archiving} className={`${archived ? BTN_SECONDARY : BTN_DANGER} min-h-9 px-3 text-xs`}>
                  {archived ? c.staff.restore : c.staff.archive}
                </button>
              </form>
            </div>
          )}
        </td>
      </tr>
      {(pw.password || pw.error || arch.error) && (
        <tr>
          <td colSpan={5} className="px-4 pb-4">
            {pw.password && <LoginSlips logins={[{ username: s.username, password: pw.password, displayName: s.displayName }]} />}
            <ErrorNote code={pw.error ?? arch.error} />
          </td>
        </tr>
      )}
    </>
  );
}

function AddStaffForm({ onAnother }: { onAnother: () => void }) {
  const c = useStaffCopy();
  const [state, action, pending] = useActionState<FormState, FormData>(createStaffAction, {});
  if (state.ok && state.login) {
    return (
      <div className="flex flex-col gap-4">
        <LoginSlips logins={[state.login]} />
        <button type="button" onClick={onAnother} className={`${BTN_SECONDARY} w-fit print:hidden`}>
          <UserPlus size={18} aria-hidden />
          {c.form.another}
        </button>
      </div>
    );
  }
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <Field label={c.staff.name}>{(p) => <input {...p} name="displayName" required maxLength={60} className={INPUT} />}</Field>
      <Field label={c.staff.role}>
        {(p) => (
          <select {...p} name="role" defaultValue="teacher" className={INPUT}>
            <option value="teacher">{c.role.teacher}</option>
            <option value="admin">{c.role.admin}</option>
          </select>
        )}
      </Field>
      <Field label={c.staff.username} hint={c.form.usernameHint.split(".")[0] + "."}>
        {(p) => <input {...p} name="username" required autoCapitalize="none" autoCorrect="off" spellCheck={false} maxLength={32} className={`${INPUT} font-mono`} />}
      </Field>
      <Field label={c.form.password} hint={c.form.staffPasswordHint} optional>
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
  );
}

export function SettingsPage({ promotion, yearLabel }: { promotion: { month: number; day: number }; yearLabel: string }) {
  const c = useStaffCopy();
  const [date, dateAction, savingDate] = useActionState<FormState, FormData>(setPromotionDateAction, {});
  const [run, runAction, running] = useActionState<FormState>(runPromotionAction, {});
  return (
    <>
      <PageHeader title={c.settings.title} lead={c.overview.year(yearLabel)} />
      <Card title={c.settings.promotionTitle} lead={c.settings.promotionLead} className="max-w-2xl">
        <form key={`${promotion.month}-${promotion.day}`} action={dateAction} className="flex flex-wrap items-end gap-3">
          <Field label={c.settings.day}>
            {(p) => <input {...p} name="day" type="number" min={1} max={31} required defaultValue={promotion.day} className={`${INPUT} w-24`} />}
          </Field>
          <Field label={c.settings.month}>
            {(p) => (
              <select {...p} name="month" defaultValue={promotion.month} className={`${INPUT} w-44`}>
                {c.settings.months.map((m, i) => (
                  <option key={i} value={i + 1}>
                    {m}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <button type="submit" disabled={savingDate} className={BTN_PRIMARY}>
            {savingDate ? c.saving : c.save}
          </button>
          <SavedNote show={Boolean(date.ok) && !savingDate} />
        </form>
        <ErrorNote code={date.error} />
        <hr className="my-5 border-line" />
        <form action={runAction} className="flex flex-col gap-3">
          <p className="text-sm text-muted">{c.settings.runLead}</p>
          <button type="submit" disabled={running} className={`${BTN_SECONDARY} w-fit`}>
            <ArrowsClockwise size={18} aria-hidden />
            {running ? c.saving : c.settings.runNow}
          </button>
          {run.promotion && (
            <p role="status" className="text-sm">
              {run.promotion.promoted + run.promotion.graduated === 0
                ? c.settings.nothingToDo
                : c.settings.ran(run.promotion.promoted, run.promotion.graduated)}
            </p>
          )}
          <ErrorNote code={run.error} />
        </form>
      </Card>
    </>
  );
}

const STANDARDS = [4, 5, 6, 7, 8, 9, 10, 11, 12];

export function TeacherClassesPage({ counts }: { counts: Record<number, number> }) {
  const c = useStaffCopy();
  return (
    <>
      <PageHeader title={c.teacher.title} lead={c.teacher.lead} />
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {STANDARDS.map((n) => (
          <li key={n} className="flex flex-col gap-4 rounded-2xl border border-line bg-surface/80 p-5">
            <div className="flex items-baseline justify-between">
              <h2 className="font-display text-xl font-semibold">{c.classN(n)}</h2>
              <span className="text-sm text-muted">{c.count(counts[n] ?? 0)}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href={`/m/learn?class=${n}`} className={BTN_PRIMARY}>
                <BookOpen size={18} aria-hidden />
                {c.teacher.openLessons}
              </Link>
              <Link href={`/teacher/class/${n}`} className={BTN_SECONDARY}>
                <Users size={18} aria-hidden />
                {c.teacher.seeStudents}
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

export function TeacherClassStudentsPage({ standard, students }: { standard: number; students: readonly StudentListItem[] }) {
  const c = useStaffCopy();
  return (
    <>
      <Link href="/teacher" className={`inline-flex min-h-11 w-fit items-center gap-2 rounded-lg text-sm text-muted hover:text-text ${FOCUS}`}>
        ← {c.nav.classes}
      </Link>
      <PageHeader
        title={c.teacher.studentsIn(standard)}
        lead={c.count(students.length)}
        actions={
          <Link href={`/m/learn?class=${standard}`} className={BTN_PRIMARY}>
            <BookOpen size={18} aria-hidden />
            {c.teacher.openLessons}
          </Link>
        }
      />
      <StudentsTable students={students} admin={false} />
    </>
  );
}
