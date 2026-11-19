/** Reads YouTube links in the forms people paste them. */

export type YouTubeRef = { readonly kind: "video"; readonly id: string } | { readonly kind: "playlist"; readonly id: string };

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const PLAYLIST_ID = /^[A-Za-z0-9_-]{10,64}$/;

/**
 * A video or playlist from a YouTube URL; null for anything else (including
 * channel pages and search results, which can't be embedded).
 *
 * youtu.be/ID · youtube.com/watch?v=ID · /shorts/ID · /embed/ID · /live/ID ·
 * youtube.com/playlist?list=ID · watch?v=ID&list=… (the video wins)
 */
export function parseYouTubeUrl(raw: string): YouTubeRef | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www|m|music)\./, "");
  if (host === "youtu.be") {
    const id = url.pathname.slice(1).split("/")[0] ?? "";
    return VIDEO_ID.test(id) ? { kind: "video", id } : null;
  }
  if (host !== "youtube.com" && host !== "youtube-nocookie.com") return null;
  const v = url.searchParams.get("v");
  if (v && VIDEO_ID.test(v)) return { kind: "video", id: v };
  const m = /^\/(shorts|embed|live|v)\/([A-Za-z0-9_-]{11})/.exec(url.pathname);
  if (m) return { kind: "video", id: m[2]! };
  const list = url.searchParams.get("list");
  if (list && PLAYLIST_ID.test(list) && (url.pathname === "/playlist" || url.pathname.startsWith("/watch") || url.pathname.startsWith("/embed"))) {
    return { kind: "playlist", id: list };
  }
  return null;
}

/** True for YouTube links that can't be played in the app (channels, searches, handles). */
export function isUnplayableYouTube(raw: string): boolean {
  return /youtu\.?be/i.test(raw) && parseYouTubeUrl(raw) === null;
}

export function watchUrl(ref: { youtubeId?: string | null; playlistId?: string | null }): string {
  if (ref.youtubeId) return `https://www.youtube.com/watch?v=${ref.youtubeId}`;
  return `https://www.youtube.com/playlist?list=${ref.playlistId}`;
}
