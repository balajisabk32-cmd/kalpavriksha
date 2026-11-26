"use client";

import {
  ArrowSquareOut,
  BookOpen,
  CheckCircle,
  ListBullets,
  MagnifyingGlassMinus,
  MagnifyingGlassPlus,
  Play,
  PlayCircle,
  VideoCamera,
} from "@phosphor-icons/react/ssr";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useLocale } from "@/components/locale-provider";
import type { Explanation } from "@/lib/explanation";
import { ExplanationView } from "./explanation-view";

/**
 * "Watch & read": the chapter's YouTube explanations beside its textbook pages.
 * Wide screens show both side by side; phones get Video / Textbook tabs.
 * Videos come in the student's medium first. How far they watch is saved.
 */

type Medium = "en" | "ta";
type LessonVideo = {
  id: number;
  kind: "lesson" | "qa";
  title: string;
  youtubeId: string | null;
  playlistId: string | null;
  medium: Medium;
  unitTitle?: string;
};
type LessonData = {
  medium: Medium;
  otherMedium: Medium | null;
  videos: LessonVideo[];
  subjectVideos: LessonVideo[];
  textbook: { id: number; title: string; startPage: number; endPage: number; pages: number | null; url: string } | null;
  watched: Record<number, { seconds: number; completed: boolean }>;
  explanation: { medium: Medium; status: "draft" | "published"; data: Explanation } | null;
};

const COPY = {
  en: {
    title: "Watch & read",
    lead: "Watch the explanation, then read the same pages in your textbook.",
    video: "Video",
    textbook: "Textbook",
    loading: "Loading the lesson…",
    failed: "Couldn't load this lesson's videos. Check the internet connection.",
    retry: "Try again",
    noVideo: "Videos for this chapter are being added.",
    noBook: "Textbook pages for this chapter are being added.",
    play: (t: string) => `Play: ${t}`,
    playlist: "Playlist",
    qa: "Q & A",
    watched: "Watched",
    videosIn: "Videos in this chapter",
    subjectWide: "More videos for this subject",
    medium: { en: "English medium", ta: "Tamil medium" },
    switchTo: (m: string) => `Show ${m} videos`,
    pages: (a: number, b: number) => (a === b ? `Page ${a}` : `Pages ${a}–${b}`),
    page: (n: number) => `Page ${n}`,
    zoomIn: "Zoom in",
    zoomOut: "Zoom out",
    openBook: "Open the full book",
    bookFailed: "The textbook couldn't be shown here.",
    readingPages: "Loading pages…",
  },
  ta: {
    title: "பார்த்துப் படி",
    lead: "விளக்கக் காணொளியைப் பாருங்கள்; பிறகு அதே பக்கங்களைப் பாடநூலில் படியுங்கள்.",
    video: "காணொளி",
    textbook: "பாடநூல்",
    loading: "பாடம் ஏற்றப்படுகிறது…",
    failed: "இந்தப் பாடத்தின் காணொளிகளை ஏற்ற முடியவில்லை. இணைய இணைப்பைச் சரிபாருங்கள்.",
    retry: "மீண்டும் முயல்",
    noVideo: "இந்தப் பகுதிக்கான காணொளிகள் சேர்க்கப்பட்டு வருகின்றன.",
    noBook: "இந்தப் பகுதிக்கான பாடநூல் பக்கங்கள் சேர்க்கப்பட்டு வருகின்றன.",
    play: (t: string) => `இயக்கு: ${t}`,
    playlist: "பிளேலிஸ்ட்",
    qa: "வினா-விடை",
    watched: "பார்த்தது",
    videosIn: "இந்தப் பகுதியின் காணொளிகள்",
    subjectWide: "இந்தப் பாடத்துக்கான மேலும் காணொளிகள்",
    medium: { en: "ஆங்கில வழி", ta: "தமிழ் வழி" },
    switchTo: (m: string) => `${m} காணொளிகளைக் காட்டு`,
    pages: (a: number, b: number) => (a === b ? `பக்கம் ${a}` : `பக்கங்கள் ${a}–${b}`),
    page: (n: number) => `பக்கம் ${n}`,
    zoomIn: "பெரிதாக்கு",
    zoomOut: "சிறிதாக்கு",
    openBook: "முழு நூலைத் திற",
    bookFailed: "பாடநூலை இங்கே காட்ட முடியவில்லை.",
    readingPages: "பக்கங்கள் ஏற்றப்படுகின்றன…",
  },
} as const;

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet focus-visible:ring-offset-2 focus-visible:ring-offset-bg";

