"use client";

import { FileXls, UserPlus, WarningCircle } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { useLocale } from "@/components/locale-provider";
import { BTN_PRIMARY, BTN_SECONDARY, Card, FOCUS, formatWhen, PageHeader, useStaffCopy } from "./ui";

export type OverviewData = {
  yearLabel: string;
  counts: Record<number, number>;
  teachers: number;
  needGroup: number;
  promotion: { month: number; day: number };
  lastRun: { ranAt: string; promoted: number; graduated: number } | null;
};

const STANDARDS = [4, 5, 6, 7, 8, 9, 10, 11, 12];

export function AdminOverview({ data }: { data: OverviewData }) {
  const c = useStaffCopy();
  const { locale } = useLocale();
  const total = STANDARDS.reduce((n, s) => n + (data.counts[s] ?? 0), 0);
  const max = Math.max(1, ...STANDARDS.map((s) => data.counts[s] ?? 0));
  const promotionDate = `${data.promotion.day} ${c.settings.months[data.promotion.month - 1]}`;

  return (
    <>
      <PageHeader
        title={c.overview.title}
        lead={c.overview.year(data.yearLabel)}
        actions={
          <>
            <Link href="/admin/students/new" className={BTN_PRIMARY}>
              <UserPlus size={18} aria-hidden />
              {c.overview.addStudent}
            </Link>
            <Link href="/admin/students/import" className={BTN_SECONDARY}>
              <FileXls size={18} aria-hidden />
              {c.overview.importStudents}
            </Link>
          </>
        }
      />

      <dl className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-line bg-surface/80 p-5">
          <dt className="text-sm text-muted">{c.overview.activeStudents}</dt>
          <dd className="mt-1 font-display text-3xl font-bold tabular-nums">{total}</dd>
        </div>
        <div className="rounded-2xl border border-line bg-surface/80 p-5">
          <dt className="text-sm text-muted">{c.overview.teachers}</dt>
          <dd className="mt-1 font-display text-3xl font-bold tabular-nums">{data.teachers}</dd>
        </div>
        <div className="rounded-2xl border border-line bg-surface/80 p-5">
          <dt className="text-sm text-muted">{c.overview.lastPromotion}</dt>
          <dd className="mt-1 text-sm">
            {data.lastRun ? (
              <>
                <span className="block font-medium">{formatWhen(data.lastRun.ranAt, locale, c.never)}</span>
                <span className="text-muted">{c.settings.ran(data.lastRun.promoted, data.lastRun.graduated)}</span>
              </>
            ) : (
              <span className="text-muted">{c.overview.noPromotion}</span>
            )}
            <span className="mt-1 block text-muted">{c.overview.nextPromotion(promotionDate)}</span>
          </dd>
        </div>
      </dl>

      {data.needGroup > 0 && (
        <Link
          href="/admin/students?class=11"
          className={`flex gap-3 rounded-2xl border border-amber/40 bg-amber/[0.08] p-4 text-sm transition-colors hover:bg-amber/[0.14] ${FOCUS}`}
        >
          <WarningCircle size={20} weight="fill" className="mt-0.5 shrink-0 text-amber" aria-hidden />
          <span>
            <span className="font-semibold">
              {c.overview.needGroup}: {data.needGroup}
            </span>
            <span className="block text-muted">{c.overview.needGroupHint}</span>
          </span>
        </Link>
      )}

      <Card title={c.overview.perClass}>
        <ul className="flex flex-col gap-1">
          {STANDARDS.map((s) => {
            const n = data.counts[s] ?? 0;
            return (
              <li key={s}>
                <Link
                  href={`/admin/students?class=${s}`}
                  className={`grid min-h-11 grid-cols-[5.5rem_1fr_3rem] items-center gap-3 rounded-lg px-2 transition-colors hover:bg-violet/[0.06] ${FOCUS}`}
                >
                  <span className="text-sm">{c.classN(s)}</span>
                  <span aria-hidden className="h-2.5 rounded-full bg-line">
                    <span className="block h-full rounded-full bg-violet" style={{ width: `${(n / max) * 100}%` }} />
                  </span>
                  <span className="text-right text-sm font-semibold tabular-nums">{n}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </Card>
    </>
  );
}
