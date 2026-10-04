import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  isGoogleOAuthConfigured,
  getGoogleRedirectUri,
  exchangeCodeForTokens,
  fetchGoogleUserInfo,
} from "@/lib/oauth-google";
import { findOrCreateUserForGoogleAccount, OAuthAccountError } from "@/lib/oauth-account";
import { createSession } from "@/lib/auth";

const STATE_COOKIE = "vyral_oauth_state";

function redirectWithError(origin: string, message: string) {
  const url = new URL("/login", origin);
  url.searchParams.set("error", message);
  return NextResponse.redirect(url);
}

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;

  if (!isGoogleOAuthConfigured()) {
    return redirectWithError(origin, "google_not_configured");
  }

  const error = req.nextUrl.searchParams.get("error");
  if (error) {
    // The user declined at Google's consent screen, or Google reported an
    // error — not a bug on our end, so no need to log this as one.
    return redirectWithError(origin, "google_denied");
  }

  const code = req.nextUrl.searchParams.get("code");
  const returnedState = req.nextUrl.searchParams.get("state");
  if (!code || !returnedState) {
    return redirectWithError(origin, "invalid_callback");
  }

  const jar = await cookies();
  const expectedState = jar.get(STATE_COOKIE)?.value;
  jar.delete(STATE_COOKIE);

  // Constant-time-ish comparison isn't critical here (state isn't a secret
  // once issued, it's a per-flow nonce), but an exact match is required —
  // this is what stops an attacker from forging a callback for a victim's
  // browser (CSRF against the OAuth flow itself).
  if (!expectedState || returnedState !== expectedState) {
    return redirectWithError(origin, "state_mismatch");
  }

  try {
    const redirectUri = getGoogleRedirectUri(origin);
    const tokens = await exchangeCodeForTokens(code, redirectUri);
    const userInfo = await fetchGoogleUserInfo(tokens.access_token);
    const user = await findOrCreateUserForGoogleAccount(userInfo);

    if (user.suspendedAt) {
      return redirectWithError(origin, "account_suspended");
    }

    await createSession(user.id);
    return NextResponse.redirect(new URL("/", origin));
  } catch (e) {
    if (e instanceof OAuthAccountError) {
      return redirectWithError(origin, "account_error");
    }
    // Network/API failures talking to Google land here — surfaced to the
    // user as a generic failure, not a stack trace.
    return redirectWithError(origin, "google_unavailable");
  }
}