export function LessonMedia({ chapterId }: { chapterId: string }) {
  const { locale } = useLocale();
  const c = COPY[locale];
  const [medium, setMedium] = useState<Medium | null>(null);
  const [state, setState] = useState<
    { status: "loading" } | { status: "error" } | { status: "ready"; data: LessonData }
  >({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [tab, setTab] = useState<"video" | "book">("video");
  const [current, setCurrent] = useState<LessonVideo | null>(null);
  const tabsId = useId();

  useEffect(() => {
    let alive = true;
    fetch(`/api/lesson/${encodeURIComponent(chapterId)}${medium ? `?medium=${medium}` : ""}`, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as LessonData;
        if (!alive) return;
        setState({ status: "ready", data });
        // Start at the first video not yet watched.
        const list = [...data.videos, ...data.subjectVideos];
        setCurrent(list.find((v) => !data.watched[v.id]?.completed) ?? list[0] ?? null);
      })
      .catch(() => alive && setState({ status: "error" }));
    return () => {
      alive = false;
    };
  }, [chapterId, medium, attempt]);

  const markWatched = useCallback((videoId: number, seconds: number, completed: boolean) => {
    setState((s) =>
      s.status === "ready"
        ? {
            ...s,
            data: {
              ...s.data,
              watched: {
                ...s.data.watched,
                [videoId]: {
                  seconds: Math.max(seconds, s.data.watched[videoId]?.seconds ?? 0),
                  completed: completed || Boolean(s.data.watched[videoId]?.completed),
                },
              },
            },
          }
        : s,
    );
  }, []);

  if (state.status === "loading") {
    return (
      <section aria-busy="true" className="rounded-2xl border border-line bg-surface p-4 sm:p-6">
        <span className="sr-only">{c.loading}</span>
        <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
          <div className="aspect-video animate-pulse rounded-2xl bg-line/60 motion-reduce:animate-none" />
          <div className="hidden h-full min-h-48 animate-pulse rounded-2xl bg-line/40 motion-reduce:animate-none lg:block" />
        </div>
      </section>
    );
  }
  if (state.status === "error") {
    return (
      <section
        role="alert"
        className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-4 text-sm sm:p-6"
      >
        <span>{c.failed}</span>
        <button
          type="button"
          onClick={() => {
            setState({ status: "loading" });
            setAttempt((n) => n + 1);
          }}
          className={`min-h-11 rounded-xl border border-line-strong px-4 font-semibold hover:bg-violet/[0.08] ${FOCUS}`}
        >
          {c.retry}
        </button>
      </section>
    );
  }

  const { data } = state;
  const hasVideo = data.videos.length + data.subjectVideos.length > 0;
  const explanation = data.explanation && (
    <ExplanationView
      data={data.explanation.data}
      lang={data.explanation.medium}
      draft={data.explanation.status === "draft"}
      fallbackFrom={data.explanation.medium !== data.medium ? data.medium : undefined}
    />
  );
  if (!hasVideo && !data.textbook) {
    if (explanation) return explanation;
    return (
      <section className="flex items-center gap-3 rounded-2xl border border-dashed border-line bg-surface p-4 text-sm text-muted sm:p-5">
        <VideoCamera size={22} aria-hidden className="shrink-0 text-violet" />
        <span>{c.noVideo}</span>
      </section>
    );
  }

  const videoPane = (
    <div className="flex min-w-0 flex-col gap-3">
      {current ? (
        <VideoPlayer key={current.id} video={current} onProgress={markWatched} />
      ) : (
        <Empty icon="video" text={c.noVideo} />
      )}
      {hasVideo && (
        <VideoList
          videos={data.videos}
          subjectVideos={data.subjectVideos}
          current={current}
          watched={data.watched}
          onPick={(v) => setCurrent(v)}
        />
      )}
    </div>
  );
  const bookPane = data.textbook ? <TextbookReader book={data.textbook} /> : <Empty icon="book" text={c.noBook} />;

  return (
    <>
      {explanation}
      <section
        aria-labelledby={`${tabsId}-title`}
        className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-4 sm:p-6"
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id={`${tabsId}-title`} className="font-display text-xl font-bold tracking-tight">
              {c.title}
            </h2>
            <p className="mt-1 text-sm text-muted">{c.lead}</p>
          </div>
          {data.otherMedium && (
            <button
              type="button"
              onClick={() => {
                setState({ status: "loading" });
                setMedium(data.otherMedium);
              }}
              className={`min-h-10 rounded-xl border border-line-strong px-3 text-sm font-medium hover:bg-violet/[0.08] ${FOCUS}`}
            >
              {c.switchTo(c.medium[data.otherMedium])}
            </button>
          )}
        </div>

        {/* Phones and tablets: Video / Textbook tabs. Wide screens: side by side. */}
        <div
          role="tablist"
          aria-label={c.title}
          className="grid grid-cols-2 gap-1 rounded-2xl border border-line bg-bg/40 p-1 lg:hidden"
        >
          {(
            [
              ["video", c.video, PlayCircle],
              ["book", c.textbook, BookOpen],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              role="tab"
              type="button"
              id={`${tabsId}-${id}`}
              aria-selected={tab === id}
              aria-controls={`${tabsId}-${id}-panel`}
              onClick={() => setTab(id)}
              className={`flex min-h-11 items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-colors ${FOCUS} ${
                tab === id ? "bg-purple-600 text-white" : "text-muted hover:text-text"
              }`}
            >
              <Icon size={18} aria-hidden />
              {label}
            </button>
          ))}
        </div>
        <div className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <div
            role="tabpanel"
            id={`${tabsId}-video-panel`}
            aria-labelledby={`${tabsId}-video`}
            className={`min-w-0 lg:block ${tab === "video" ? "" : "hidden"}`}
          >
            {videoPane}
          </div>
          <div
            role="tabpanel"
            id={`${tabsId}-book-panel`}
            aria-labelledby={`${tabsId}-book`}
            className={`min-w-0 lg:block ${tab === "book" ? "" : "hidden"}`}
          >
            {bookPane}
          </div>
        </div>
      </section>
    </>
  );
}

function Empty({ icon, text }: { icon: "video" | "book"; text: string }) {
  const Icon = icon === "video" ? VideoCamera : BookOpen;
  return (
    <div className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-line bg-bg/30 p-6 text-center text-sm text-muted">
      <Icon size={26} aria-hidden className="text-violet" />
      {text}
    </div>
  );
}

// --- Video list -------------------------------------------------------------

function VideoList({
  videos,
  subjectVideos,
  current,
  watched,
  onPick,
}: {
  videos: LessonVideo[];
  subjectVideos: LessonVideo[];
  current: LessonVideo | null;
  watched: LessonData["watched"];
  onPick: (v: LessonVideo) => void;
}) {
  const { locale } = useLocale();
  const c = COPY[locale];
  const row = (v: LessonVideo, n: number) => {
    const active = current?.id === v.id;
    const done = watched[v.id]?.completed;
    return (
      <li key={v.id}>
        <button
          type="button"
          onClick={() => onPick(v)}
          aria-current={active ? "true" : undefined}
          className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition-colors ${FOCUS} ${
            active ? "bg-violet/15 font-semibold" : "hover:bg-violet/[0.07]"
          }`}
        >
          <span className="grid size-7 shrink-0 place-items-center rounded-full bg-bg/60 text-xs tabular-nums">
            {done ? <CheckCircle size={18} weight="fill" className="text-success" aria-label={c.watched} /> : n}
          </span>
          <span className="min-w-0 flex-1">
            <span className="line-clamp-2">{v.title}</span>
            {v.unitTitle && v.unitTitle !== v.title && (
              <span className="block truncate text-xs font-normal text-muted">{v.unitTitle}</span>
            )}
          </span>
          {v.kind === "qa" && (
            <span className="shrink-0 rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px]">{c.qa}</span>
          )}
          {v.playlistId && (
            <span className="shrink-0 rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px]">{c.playlist}</span>
          )}
        </button>
      </li>
    );
  };
  return (
    <div className="flex flex-col gap-2">
      {videos.length > 0 && (
        <nav aria-label={c.videosIn}>
          <p className="mb-1 flex items-center gap-1.5 px-1 text-xs font-medium text-muted">
            <ListBullets size={14} aria-hidden /> {c.videosIn}
          </p>
          <ol className="flex max-h-72 flex-col gap-0.5 overflow-y-auto pr-1">{videos.map((v, i) => row(v, i + 1))}</ol>
        </nav>
      )}
      {subjectVideos.length > 0 && (
        <nav aria-label={c.subjectWide}>
          <p className="mb-1 px-1 text-xs font-medium text-muted">{c.subjectWide}</p>
          <ul className="flex flex-col gap-0.5">{subjectVideos.map((v, i) => row(v, videos.length + i + 1))}</ul>
        </nav>
      )}
    </div>
  );
}

// --- YouTube player -----------------------------------------------------------

type YTPlayer = {
  getCurrentTime(): number;
  getDuration(): number;
  destroy(): void;
};
type YTNamespace = {
  Player: new (
    el: HTMLElement,
    opts: {
      host?: string;
      videoId?: string;
      playerVars?: Record<string, string | number>;
      events?: { onReady?: () => void; onStateChange?: (e: { data: number; target: YTPlayer }) => void };
    },
  ) => YTPlayer;
  PlayerState: { PLAYING: number; PAUSED: number; ENDED: number };
};
declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let ytApi: Promise<YTNamespace> | null = null;
/** Loads YouTube's player script once, only when a student presses play. */
function loadYouTube(): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  ytApi ??= new Promise((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve(window.YT!);
    };
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    s.async = true;
    s.onerror = () => {
      ytApi = null;
      reject(new Error("youtube"));
    };
    document.head.appendChild(s);
  });
  return ytApi;
}

function report(videoId: number, seconds: number, duration: number) {
  void fetch("/api/lesson/watch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ videoId, seconds, duration }),
    keepalive: true,
  }).catch(() => {});
}

/**
 * Shows the video's picture first and loads YouTube only on "Play", so opening a
 * chapter stays fast on slow connections. Uses youtube-nocookie.com.
 */
function VideoPlayer({
  video,
  onProgress,
}: {
  video: LessonVideo;
  onProgress: (id: number, seconds: number, completed: boolean) => void;
}) {
  const { locale } = useLocale();
  const c = COPY[locale];
  const [started, setStarted] = useState(false);
  const [failed, setFailed] = useState(false);
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!started || !host.current) return;
    let player: YTPlayer | null = null;
    // The player's methods only exist once YouTube says it is ready.
    let ready = false;
    let timer: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;
    const send = () => {
      if (!player || !ready) return;
      const t = player.getCurrentTime();
      const d = player.getDuration();
      if (d > 0) {
        report(video.id, t, d);
        onProgress(video.id, t, t >= d * 0.9);
      }
    };
    const mount = document.createElement("div");
    host.current.appendChild(mount);
    loadYouTube()
      .then((YT) => {
        if (cancelled) return;
        player = new YT.Player(mount, {
          host: "https://www.youtube-nocookie.com",
          ...(video.youtubeId ? { videoId: video.youtubeId } : {}),
          playerVars: {
            autoplay: 1,
            rel: 0,
            playsinline: 1,
            modestbranding: 1,
            hl: locale,
            ...(video.playlistId ? { listType: "playlist", list: video.playlistId } : {}),
          },
          events: {
            onReady: () => {
              ready = true;
            },
            onStateChange: (e) => {
              if (e.data === YT.PlayerState.PLAYING) {
                timer ??= setInterval(send, 15_000);
              } else {
                if (timer) clearInterval(timer);
                timer = null;
                if (e.data === YT.PlayerState.PAUSED || e.data === YT.PlayerState.ENDED) send();
              }
            },
          },
        });
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      send();
      if (typeof player?.destroy === "function") player.destroy();
      mount.remove();
    };
  }, [started, video, locale, onProgress]);

  const watchUrl = video.youtubeId
    ? `https://www.youtube.com/watch?v=${video.youtubeId}`
    : `https://www.youtube.com/playlist?list=${video.playlistId}`;

  return (
    <div className="flex flex-col gap-2">
      <div className="relative aspect-video overflow-hidden rounded-2xl bg-black">
        {started && !failed ? (
          <div
            ref={host}
            className="absolute inset-0 [&>iframe]:h-full [&>iframe]:w-full [&_iframe]:h-full [&_iframe]:w-full"
          />
        ) : (
          <button
            type="button"
            onClick={() => (failed ? window.open(watchUrl, "_blank", "noopener") : setStarted(true))}
            aria-label={c.play(video.title)}
            className={`group absolute inset-0 grid place-items-center ${FOCUS}`}
          >
            {video.youtubeId && (
              // eslint-disable-next-line @next/next/no-img-element -- YouTube's own thumbnail; next/image would need the domain configured
              <img
                src={`https://i.ytimg.com/vi/${video.youtubeId}/hqdefault.jpg`}
                alt=""
                loading="lazy"
                decoding="async"
                className="absolute inset-0 h-full w-full object-cover opacity-80 transition-opacity group-hover:opacity-100"
              />
            )}
            <span className="relative grid size-16 place-items-center rounded-full bg-purple-600 text-white shadow-lg transition-transform group-hover:scale-105 motion-reduce:transition-none">
              <Play size={28} weight="fill" aria-hidden />
            </span>
          </button>
        )}
      </div>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="min-w-0 flex-1 text-sm font-semibold">{video.title}</p>
        <a
          href={watchUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-flex items-center gap-1 rounded text-xs text-muted hover:text-text ${FOCUS}`}
        >
          YouTube <ArrowSquareOut size={12} aria-hidden />
        </a>
      </div>
    </div>
  );
}

// --- Textbook reader -----------------------------------------------------------

type PdfDoc = { numPages: number; getPage(n: number): Promise<PdfPage> };
type PdfPage = {
  getViewport(o: { scale: number }): { width: number; height: number };
  render(o: {
    canvasContext: CanvasRenderingContext2D;
    viewport: { width: number; height: number };
    canvas: HTMLCanvasElement;
  }): { promise: Promise<void>; cancel(): void };
};

/**
 * Shows only the chapter's pages of the textbook, drawing each page when it
 * scrolls into view. pdf.js fetches just the bytes those pages need.
 */
function TextbookReader({ book }: { book: NonNullable<LessonData["textbook"]> }) {
  const { locale } = useLocale();
  const c = COPY[locale];
  const [doc, setDoc] = useState<PdfDoc | null>(null);
  const [failed, setFailed] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [width, setWidth] = useState(0);
  const [ratio, setRatio] = useState(1.414);
  const box = useRef<HTMLDivElement>(null);
  const last = Math.min(book.endPage, book.pages ?? book.endPage);
  const pages = Array.from({ length: Math.max(0, last - book.startPage + 1) }, (_, i) => book.startPage + i);

  const shown = width > 0;
  useEffect(() => {
    if (!shown) return;
    let alive = true;
    // The loading task owns the worker and the download; destroying it frees both.
    let task: { promise: Promise<unknown>; destroy(): Promise<void> } | null = null;
    (async () => {
      const pdfjs = await import("pdfjs-dist");
      if (!alive) return;
      pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
      task = pdfjs.getDocument({
        url: book.url,
        disableAutoFetch: true,
        disableStream: true,
        rangeChunkSize: 128 * 1024,
      });
      const loaded = (await task.promise) as PdfDoc;
      if (!alive) return;
      const first = await loaded.getPage(book.startPage);
      const vp = first.getViewport({ scale: 1 });
      setRatio(vp.height / vp.width);
      setDoc(loaded);
    })().catch(() => alive && setFailed(true));
    return () => {
      alive = false;
      void task?.destroy().catch(() => {});
    };
  }, [book.url, book.startPage, shown]);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry!.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const pageWidth = Math.max(200, Math.round((width - 8) * zoom));

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <p className="min-w-0">
          <span className="font-semibold">{book.title}</span>{" "}
          <span className="text-muted">· {c.pages(book.startPage, last)}</span>
        </p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label={c.zoomOut}
            onClick={() => setZoom((z) => Math.max(0.6, +(z - 0.2).toFixed(1)))}
            className={`grid size-10 place-items-center rounded-lg border border-line hover:bg-violet/[0.08] ${FOCUS}`}
          >
            <MagnifyingGlassMinus size={18} aria-hidden />
          </button>
          <button
            type="button"
            aria-label={c.zoomIn}
            onClick={() => setZoom((z) => Math.min(2.4, +(z + 0.2).toFixed(1)))}
            className={`grid size-10 place-items-center rounded-lg border border-line hover:bg-violet/[0.08] ${FOCUS}`}
          >
            <MagnifyingGlassPlus size={18} aria-hidden />
          </button>
          <a
            href={`${book.url}#page=${book.startPage}`}
            target="_blank"
            rel="noopener"
            className={`inline-flex min-h-10 items-center gap-1 rounded-lg border border-line px-2.5 text-xs hover:bg-violet/[0.08] ${FOCUS}`}
          >
            {c.openBook} <ArrowSquareOut size={12} aria-hidden />
          </a>
        </div>
      </div>
      <div
        ref={box}
        className="h-[70vh] min-h-80 overflow-auto rounded-2xl border border-line bg-white/90 p-1 lg:h-[min(78vh,56rem)]"
      >
        {failed ? (
          <div className="grid h-full place-items-center p-6 text-center text-sm text-slate-700">
            <div className="flex flex-col items-center gap-3">
              <p>{c.bookFailed}</p>
              <a
                href={`${book.url}#page=${book.startPage}`}
                target="_blank"
                rel="noopener"
                className={`inline-flex min-h-11 items-center gap-2 rounded-xl bg-purple-600 px-4 font-semibold text-white hover:bg-purple-700 ${FOCUS}`}
              >
                {c.openBook} <ArrowSquareOut size={14} aria-hidden />
              </a>
            </div>
          </div>
        ) : !doc || !width ? (
          <p role="status" className="p-6 text-center text-sm text-slate-600">
            {c.readingPages}
          </p>
        ) : (
          <div className="flex flex-col items-center gap-2">
            {pages.map((n) => (
              <PdfPageView key={n} doc={doc} page={n} width={pageWidth} ratio={ratio} label={c.page(n)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PdfPageView({
  doc,
  page,
  width,
  ratio,
  label,
}: {
  doc: PdfDoc;
  page: number;
  width: number;
  ratio: number;
  label: string;
}) {
  const holder = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = holder.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e?.isIntersecting && setVisible(true), { rootMargin: "800px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || !canvas.current) return;
    let task: { promise: Promise<void>; cancel(): void } | null = null;
    let alive = true;
    void doc.getPage(page).then((p) => {
      if (!alive || !canvas.current) return;
      const base = p.getViewport({ scale: 1 });
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const viewport = p.getViewport({ scale: (width / base.width) * dpr });
      const cv = canvas.current;
      cv.width = Math.floor(viewport.width);
      cv.height = Math.floor(viewport.height);
      const ctx = cv.getContext("2d");
      if (!ctx) return;
      task = p.render({ canvasContext: ctx, viewport, canvas: cv });
      task.promise.catch(() => {});
    });
    return () => {
      alive = false;
      task?.cancel();
    };
  }, [visible, doc, page, width]);

  return (
    <div ref={holder} className="relative bg-white shadow-sm" style={{ width, height: Math.round(width * ratio) }}>
      <canvas ref={canvas} role="img" aria-label={label} className="h-full w-full" />
      <span className="absolute bottom-1 right-2 rounded bg-black/50 px-1.5 text-[11px] text-white">{label}</span>
    </div>
  );
}
