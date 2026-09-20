import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { createSession, hashPassword } from "@/lib/auth";
import { exchangeGoogleCode, googleRedirectUri, oauthConfigured, verifyGoogleIdToken } from "@/lib/oauth";

function safeUsername(email: string, name: string) {
  const base = (name.toLowerCase().replace(/[^a-z0-9_]+/g, "").slice(0, 18) || email.split("@")[0].replace(/[^a-z0-9_]+/g, "").slice(0, 18) || "vyraluser");
  return base.length >= 3 ? base : `${base}user`.slice(0, 24);
}

async function uniqueUsername(base: string) {
  let candidate = base;
  for (let i = 0; i < 100; i++) {
    const [existing] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.username, candidate)).limit(1);
    if (!existing) return candidate;
    const suffix = String(i + 1);
    candidate = `${base.slice(0, 24 - suffix.length)}${suffix}`;
  }
  return `vyral${crypto.randomBytes(5).toString("hex")}`.slice(0, 24);
}

export async function GET(req: NextRequest) {
  if (!oauthConfigured()) return NextResponse.redirect(new URL("/login?oauth=unavailable", req.url));
  const state = req.nextUrl.searchParams.get("state");
  const code = req.nextUrl.searchParams.get("code");
  const savedState = req.cookies.get("vyral_oauth_state")?.value;
  const clear = (response: NextResponse) => { response.cookies.set("vyral_oauth_state", "", { maxAge: 0, path: "/" }); return response; };
  if (!state || !savedState || state.length !== savedState.length || !crypto.timingSafeEqual(Buffer.from(state), Buffer.from(savedState))) {
    return clear(NextResponse.redirect(new URL("/login?oauth=invalid_state", req.url)));
  }
  if (!code) return clear(NextResponse.redirect(new URL("/login?oauth=denied", req.url)));

  try {
    const origin = `${req.nextUrl.protocol}//${req.nextUrl.host}`;
    const tokens = await exchangeGoogleCode(code, googleRedirectUri(origin));
    if (!tokens.id_token) throw new Error("Google did not return an ID token");
    const identity = await verifyGoogleIdToken(tokens.id_token);

    let [user] = await db.select().from(schema.users).where(eq(schema.users.email, identity.email)).limit(1);
    if (!user) {
      const username = await uniqueUsername(safeUsername(identity.email, identity.name));
      const passwordHash = await hashPassword(`oauth:${crypto.randomBytes(48).toString("hex")}`);
      [user] = await db.insert(schema.users).values({ email: identity.email, username, passwordHash, emailVerifiedAt: new Date().toISOString() }).returning();
      await db.insert(schema.profiles).values({ userId: user.id, displayName: identity.name || username });
      // Keep OAuth-created accounts equivalent to password-created accounts:
      // Express preferences are initialized at account creation time.
      await db.insert(schema.expressPermissions).values({ userId: user.id });
    } else if (!user.emailVerifiedAt) {
      [user] = await db.update(schema.users).set({ emailVerifiedAt: new Date().toISOString() }).where(eq(schema.users.id, user.id)).returning();
    }

    if (user.suspendedAt) {
      throw new Error("This account has been suspended");
    }
    await createSession(user.id);
    return clear(NextResponse.redirect(new URL("/", req.url)));
  } catch (error) {
    console.error("Google OAuth callback failed", error instanceof Error ? error.message : "unknown error");
    return clear(NextResponse.redirect(new URL("/login?oauth=failed", req.url)));
  }
}
