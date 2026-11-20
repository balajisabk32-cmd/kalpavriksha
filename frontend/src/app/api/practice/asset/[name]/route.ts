import { getSessionUser } from "@/server/auth/current-user";
import { fileStore } from "@/server/storage";

const TYPES: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", svg: "image/svg+xml" };

/**
 * An image used in a solution. Signed-in users only. Images are named by their
 * content, so they never change and browsers may keep them for a long time.
 */
export async function GET(_request: Request, ctx: RouteContext<"/api/practice/asset/[name]">) {
  if (!(await getSessionUser())) return new Response(null, { status: 401 });
  const { name } = await ctx.params;
  const m = /^([a-f0-9]{20})\.(png|jpe?g|gif|webp|svg)$/.exec(name);
  if (!m) return new Response(null, { status: 404 });
  const key = `practice/assets/${name}`;
  const store = await fileStore();
  if (store.signedUrl) {
    return new Response(null, { status: 302, headers: { Location: await store.signedUrl(key, 3600, TYPES[m[2]!]), "Cache-Control": "private, max-age=3000" } });
  }
  const file = await store.get(key);
  if (!file) return new Response(null, { status: 404 });
  return new Response(file.body, {
    headers: {
      "Content-Type": TYPES[m[2]!]!,
      "Content-Length": String(file.size),
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      ...(m[2] === "svg" ? { "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'" } : {}),
    },
  });
}
