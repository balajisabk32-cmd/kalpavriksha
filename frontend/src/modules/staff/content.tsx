"use client";

import {
  ArrowLeft,
  ArrowSquareOut,
  ChalkboardTeacher,
  FilePdf,
  FileXls,
  Plus,
  Trash,
  UploadSimple,
  WarningCircle,
} from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useMemo, useState, useTransition } from "react";
import {
  addVideoAction,
  commitVideoImportAction,
  deleteTextbookAction,
  deleteVideoAction,
  previewVideoImportAction,
  setChapterPagesAction,
  setUnitChapterAction,
  type ContentState,
  type VideoPreview,
} from "@/app/admin/content/actions";
import { useLocale } from "@/components/locale-provider";
import type { ErrorCode } from "./copy";
import {
  BTN_DANGER,
  BTN_PRIMARY,
  BTN_SECONDARY,
  Card,
  ErrorNote,
  Field,
  FOCUS,
  INPUT,
  PageHeader,
  SavedNote,
  useStaffCopy,
} from "./ui";

type Medium = "en" | "ta";
type Match = "title" | "number" | "order" | "manual" | "subject";
type Localized = { en: string; ta: string };

const STANDARDS = [4, 5, 6, 7, 8, 9, 10, 11, 12];

function MatchBadge({ match }: { match: Match | null }) {
  const c = useStaffCopy().content;
  const label = match ? c.match[match] : c.notLinked;
  const tone =
    match === "order" || match === null
      ? "border-amber/50 text-amber"
      : match === "manual"
        ? "border-violet/50 text-violet"
        : "border-success/50 text-success";
  return (
    <span
      title={match ? c.matchHint[match] : undefined}
      className={`inline-block whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium ${tone}`}
    >
      {label}
    </span>
  );
}

// --- Overview ---------------------------------------------------------------

export type CoverageItem = {
  subjectId: string;
  name: Localized;
  chapters: number;
  withVideo: Record<Medium, number>;
  subjectVideos: number;
  toCheck: number;
  textbooks: number;
};

