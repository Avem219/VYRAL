import crypto from "crypto";

const GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_ENDPOINT = "https://www.googleapis.com/oauth2/v3/userinfo";

export function isGoogleOAuthConfigured(): boolean {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function getGoogleRedirectUri(requestOrigin: string): string {
  // Allow an explicit override for production (where the public origin may
  // differ from what the server sees, e.g. behind a proxy), but default to
  // deriving it from the actual request so local dev needs zero config
  // beyond the client id/secret.
  return process.env.GOOGLE_REDIRECT_URI || `${requestOrigin}/api/auth/oauth/google/callback`;
}

/** Cryptographically random, unguessable, single-use state token — the CSRF protection for the OAuth flow itself. */
export function generateOAuthState(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function buildGoogleAuthUrl(params: { state: string; redirectUri: string }): string {
  if (!process.env.GOOGLE_CLIENT_ID) {
    throw new Error("GOOGLE_CLIENT_ID is not configured");
  }
  const url = new URL(GOOGLE_AUTH_ENDPOINT);
  url.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID);
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", params.state);
  // Forces Google to always show the account chooser rather than silently
  // reusing a previously-selected account in the browser session.
  url.searchParams.set("prompt", "select_account");
  return url.toString();
}

export type GoogleTokenResponse = {
  access_token: string;
  id_token: string;
  expires_in: number;
  token_type: string;
};

export type GoogleUserInfo = {
  sub: string; // stable Google account id — this is providerAccountId, never the email
  email: string;
  email_verified: boolean;
  name?: string;
  picture?: string;
};

/**
 * Exchanges an authorization code for tokens. Requires real network access
 * to oauth2.googleapis.com and real GOOGLE_CLIENT_ID/SECRET — this is the
 * part that cannot be exercised in an environment without both. The
 * function itself is complete and correct per Google's documented token
 * endpoint contract.
 */
export async function exchangeCodeForTokens(code: string, redirectUri: string): Promise<GoogleTokenResponse> {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    throw new Error("Google OAuth is not configured");
  }
  const res = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) {
    throw new Error(`Google token exchange failed: ${res.status}`);
  }
  return res.json();
}

export async function fetchGoogleUserInfo(accessToken: string): Promise<GoogleUserInfo> {
  const res = await fetch(GOOGLE_USERINFO_ENDPOINT, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Google userinfo fetch failed: ${res.status}`);
  }
  return res.json();
}
