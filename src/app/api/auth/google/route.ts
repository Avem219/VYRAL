import { NextRequest, NextResponse } from "next/server";
import { createOAuthState, googleAuthorizationUrl, googleRedirectUri, oauthConfigured } from "@/lib/oauth";

export async function GET(req: NextRequest) {
  if (!oauthConfigured()) return NextResponse.json({ error: "Google OAuth is not configured" }, { status: 503 });
  const state = createOAuthState();
  const origin = `${req.nextUrl.protocol}//${req.nextUrl.host}`;
  const redirectUri = googleRedirectUri(origin);
  if (process.env.NODE_ENV === "production" && !process.env.GOOGLE_REDIRECT_URI && !process.env.NEXT_PUBLIC_APP_URL) {
    return NextResponse.json({ error: "Google OAuth requires GOOGLE_REDIRECT_URI or NEXT_PUBLIC_APP_URL in production" }, { status: 503 });
  }
  const response = NextResponse.redirect(googleAuthorizationUrl(state, redirectUri));
  response.cookies.set("vyral_oauth_state", state, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 600, path: "/" });
  return response;
}