export function ContentOverviewPage({ standard, rows }: { standard: number; rows: readonly CoverageItem[] }) {
  const c = useStaffCopy();
  const { locale } = useLocale();
  const cell = (n: number, of: number) => (
    <span className={n === 0 ? "text-muted" : n >= of ? "text-success" : ""}>{c.content.of(n, of)}</span>
  );
  return (
    <>
      <PageHeader
        title={c.content.title}
        lead={c.content.lead}
        actions={
          <Link href="/admin/content/import" className={BTN_PRIMARY}>
            <FileXls size={18} aria-hidden />
            {c.content.import}
          </Link>
        }
      />
      <nav aria-label={c.content.classLabel} className="flex flex-wrap gap-1.5">
        {STANDARDS.map((n) => (
          <Link
            key={n}
            href={`/admin/content?class=${n}`}
            aria-current={n === standard ? "page" : undefined}
            className={`inline-flex min-h-10 items-center rounded-xl border px-3 text-sm transition-colors ${FOCUS} ${
              n === standard ? "border-violet bg-violet/15 font-semibold" : "border-line text-muted hover:text-text"
            }`}
          >
            {c.classN(n)}
          </Link>
        ))}
      </nav>
      <div className="overflow-x-auto rounded-2xl border border-line bg-surface/80">
        <table className="w-full min-w-[760px] text-left text-sm">
          <caption className="sr-only">{`${c.content.title} · ${c.classN(standard)}`}</caption>
          <thead className="border-b border-line text-xs text-muted">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">
                {c.content.subject}
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                {c.content.withVideoEn}
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                {c.content.withVideoTa}
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                {c.content.subjectVideos}
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                {c.content.toCheck}
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                {c.content.textbooks}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.subjectId} className="border-b border-line/60 last:border-0">
                <th scope="row" className="px-4 py-2.5 font-medium">
                  <Link
                    href={`/admin/content/${r.subjectId}`}
                    className={`rounded underline-offset-4 hover:underline ${FOCUS}`}
                  >
                    {r.name[locale]}
                  </Link>
                  <span className="block text-xs font-normal text-muted">{`${r.chapters} ${c.content.chapters}`}</span>
                </th>
                <td className="px-4 py-2.5 tabular-nums">{cell(r.withVideo.en, r.chapters)}</td>
                <td className="px-4 py-2.5 tabular-nums">{cell(r.withVideo.ta, r.chapters)}</td>
                <td className="px-4 py-2.5 tabular-nums">{r.subjectVideos || <span className="text-muted">0</span>}</td>
                <td className="px-4 py-2.5 tabular-nums">
                  {r.toCheck ? (
                    <span className="font-semibold text-amber">{r.toCheck}</span>
                  ) : (
                    <span className="text-muted">0</span>
                  )}
                </td>
                <td className="px-4 py-2.5 tabular-nums">{r.textbooks || <span className="text-muted">0</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// --- Import -----------------------------------------------------------------

export function VideoImportPage({ subjectNames }: { subjectNames: Record<string, Localized> }) {
  const c = useStaffCopy();
  const { locale } = useLocale();
  const router = useRouter();
  const [preview, previewAction, checking] = useActionState<VideoPreview, FormData>(previewVideoImportAction, {});
  const [saving, startSaving] = useTransition();
  const [result, setResult] = useState<{ units: number; videos: number } | { error: ErrorCode } | null>(null);

  const units = useMemo(() => preview.units ?? [], [preview.units]);
  const issues = preview.issues ?? [];
  const videoCount = units.reduce((n, u) => n + u.videos.length, 0);
  const bySubject = useMemo(() => {
    const m = new Map<string, typeof units>();
    for (const u of units) m.set(`${u.subjectId}|${u.medium}`, [...(m.get(`${u.subjectId}|${u.medium}`) ?? []), u]);
    return [...m.entries()];
  }, [units]);

  const save = () =>
    startSaving(async () => {
      const res = await commitVideoImportAction(units, preview.fileName ?? "");
      setResult(res);
      if (!("error" in res)) router.refresh();
    });

  return (
    <>
      <Link
        href="/admin/content"
        className={`inline-flex min-h-11 w-fit items-center gap-2 rounded-lg text-sm text-muted hover:text-text ${FOCUS}`}
      >
        <ArrowLeft size={16} aria-hidden />
        {c.content.title}
      </Link>
      <PageHeader title={c.content.importTitle} lead={c.content.importLead} />
      <Card className="max-w-2xl">
        <form action={previewAction} className="grid gap-4 sm:grid-cols-2" onSubmit={() => setResult(null)}>
          <div className="sm:col-span-2">
            <Field label={c.content.file}>
              {(p) => (
                <input
                  {...p}
                  type="file"
                  name="file"
                  required
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="text-sm file:mr-3 file:min-h-11 file:rounded-xl file:border-0 file:bg-surface-2 file:px-4 file:text-sm file:font-semibold file:text-text"
                />
              )}
            </Field>
          </div>
          <Field label={c.content.classLabel}>
            {(p) => (
              <select {...p} name="standard" defaultValue="" className={INPUT}>
                <option value="">{c.content.classFromFile}</option>
                {STANDARDS.map((n) => (
                  <option key={n} value={n}>
                    {c.classN(n)}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label={c.content.mediumLabel}>
            {(p) => (
              <select {...p} name="medium" defaultValue="en" className={INPUT}>
                <option value="en">{c.medium.en}</option>
                <option value="ta">{c.medium.ta}</option>
              </select>
            )}
          </Field>
          <div className="flex flex-col gap-3 sm:col-span-2">
            {preview.error && <ErrorNote code={preview.error === "file" ? "file" : "server"} />}
            <button type="submit" disabled={checking} className={`${BTN_SECONDARY} w-fit`}>
              <FileXls size={18} aria-hidden />
              {checking ? c.content.checking : c.content.check}
            </button>
          </div>
        </form>
      </Card>

      {preview.units && (
        <Card title={c.content.summary(units.length, videoCount, issues.length)}>
          <div className="flex flex-col gap-5">
            {result && !("error" in result) ? (
              <p role="status" className="flex flex-wrap items-center gap-3 text-sm font-medium text-success">
                {c.content.saved(result.units, result.videos)}
                <Link href="/admin/content" className={BTN_SECONDARY}>
                  {c.content.title}
                </Link>
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {result && "error" in result && <ErrorNote code={result.error} />}
                <button
                  type="button"
                  onClick={save}
                  disabled={saving || videoCount === 0}
                  className={`${BTN_PRIMARY} w-fit`}
                >
                  {saving ? c.content.saving : c.content.save(videoCount)}
                </button>
              </div>
            )}

            {issues.length > 0 && (
              <section aria-labelledby="issues-title" className="rounded-xl border border-amber/40 bg-amber/[0.06] p-4">
                <h3 id="issues-title" className="flex items-center gap-2 text-sm font-semibold">
                  <WarningCircle size={18} weight="fill" className="text-amber" aria-hidden />
                  {c.content.issuesTitle}
                </h3>
                <ul className="mt-2 flex flex-col gap-1.5 text-sm">
                  {issues.map((i, n) => (
                    <li key={n} className="break-words">
                      <span className="text-muted">
                        {i.sheet} · {c.importer.row} {i.row}:
                      </span>{" "}
                      {c.content.issue[i.reason]} <span className="font-mono text-xs text-muted">{i.text}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {bySubject.map(([key, group]) => {
              const first = group[0]!;
              const name = subjectNames[first.subjectId]?.[locale] ?? first.subjectLabel;
              return (
                <details key={key} className="rounded-xl border border-line">
                  <summary
                    className={`flex min-h-11 cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-sm ${FOCUS}`}
                  >
                    <span className="font-semibold">
                      {c.classN(first.standard)} · {name}
                    </span>
                    <span className="text-muted">{c.medium[first.medium]}</span>
                    <span className="text-muted">
                      {c.content.unitsIn(group.length)} ·{" "}
                      {c.content.videosN(group.reduce((n, u) => n + u.videos.length, 0))}
                    </span>
                    {group.some((u) => u.match === "order" || u.match === null) && <MatchBadge match="order" />}
                  </summary>
                  <ul className="flex flex-col border-t border-line px-4 py-2">
                    {group.map((u, i) => (
                      <li
                        key={i}
                        className="flex flex-wrap items-center justify-between gap-2 border-b border-line/50 py-2 text-sm last:border-0"
                      >
                        <span>
                          <span className="text-xs text-muted">{c.content.termUnit(u.term, u.unitNo)} · </span>
                          {u.title}
                          <span className="ml-2 text-xs text-muted">{c.content.videosN(u.videos.length)}</span>
                        </span>
                        <span className="flex items-center gap-2 text-xs">
                          <span className="font-mono text-muted">{u.chapterId ?? "—"}</span>
                          <MatchBadge match={u.match} />
                        </span>
                      </li>
                    ))}
                  </ul>
                </details>
              );
            })}
          </div>
        </Card>
      )}
    </>
  );
}

// --- One subject ------------------------------------------------------------

export type ChapterItem = { id: string; chapterNumber: number; title: Localized };
export type VideoItem = {
  id: number;
  kind: "lesson" | "qa";
  title: string;
  youtubeId: string | null;
  playlistId: string | null;
  note: string | null;
};
export type UnitItem = {
  id: number;
  medium: Medium;
  term: number | null;
  unitNo: number | null;
  title: string;
  chapterId: string | null;
  match: Match | null;
  videos: VideoItem[];
};
export type BookItem = {
  id: number;
  medium: Medium;
  term: number | null;
  title: string;
  pages: number | null;
  sizeBytes: number;
};
export type PageItem = { chapterId: string; textbookId: number; startPage: number; endPage: number };

const watchUrl = (v: { youtubeId: string | null; playlistId: string | null }) =>
  v.youtubeId
    ? `https://www.youtube.com/watch?v=${v.youtubeId}`
    : `https://www.youtube.com/playlist?list=${v.playlistId}`;

export function SubjectContentPage({
  standard,
  subjectId,
  name,
  chapters,
  units,
  books,
  pages,
  explain = {},
}: {
  explain?: Record<string, Partial<Record<Medium, "draft" | "published">>>;
  standard: number;
  subjectId: string;
  name: Localized;
  chapters: readonly ChapterItem[];
  units: readonly UnitItem[];
  books: readonly BookItem[];
  pages: readonly PageItem[];
}) {
  const c = useStaffCopy();
  const { locale } = useLocale();
  const chapterTitle = (id: string | null) => {
    const ch = chapters.find((x) => x.id === id);
    return ch ? `${ch.chapterNumber}. ${ch.title[locale] || ch.title.en}` : c.content.notLinked;
  };
  const sheetUnits = units.filter((u) => u.unitNo === null || u.unitNo < 900);
  const subjectWide = units.filter((u) => u.unitNo === null && u.videos.length);

  return (
    <>
      <Link
        href={`/admin/content?class=${standard}`}
        className={`inline-flex min-h-11 w-fit items-center gap-2 rounded-lg text-sm text-muted hover:text-text ${FOCUS}`}
      >
        <ArrowLeft size={16} aria-hidden />
        {c.content.title} · {c.classN(standard)}
      </Link>
      <PageHeader title={`${name[locale]} · ${c.classN(standard)}`} />

      <Card title={c.content.chapterList}>
        {subjectWide.length > 0 && (
          <div className="mb-4 rounded-xl border border-line bg-bg/40 p-3 text-sm">
            <p className="font-medium">{c.content.subjectVideos}</p>
            <ul className="mt-1 flex flex-col gap-1">
              {subjectWide.flatMap((u) =>
                u.videos.map((v) => (
                  <li key={v.id} className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted">{c.mediumShort[u.medium]}</span>
                    <VideoLink v={v} />
                  </li>
                )),
              )}
            </ul>
          </div>
        )}
        <ol className="flex flex-col gap-2">
          {chapters.map((ch) => (
            <ChapterRow
              key={ch.id}
              chapter={ch}
              units={units.filter((u) => u.chapterId === ch.id)}
              explain={explain[ch.id] ?? {}}
            />
          ))}
        </ol>
      </Card>

      {sheetUnits.length > 0 && (
        <Card title={c.content.unitsTitle} lead={c.content.unitsLead}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="text-xs text-muted">
                <tr>
                  <th scope="col" className="py-2 pr-3 font-medium">
                    {c.form.medium}
                  </th>
                  <th scope="col" className="py-2 pr-3 font-medium">
                    {c.content.unitCol}
                  </th>
                  <th scope="col" className="py-2 pr-3 font-medium">
                    {c.content.videoTitle}
                  </th>
                  <th scope="col" className="py-2 font-medium">
                    {c.content.chapterList}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sheetUnits.map((u) => (
                  <UnitRow key={u.id} unit={u} chapters={chapters} chapterTitle={chapterTitle} />
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <TextbooksCard subjectId={subjectId} chapters={chapters} books={books} pages={pages} />
    </>
  );
}

function VideoLink({ v }: { v: VideoItem }) {
  const c = useStaffCopy().content;
  return (
    <a
      href={watchUrl(v)}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1 rounded underline-offset-4 hover:underline ${FOCUS}`}
      aria-label={`${v.title} — ${c.watch}`}
    >
      {v.kind === "qa" && <span className="rounded bg-surface-2 px-1.5 text-[11px]">{c.qa}</span>}
      {v.playlistId && <span className="rounded bg-surface-2 px-1.5 text-[11px]">{c.playlist}</span>}
      <span>{v.title}</span>
      <ArrowSquareOut size={13} aria-hidden className="text-muted" />
    </a>
  );
}

const EXPLAIN_LABEL = {
  en: { title: "Explanation", none: "none", draft: "draft", published: "live", open: "Write / review" },
  ta: { title: "விளக்கம்", none: "இல்லை", draft: "வரைவு", published: "வெளியிடப்பட்டது", open: "எழுது / சரிபார்" },
} as const;

function ChapterRow({
  chapter,
  units,
  explain,
}: {
  chapter: ChapterItem;
  units: readonly UnitItem[];
  explain: Partial<Record<Medium, "draft" | "published">>;
}) {
  const c = useStaffCopy();
  const { locale } = useLocale();
  const count = (m: Medium) => units.filter((u) => u.medium === m).reduce((n, u) => n + u.videos.length, 0);
  // React clears this form after each successful add.
  const [added, addAction, adding] = useActionState<ContentState, FormData>(addVideoAction, {});
  return (
    <li className="rounded-xl border border-line">
      <details>
        <summary
          className={`flex min-h-11 cursor-pointer flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm ${FOCUS}`}
        >
          <span className="font-medium">
            {chapter.chapterNumber}. {chapter.title[locale] || chapter.title.en}
          </span>
          <span className="flex gap-3 text-xs tabular-nums">
            <span className={count("en") ? "" : "text-muted"}>
              {c.mediumShort.en}: {count("en")}
            </span>
            <span className={count("ta") ? "" : "text-muted"}>
              {c.mediumShort.ta}: {count("ta")}
            </span>
          </span>
        </summary>
        <div className="flex flex-col gap-3 border-t border-line px-4 py-3">
          <ExplainLink chapterId={chapter.id} explain={explain} />
          {units.length === 0 ? (
            <p className="text-sm text-muted">{c.content.noVideo}</p>
          ) : (
            units.map((u) => (
              <div key={u.id} className="text-sm">
                <p className="text-xs text-muted">
                  {c.mediumShort[u.medium]} · {c.content.termUnit(u.term, u.unitNo)} · {u.title}
                </p>
                <ul className="mt-1 flex flex-col gap-1">
                  {u.videos.map((v) => (
                    <li key={v.id} className="flex flex-wrap items-center justify-between gap-2">
                      <VideoLink v={v} />
                      <DeleteVideo id={v.id} />
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
          <form
            action={addAction}
            className="grid gap-2 rounded-xl bg-bg/40 p-3 sm:grid-cols-[2fr_1.4fr_auto_auto_auto]"
          >
            <input type="hidden" name="chapterId" value={chapter.id} />
            <label className="sr-only" htmlFor={`url-${chapter.id}`}>
              {c.content.videoUrl}
            </label>
            <input
              id={`url-${chapter.id}`}
              name="url"
              required
              placeholder={c.content.videoUrl}
              inputMode="url"
              className={INPUT}
            />
            <label className="sr-only" htmlFor={`title-${chapter.id}`}>
              {c.content.videoTitle}
            </label>
            <input id={`title-${chapter.id}`} name="title" placeholder={c.content.videoTitle} className={INPUT} />
            <select name="medium" aria-label={c.form.medium} defaultValue="en" className={INPUT}>
              <option value="en">{c.mediumShort.en}</option>
              <option value="ta">{c.mediumShort.ta}</option>
            </select>
            <select name="kind" aria-label={c.content.addVideo} defaultValue="lesson" className={INPUT}>
              <option value="lesson">{c.content.kindLesson}</option>
              <option value="qa">{c.content.kindQa}</option>
            </select>
            <button type="submit" disabled={adding} className={BTN_SECONDARY}>
              <Plus size={16} aria-hidden />
              {c.content.add}
            </button>
          </form>
          <ErrorNote code={added.error} />
        </div>
      </details>
    </li>
  );
}

function ExplainLink({
  chapterId,
  explain,
}: {
  chapterId: string;
  explain: Partial<Record<Medium, "draft" | "published">>;
}) {
  const c = useStaffCopy();
  const { locale } = useLocale();
  const l = EXPLAIN_LABEL[locale];
  const subjectId = chapterId.replace(/-ch\d+$/, "");
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-violet/[0.06] px-3 py-2 text-sm">
      <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="inline-flex items-center gap-1.5 font-medium">
          <ChalkboardTeacher size={16} aria-hidden className="text-violet" />
          {l.title}
        </span>
        {(["en", "ta"] as const).map((m) => (
          <span
            key={m}
            className={`text-xs ${explain[m] === "published" ? "text-success" : explain[m] ? "" : "text-muted"}`}
          >
            {c.mediumShort[m]}: {l[explain[m] ?? "none"]}
          </span>
        ))}
      </span>
      <Link href={`/admin/content/${subjectId}/explain/${chapterId}`} className={`${BTN_SECONDARY} min-h-10`}>
        {l.open}
      </Link>
    </div>
  );
}

function DeleteVideo({ id }: { id: number }) {
  const c = useStaffCopy();
  const [, action, pending] = useActionState<ContentState, FormData>(deleteVideoAction, {});
  return (
    <form action={action}>
      <input type="hidden" name="videoId" value={id} />
      <button
        type="submit"
        disabled={pending}
        aria-label={c.content.remove}
        className={`grid size-9 place-items-center rounded-lg text-muted transition-colors hover:bg-danger/10 hover:text-danger ${FOCUS}`}
      >
        <Trash size={16} aria-hidden />
      </button>
    </form>
  );
}

function UnitRow({
  unit,
  chapters,
  chapterTitle,
}: {
  unit: UnitItem;
  chapters: readonly ChapterItem[];
  chapterTitle: (id: string | null) => string;
}) {
  const c = useStaffCopy();
  const [state, action, pending] = useActionState<ContentState, FormData>(setUnitChapterAction, {});
  return (
    <tr className="border-t border-line/60 align-top">
      <td className="py-2 pr-3">{c.mediumShort[unit.medium]}</td>
      <td className="whitespace-nowrap py-2 pr-3 text-muted">{c.content.termUnit(unit.term, unit.unitNo)}</td>
      <td className="py-2 pr-3">
        {unit.title}
        <span className="block text-xs text-muted">{c.content.videosN(unit.videos.length)}</span>
      </td>
      <td className="py-2">
        {unit.unitNo === null ? (
          <MatchBadge match="subject" />
        ) : (
          <form key={`${unit.chapterId}`} action={action} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="unitId" value={unit.id} />
            <select
              name="chapterId"
              defaultValue={unit.chapterId ?? ""}
              aria-label={`${unit.title}: ${c.content.chapterList}`}
              className={`${INPUT} min-h-9 max-w-72 py-1`}
            >
              <option value="">{c.content.notLinked}</option>
              {chapters.map((ch) => (
                <option key={ch.id} value={ch.id}>
                  {chapterTitle(ch.id)}
                </option>
              ))}
            </select>
            <button type="submit" disabled={pending} className={`${BTN_SECONDARY} min-h-9 px-3 text-xs`}>
              {c.save}
            </button>
            <MatchBadge match={unit.match} />
            <SavedNote show={Boolean(state.ok) && !pending} />
            <ErrorNote code={state.error} />
          </form>
        )}
      </td>
    </tr>
  );
}

const UPLOAD_ERRORS = ["file", "too_big", "not_pdf", "forbidden", "not_found", "server"] as const;
type UploadError = (typeof UPLOAD_ERRORS)[number];

function TextbooksCard({
  subjectId,
  chapters,
  books,
  pages,
}: {
  subjectId: string;
  chapters: readonly ChapterItem[];
  books: readonly BookItem[];
  pages: readonly PageItem[];
}) {
  const c = useStaffCopy();
  const { locale } = useLocale();
  const router = useRouter();
  const [progress, setProgress] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<UploadError | null>(null);
  const [round, setRound] = useState(0);

  // XMLHttpRequest for upload progress (fetch can't report it).
  const upload = (form: HTMLFormElement) => {
    const data = new FormData(form);
    data.set("subjectId", subjectId);
    setUploadError(null);
    setProgress(0);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/admin/textbooks");
    xhr.upload.onprogress = (e) => e.lengthComputable && setProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      setProgress(null);
      if (xhr.status >= 200 && xhr.status < 300) {
        setRound((r) => r + 1);
        router.refresh();
        return;
      }
      // Vercel refuses request bodies over 4.5 MB before our code runs.
      let code: UploadError = xhr.status === 413 ? "too_big" : "server";
      try {
        const err = JSON.parse(xhr.responseText).error;
        if ((UPLOAD_ERRORS as readonly string[]).includes(err)) code = err;
      } catch {
        /* keep "server" */
      }
      setUploadError(code);
    };
    xhr.onerror = () => {
      setProgress(null);
      setUploadError("server");
    };
    xhr.send(data);
  };

  return (
    <Card title={c.content.booksTitle} lead={c.content.booksLead}>
      <div className="flex flex-col gap-5">
        <form
          key={round}
          onSubmit={(e) => {
            e.preventDefault();
            upload(e.currentTarget);
          }}
          className="grid gap-3 rounded-xl bg-bg/40 p-4 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_1fr]"
        >
          <Field label="PDF">
            {(p) => (
              <input
                {...p}
                type="file"
                name="file"
                accept="application/pdf,.pdf"
                required
                className="text-sm file:mr-3 file:min-h-11 file:rounded-xl file:border-0 file:bg-surface-2 file:px-4 file:text-sm file:font-semibold file:text-text"
              />
            )}
          </Field>
          <Field label={c.content.bookTitle} optional>
            {(p) => <input {...p} name="title" maxLength={120} className={INPUT} />}
          </Field>
          <Field label={c.form.medium}>
            {(p) => (
              <select {...p} name="medium" defaultValue="en" className={INPUT}>
                <option value="en">{c.medium.en}</option>
                <option value="ta">{c.medium.ta}</option>
              </select>
            )}
          </Field>
          <Field label={c.content.term}>
            {(p) => (
              <select {...p} name="term" defaultValue="" className={INPUT}>
                <option value="">{c.content.noTerm}</option>
                {[1, 2, 3].map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label={c.content.pages} hint={c.content.pagesHint} optional>
            {(p) => <input {...p} name="pages" type="number" min={1} max={2000} className={INPUT} />}
          </Field>
          <div className="flex flex-col gap-2 sm:col-span-2 lg:col-span-5">
            {uploadError && (
              <p role="alert" className="rounded-xl border border-danger/40 bg-danger/[0.08] p-3 text-sm">
                {c.content.uploadErrors[uploadError]}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <button type="submit" disabled={progress !== null} className={BTN_PRIMARY}>
                <UploadSimple size={18} aria-hidden />
                {progress !== null ? c.content.uploading(progress) : c.content.upload}
              </button>
              {progress !== null && (
                <progress
                  value={progress}
                  max={100}
                  className="h-2 w-40 accent-violet"
                  aria-label={c.content.uploading(progress)}
                />
              )}
            </div>
            <p className="text-xs text-muted">{c.content.localNote}</p>
          </div>
        </form>

        {books.length === 0 ? (
          <p className="text-sm text-muted">{c.content.noBooks}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {books.map((b) => (
              <BookRow key={b.id} book={b} />
            ))}
          </ul>
        )}

        {books.length > 0 && (
          <section aria-labelledby="pages-title">
            <h3 id="pages-title" className="font-display text-base font-semibold">
              {c.content.pagesTitle}
            </h3>
            <ul className="mt-2 flex flex-col">
              {chapters.map((ch) => (
                <PagesRow
                  key={ch.id}
                  title={`${ch.chapterNumber}. ${ch.title[locale] || ch.title.en}`}
                  chapterId={ch.id}
                  books={books}
                  current={pages.find((p) => p.chapterId === ch.id) ?? null}
                />
              ))}
            </ul>
          </section>
        )}
      </div>
    </Card>
  );
}

function BookRow({ book }: { book: BookItem }) {
  const c = useStaffCopy();
  const [confirming, setConfirming] = useState(false);
  const [state, action, pending] = useActionState<ContentState, FormData>(deleteTextbookAction, {});
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line px-4 py-2 text-sm">
      <span className="flex items-center gap-2">
        <FilePdf size={20} className="text-danger" aria-hidden />
        <span>
          <span className="font-medium">{book.title}</span>
          <span className="block text-xs text-muted">
            {c.mediumShort[book.medium]}
            {book.term ? ` · ${c.content.term} ${book.term}` : ""} ·{" "}
            {book.pages ? `${book.pages} ${c.content.pages}` : "—"} · {(book.sizeBytes / 1024 / 1024).toFixed(1)} MB
          </span>
        </span>
      </span>
      <span className="flex flex-wrap items-center gap-2">
        <a
          href={`/api/textbooks/${book.id}`}
          target="_blank"
          rel="noopener"
          className={`${BTN_SECONDARY} min-h-9 px-3 text-xs`}
        >
          {c.content.view}
        </a>
        <form action={action} className="flex items-center gap-2" onSubmit={() => setConfirming(false)}>
          <input type="hidden" name="textbookId" value={book.id} />
          {confirming ? (
            <>
              <span className="text-xs">{c.content.confirmDelete}</span>
              <button type="submit" disabled={pending} className={`${BTN_DANGER} min-h-9 px-3 text-xs`}>
                {c.content.deleteBook}
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className={`${BTN_SECONDARY} min-h-9 px-3 text-xs`}
              >
                {c.cancel}
              </button>
            </>
          ) : (
            <button type="button" onClick={() => setConfirming(true)} className={`${BTN_DANGER} min-h-9 px-3 text-xs`}>
              <Trash size={14} aria-hidden />
              {c.content.deleteBook}
            </button>
          )}
        </form>
        <ErrorNote code={state.error} />
      </span>
    </li>
  );
}

function PagesRow({
  title,
  chapterId,
  books,
  current,
}: {
  title: string;
  chapterId: string;
  books: readonly BookItem[];
  current: PageItem | null;
}) {
  const c = useStaffCopy();
  const [state, action, pending] = useActionState<ContentState, FormData>(setChapterPagesAction, {});
  return (
    <li className="border-t border-line/60 py-2 first:border-0">
      <form
        key={`${current?.textbookId}-${current?.startPage}-${current?.endPage}`}
        action={action}
        className="grid items-end gap-2 text-sm sm:grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_6rem_6rem_auto]"
      >
        <span className="self-center">{title}</span>
        <input type="hidden" name="chapterId" value={chapterId} />
        <input type="hidden" name="previousTextbookId" value={current?.textbookId ?? ""} />
        <select
          name="textbookId"
          aria-label={`${title}: ${c.content.book}`}
          defaultValue={current?.textbookId ?? books[0]?.id ?? ""}
          className={`${INPUT} min-h-9 py-1`}
        >
          {books.map((b) => (
            <option key={b.id} value={b.id}>
              {b.title} ({c.mediumShort[b.medium]})
            </option>
          ))}
        </select>
        <input
          name="startPage"
          type="number"
          min={1}
          aria-label={`${title}: ${c.content.from}`}
          placeholder={c.content.from}
          defaultValue={current?.startPage ?? ""}
          className={`${INPUT} min-h-9 py-1`}
        />
        <input
          name="endPage"
          type="number"
          min={1}
          aria-label={`${title}: ${c.content.to}`}
          placeholder={c.content.to}
          defaultValue={current?.endPage ?? ""}
          className={`${INPUT} min-h-9 py-1`}
        />
        <span className="flex items-center gap-2">
          <button type="submit" disabled={pending} className={`${BTN_SECONDARY} min-h-9 px-3 text-xs`}>
            {c.save}
          </button>
          <SavedNote show={Boolean(state.ok) && !pending} />
        </span>
      </form>
      <ErrorNote code={state.error} />
    </li>
  );
}
