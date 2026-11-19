"use client";

import { Archive, ArrowCounterClockwise, ArrowLeft, Key } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { useActionState, useState } from "react";
import {
  changeClassAction,
  resetPasswordAction,
  setArchivedAction,
  updateDetailsAction,
  type FormState,
} from "@/app/admin/actions";
import { useLocale } from "@/components/locale-provider";
import { ClassSelect, StreamSelect } from "./student-forms";
import { useGroupName, type StudentListItem } from "./students-list";
import {
  BTN_DANGER,
  BTN_PRIMARY,
  BTN_SECONDARY,
  Card,
  ErrorNote,
  Field,
  FOCUS,
  formatWhen,
  INPUT,
  LoginSlips,
  SavedNote,
  useStaffCopy,
} from "./ui";

export type HistoryItem = {
  fromStandard: number | null;
  toStandard: number | null;
  fromGroup: string | null;
  toGroup: string | null;
  reason: "created" | "auto" | "admin" | "graduated" | "restored";
  academicYear: number;
  at: string;
  byName: string | null;
};

export function StudentDetailPage({ student, history }: { student: StudentListItem; history: readonly HistoryItem[] }) {
  const c = useStaffCopy();
  const { locale } = useLocale();
  const groupName = useGroupName();
  const [details, detailsAction, savingDetails] = useActionState<FormState, FormData>(updateDetailsAction, {});
  const [move, moveAction, moving] = useActionState<FormState, FormData>(changeClassAction, {});
  const [pw, pwAction, resetting] = useActionState<FormState, FormData>(resetPasswordAction, {});
  const [arch, archAction, archiving] = useActionState<FormState, FormData>(setArchivedAction, {});
  const [confirming, setConfirming] = useState(false);
  const archived = student.status === "archived";

  const classLabel = (n: number | null, g: string | null) =>
    n ? `${c.classN(n)}${g ? ` · ${groupName(g)}` : ""}` : "—";

  return (
    <>
      <Link
        href="/admin/students"
        className={`inline-flex min-h-11 w-fit items-center gap-2 rounded-lg text-sm text-muted hover:text-text print:hidden ${FOCUS}`}
      >
        <ArrowLeft size={16} aria-hidden />
        {c.nav.students}
      </Link>

      <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{student.displayName}</h1>
          <p className="mt-1 text-sm text-muted">
            <span className="font-mono">{student.username}</span> · {classLabel(student.standard, student.groupId)} ·{" "}
            {c.medium[student.medium]} ·{" "}
            <span className={archived ? "text-amber" : "text-success"}>{c.status[student.status]}</span>
          </p>
        </div>
        <p className="text-sm text-muted">
          {c.students.lastSignIn}: {formatWhen(student.lastLoginAt, locale, c.never)}
        </p>
      </div>

      {pw.password && (
        <LoginSlips
          logins={[
            {
              username: student.username,
              password: pw.password,
              displayName: student.displayName,
              standard: student.standard,
            },
          ]}
        />
      )}

      <div className="grid gap-4 lg:grid-cols-2 print:hidden">
        <Card title={c.detail.profile}>
          {/* Keyed by the saved values: after saving, the form is rebuilt from what the server stored. */}
          <form
            key={`${student.displayName}|${student.medium}|${student.section}`}
            action={detailsAction}
            className="flex flex-col gap-4"
          >
            <input type="hidden" name="id" value={student.id} />
            <Field label={c.form.name}>
              {(p) => (
                <input
                  {...p}
                  name="displayName"
                  defaultValue={student.displayName}
                  required
                  maxLength={60}
                  className={INPUT}
                />
              )}
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={c.form.medium}>
                {(p) => (
                  <select {...p} name="medium" defaultValue={student.medium} className={INPUT}>
                    <option value="en">{c.medium.en}</option>
                    <option value="ta">{c.medium.ta}</option>
                  </select>
                )}
              </Field>
              <Field label={c.form.section} optional>
                {(p) => (
                  <input {...p} name="section" defaultValue={student.section ?? ""} maxLength={10} className={INPUT} />
                )}
              </Field>
            </div>
            <ErrorNote code={details.error} />
            <div className="flex items-center gap-3">
              <button type="submit" disabled={savingDetails} className={BTN_PRIMARY}>
                {savingDetails ? c.saving : c.save}
              </button>
              <SavedNote show={Boolean(details.ok) && !savingDetails} />
            </div>
          </form>
        </Card>

        <Card title={c.detail.changeClass} lead={c.detail.changeClassLead}>
          <ChangeClassForm
            key={`${student.standard}|${student.groupId}`}
            student={student}
            action={moveAction}
            state={move}
            pending={moving}
          />
        </Card>

        <Card title={c.detail.password} lead={c.detail.passwordLead}>
          <form action={pwAction} className="flex flex-col gap-3">
            <input type="hidden" name="id" value={student.id} />
            <ErrorNote code={pw.error} />
            <button type="submit" disabled={resetting || archived} className={`${BTN_SECONDARY} w-fit`}>
              <Key size={18} aria-hidden />
              {resetting ? c.saving : c.detail.reset}
            </button>
          </form>
        </Card>

        <Card
          title={archived ? c.detail.restore : c.detail.archive}
          lead={archived ? c.detail.restoreLead : c.detail.archiveLead}
        >
          <form action={archAction} className="flex flex-col gap-3" onSubmit={() => setConfirming(false)}>
            <input type="hidden" name="id" value={student.id} />
            <input type="hidden" name="archived" value={archived ? "false" : "true"} />
            <ErrorNote code={arch.error} />
            {archived ? (
              <button type="submit" disabled={archiving} className={`${BTN_SECONDARY} w-fit`}>
                <ArrowCounterClockwise size={18} aria-hidden />
                {c.detail.restore}
              </button>
            ) : confirming ? (
              <div className="flex flex-wrap items-center gap-2" role="group" aria-label={c.detail.confirmArchive}>
                <span className="text-sm font-medium">{c.detail.confirmArchive}</span>
                <button type="submit" disabled={archiving} className={BTN_DANGER}>
                  <Archive size={18} aria-hidden />
                  {c.detail.archive}
                </button>
                <button type="button" onClick={() => setConfirming(false)} className={BTN_SECONDARY}>
                  {c.cancel}
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => setConfirming(true)} className={`${BTN_DANGER} w-fit`}>
                <Archive size={18} aria-hidden />
                {c.detail.archive}
              </button>
            )}
          </form>
        </Card>
      </div>

      <Card title={c.detail.history} className="print:hidden">
        <ol className="flex flex-col">
          {history.map((h, i) => (
            <li
              key={i}
              className="flex flex-wrap items-baseline justify-between gap-2 border-t border-line/60 py-2.5 text-sm first:border-0"
            >
              <span>
                <span className="font-medium">{c.detail.reason[h.reason]}</span>
                <span className="text-muted">
                  {" "}
                  ·{" "}
                  {h.reason === "created" || h.reason === "restored"
                    ? classLabel(h.toStandard, h.toGroup)
                    : `${classLabel(h.fromStandard, h.fromGroup)} → ${classLabel(h.toStandard, h.toGroup)}`}
                </span>
              </span>
              <span className="text-xs text-muted">
                {formatWhen(h.at, locale, c.never)}
                {h.byName && ` · ${c.detail.by(h.byName)}`}
              </span>
            </li>
          ))}
        </ol>
      </Card>
    </>
  );
}

function ChangeClassForm({
  student,
  action,
  state,
  pending,
}: {
  student: StudentListItem;
  action: (form: FormData) => void;
  state: FormState;
  pending: boolean;
}) {
  const c = useStaffCopy();
  const [standard, setStandard] = useState(student.standard);
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={student.id} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={c.form.class}>
          {(p) => <ClassSelect {...p} name="standard" defaultValue={student.standard} onChange={setStandard} />}
        </Field>
        {standard >= 11 && (
          <Field label={c.form.stream}>{(p) => <StreamSelect {...p} name="groupId" value={student.groupId} />}</Field>
        )}
      </div>
      <ErrorNote code={state.error} />
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className={BTN_PRIMARY}>
          {pending ? c.saving : c.detail.move}
        </button>
        <SavedNote show={Boolean(state.ok) && !pending} />
      </div>
    </form>
  );
}
