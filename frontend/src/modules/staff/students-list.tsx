"use client";

import { FileXls, MagnifyingGlass, UserPlus } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { useLocale } from "@/components/locale-provider";
import { getSeniorGroup } from "@/lib/curriculum";
import { BTN_PRIMARY, BTN_SECONDARY, FOCUS, formatWhen, INPUT, PageHeader, useStaffCopy } from "./ui";

export type StudentListItem = {
  id: string;
  username: string;
  displayName: string;
  status: "active" | "archived";
  standard: number;
  medium: "en" | "ta";
  groupId: string | null;
  section: string | null;
  lastLoginAt: string | null;
  locked: boolean;
};

export function useGroupName() {
  const { locale } = useLocale();
  return (id: string | null) => (id ? (getSeniorGroup(id)?.name[locale] ?? id) : null);
}

/** The student table. With `admin`, names link to the student's page and filters are shown. */
export function StudentsTable({ students, admin }: { students: readonly StudentListItem[]; admin: boolean }) {
  const c = useStaffCopy();
  const { locale } = useLocale();
  const groupName = useGroupName();
  if (students.length === 0) return <p className="rounded-2xl border border-line bg-surface/60 p-6 text-center text-sm text-muted">{c.noResults}</p>;

  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-surface/80">
      <table className="w-full min-w-[640px] text-left text-sm">
        <caption className="sr-only">{c.students.title}</caption>
        <thead className="border-b border-line text-xs text-muted">
          <tr>
            <th scope="col" className="px-4 py-3 font-medium">{c.students.name}</th>
            <th scope="col" className="px-4 py-3 font-medium">{c.students.username}</th>
            <th scope="col" className="px-4 py-3 font-medium">{c.students.class}</th>
            <th scope="col" className="px-4 py-3 font-medium">{c.form.medium}</th>
            <th scope="col" className="px-4 py-3 font-medium">{c.students.lastSignIn}</th>
          </tr>
        </thead>
        <tbody>
          {students.map((s) => (
            <tr key={s.id} className="border-b border-line/60 last:border-0">
              <th scope="row" className="px-4 py-2.5 font-medium">
                {admin ? (
                  <Link href={`/admin/students/${s.id}`} className={`rounded underline-offset-4 hover:underline ${FOCUS}`}>
                    {s.displayName}
                  </Link>
                ) : (
                  s.displayName
                )}
                <span className="ml-2 inline-flex flex-wrap gap-1 align-middle">
                  {s.status === "archived" && <Chip tone="muted">{c.status.archived}</Chip>}
                  {s.locked && <Chip tone="danger">{c.locked}</Chip>}
                </span>
              </th>
              <td className="px-4 py-2.5 font-mono text-[13px]">{s.username}</td>
              <td className="px-4 py-2.5">
                {c.classN(s.standard)}
                {s.section && <span className="text-muted"> · {s.section}</span>}
                {s.standard >= 11 && (
                  <span className="block text-xs">
                    {s.groupId ? <span className="text-muted">{groupName(s.groupId)}</span> : <Chip tone="amber">{c.students.groupNeeded}</Chip>}
                  </span>
                )}
              </td>
              <td className="px-4 py-2.5">{c.mediumShort[s.medium]}</td>
              <td className="px-4 py-2.5 text-muted">{formatWhen(s.lastLoginAt, locale, c.never)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Chip({ tone, children }: { tone: "muted" | "danger" | "amber"; children: React.ReactNode }) {
  const cls = {
    muted: "border-line-strong text-muted",
    danger: "border-danger/50 text-danger",
    amber: "border-amber/50 text-amber",
  }[tone];
  return <span className={`inline-block rounded-full border px-2 py-0.5 text-[11px] font-medium ${cls}`}>{children}</span>;
}

export function StudentsPage({
  students,
  filter,
}: {
  students: readonly StudentListItem[];
  filter: { standard: number | null; status: "active" | "archived"; q: string };
}) {
  const c = useStaffCopy();
  return (
    <>
      <PageHeader
        title={c.students.title}
        lead={c.count(students.length)}
        actions={
          <>
            <Link href="/admin/students/new" className={BTN_PRIMARY}>
              <UserPlus size={18} aria-hidden />
              {c.students.add}
            </Link>
            <Link href="/admin/students/import" className={BTN_SECONDARY}>
              <FileXls size={18} aria-hidden />
              {c.students.import}
            </Link>
          </>
        }
      />

      <form method="get" className="flex flex-wrap items-end gap-3 rounded-2xl border border-line bg-surface/60 p-4" role="search">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">{c.students.class}</span>
          <select name="class" defaultValue={filter.standard ?? ""} className={`${INPUT} w-40`}>
            <option value="">{c.allClasses}</option>
            {[4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
              <option key={n} value={n}>
                {c.classN(n)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">{c.students.statusLabel}</span>
          <select name="status" defaultValue={filter.status} className={`${INPUT} w-36`}>
            <option value="active">{c.students.showActive}</option>
            <option value="archived">{c.students.showArchived}</option>
          </select>
        </label>
        <label className="flex min-w-48 flex-1 flex-col gap-1 text-sm">
          <span className="font-medium">{c.search}</span>
          <input type="search" name="q" defaultValue={filter.q} className={INPUT} />
        </label>
        <button type="submit" className={BTN_SECONDARY}>
          <MagnifyingGlass size={18} aria-hidden />
          {c.apply}
        </button>
      </form>

      <StudentsTable students={students} admin />
    </>
  );
}
