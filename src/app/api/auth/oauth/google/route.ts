import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isGoogleOAuthConfigured, getGoogleRedirectUri, generateOAuthState, buildGoogleAuthUrl } from "@/lib/oauth-google";

const STATE_COOKIE = "vyral_oauth_state";

export async function GET(req: NextRequest) {
  if (!isGoogleOAuthConfigured()) {
    return NextResponse.json(
      { error: "Google sign-in isn't configured on this server yet. See EXTERNAL_INTEGRATION_REQUIRED.md." },
      { status: 503 }
    );
  }

  const origin = req.nextUrl.origin;
  const redirectUri = getGoogleRedirectUri(origin);
  const state = generateOAuthState();

  const jar = await cookies();
  jar.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600, // 10 minutes — long enough for a real login, short enough to limit replay risk
  });

  return NextResponse.redirect(buildGoogleAuthUrl({ state, redirectUri }));
}
