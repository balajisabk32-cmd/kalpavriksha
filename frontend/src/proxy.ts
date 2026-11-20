import { NextResponse, type NextRequest } from "next/server";

/**
 * Quick check before signed-in pages: no session cookie → the sign-in page.
 * This only looks for the cookie. Each page and server action still checks the
 * session and role against the database (src/server/auth/current-user.ts).
 */
export function proxy(request: NextRequest) {
  if (request.cookies.has("kv_session")) return NextResponse.next();
  const url = request.nextUrl.clone();
  const next = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  url.pathname = "/sign-in";
  url.search = `?next=${encodeURIComponent(next)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/m/:path*", "/practice/:path*", "/practice", "/admin/:path*", "/teacher/:path*", "/me"],
};
