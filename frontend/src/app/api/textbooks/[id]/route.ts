import { getSessionUser } from "@/server/auth/current-user";
import { getTextbook } from "@/server/content";
import { getDb } from "@/server/db";
import { fileStore } from "@/server/storage";

/**
 * A textbook PDF for signed-in users. Supports byte ranges, so a PDF viewer can
 * open page 40 without downloading the whole book first.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/textbooks/[id]">) {
  if (!(await getSessionUser())) return new Response("Sign in first", { status: 401 });
  const id = Number((await ctx.params).id);
  const book = Number.isInteger(id) && id > 0 ? await getTextbook(await getDb(), id) : null;
  if (!book) return new Response("Not found", { status: 404 });

  const headers: Record<string, string> = {
    "Content-Type": "application/pdf",
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=86400",
    "Content-Disposition": `inline; filename="textbook-${book.id}.pdf"`,
    "X-Content-Type-Options": "nosniff",
  };
  const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get("range") ?? "");
  const size = await fileStore().size(book.storageKey);
  if (size === null) return new Response("File missing", { status: 404 });

  if (range && (range[1] || range[2])) {
    const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
    const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    if (start > end || start >= size) {
      return new Response(null, { status: 416, headers: { ...headers, "Content-Range": `bytes */${size}` } });
    }
    const file = await fileStore().get(book.storageKey, { start, end });
    if (!file) return new Response("File missing", { status: 404 });
    return new Response(file.body, {
      status: 206,
      headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1) },
    });
  }
  const file = await fileStore().get(book.storageKey);
  if (!file) return new Response("File missing", { status: 404 });
  return new Response(file.body, { headers: { ...headers, "Content-Length": String(size) } });
}
