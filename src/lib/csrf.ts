import { NextRequest, NextResponse } from "next/server";

/**
 * Our actual CSRF security model (documented here, not just in comments,
 * since a reviewer needs to find this in one place):
 *
 * 1. Session cookie is httpOnly + SameSite=Lax + Secure (in production).
 *    Lax already excludes the cookie from cross-site POST/PUT/PATCH/DELETE
 *    requests (a <form> on evil.com posting to us arrives with no session
 *    cookie, so requireUser() rejects it as unauthenticated).
 * 2. We send no Access-Control-Allow-Origin header, so a cross-origin
 *    `fetch(..., { credentials: "include" })` from another site can't
 *    read our responses even if the browser sent the cookie.
 * 3. This middleware is the third, independent layer: for any
 *    state-changing method, the Origin (falling back to Referer) must
 *    resolve to the same host Next.js thinks it's serving. This holds
 *    even against theoretical SameSite gaps (old browsers, some in-app
 *    webviews) and doesn't rely on cookie behavior at all.
 *
 * This deliberately does NOT block requests with no Origin/Referer header
 * at all (e.g. some native mobile HTTP clients, curl, server-to-server
 * calls using a bearer token instead of the cookie) — those aren't
 * exploitable via a browser CSRF vector in the first place, since a
 * malicious *webpage* can't suppress its own Origin header. If VYRAL
 * later adds a mobile app using this same cookie-based session, switch
 * that client to a bearer-token auth path rather than loosening this
 * check.
 */
const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function checkCsrf(req: NextRequest): NextResponse | null {
  if (!UNSAFE_METHODS.has(req.method)) return null;

  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");
  const source = origin ?? referer;
  if (!source) return null; // no browser-supplied origin info — not a browser CSRF vector

  let sourceHost: string;
  try {
    sourceHost = new URL(source).host;
  } catch {
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  }

  const expectedHost = req.headers.get("host");
  if (!expectedHost || sourceHost !== expectedHost) {
    return NextResponse.json({ error: "Cross-origin request rejected" }, { status: 403 });
  }

  return null;
}
