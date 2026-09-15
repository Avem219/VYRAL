import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { db, schema } from "@/db";
import { eq, and, isNull, gt } from "drizzle-orm";
import crypto from "crypto";

export const SESSION_COOKIE = "vyral_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/** Core session lookup, independent of Next's request-scoped cookies() API — usable from the raw Socket.IO handshake as well as normal request handlers. */
export async function getUserForSessionToken(token: string) {
  const tokenHash = hashToken(token);
  const nowIso = new Date().toISOString();

  const rows = await db
    .select({ user: schema.users, sessionId: schema.sessions.id })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .where(
      and(
        eq(schema.sessions.tokenHash, tokenHash),
        isNull(schema.sessions.revokedAt),
        gt(schema.sessions.expiresAt, nowIso)
      )
    )
    .limit(1);

  const foundUser = rows[0]?.user ?? null;
  if (foundUser?.suspendedAt) return null;
  return foundUser;
}

/** Creates a session row and sets the httpOnly cookie. Call after successful auth. */
export async function createSession(userId: string) {
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();

  await db.insert(schema.sessions).values({
    userId,
    tokenHash,
    expiresAt,
  });

  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

/** Reads the session cookie, validates it against the DB, and returns the user (or null). */
export async function getCurrentUser() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return getUserForSessionToken(token);
}

/** Revokes the current session and clears the cookie. */
export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    const tokenHash = hashToken(token);
    await db
      .update(schema.sessions)
      .set({ revokedAt: new Date().toISOString() })
      .where(eq(schema.sessions.tokenHash, tokenHash));
  }
  jar.delete(SESSION_COOKIE);
}

/** Simple in-memory sliding-window rate limiter, keyed by caller-supplied string (e.g. IP+route). */
const buckets = new Map<string, { count: number; resetAt: number }>();
const MAX_RATE_LIMIT_KEYS = 10_000;
let lastRateLimitCleanup = 0;

export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  // Bound memory usage in long-lived Node processes. This is intentionally a
  // process-local limiter; production deployments with multiple instances
  // should use an external/shared limiter for a global quota.
  if (buckets.size >= MAX_RATE_LIMIT_KEYS && now - lastRateLimitCleanup > 5_000) {
    lastRateLimitCleanup = now;
    for (const [k, v] of buckets) {
      if (v.resetAt <= now) buckets.delete(k);
      if (buckets.size < MAX_RATE_LIMIT_KEYS * 0.8) break;
    }
  }
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1 };
  }
  if (bucket.count >= limit) {
    return { allowed: false, remaining: 0 };
  }
  bucket.count += 1;
  return { allowed: true, remaining: limit - bucket.count };
}
