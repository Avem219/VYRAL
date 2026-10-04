import { db, schema } from "@/db";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";
import { hashPassword } from "@/lib/auth";
import type { GoogleUserInfo } from "@/lib/oauth-google";

export class OAuthAccountError extends Error {}

function usernameFromEmail(email: string): string {
  const base = email
    .split("@")[0]
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 20);
  return base || "user";
}

async function findAvailableUsername(base: string): Promise<string> {
  let candidate = base;
  let suffix = 0;
  // Bounded retry — a genuinely unbounded loop here would be a DoS surface
  // if somehow every variant collided; in practice this resolves in 1-2 tries.
  while (suffix < 1000) {
    const [existing] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.username, candidate)).limit(1);
    if (!existing) return candidate;
    suffix += 1;
    candidate = `${base}${suffix}`;
  }
  throw new OAuthAccountError("Could not generate a unique username");
}

/**
 * Finds or creates the VYRAL user for a Google identity, in this order:
 * 1. An existing oauth_accounts row for this provider+providerAccountId (returning user).
 * 2. An existing user with this exact, Google-verified email (account linking —
 *    only linked when Google reports the email as verified, so an attacker
 *    can't claim someone else's account via an unverified email claim).
 * 3. A brand-new user + profile, with a random unusable password (never
 *    shared with anyone) since they authenticate via Google, not a password.
 */
export async function findOrCreateUserForGoogleAccount(info: GoogleUserInfo) {
  if (!info.email) {
    throw new OAuthAccountError("Google account has no email");
  }

  const [existingLink] = await db
    .select()
    .from(schema.oauthAccounts)
    .where(and(eq(schema.oauthAccounts.provider, "google"), eq(schema.oauthAccounts.providerAccountId, info.sub)))
    .limit(1);
  if (existingLink) {
    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, existingLink.userId)).limit(1);
    if (!user) throw new OAuthAccountError("Linked account no longer exists");
    return user;
  }

  const email = info.email.toLowerCase();

  if (info.email_verified) {
    const [existingUser] = await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
    if (existingUser) {
      await db.insert(schema.oauthAccounts).values({
        userId: existingUser.id,
        provider: "google",
        providerAccountId: info.sub,
        email,
      });
      return existingUser;
    }
  } else {
    // Google reports this email as unverified — we won't link it to an
    // existing account (that would let anyone claim an account merely by
    // registering an unverified address at Google). But we also can't
    // create a *new* account with an email that's already taken; surface a
    // clear, intentional error instead of letting the database's unique
    // constraint fail underneath us.
    const [existingUser] = await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
    if (existingUser) {
      throw new OAuthAccountError(
        "An account with this email already exists. Sign in with your password, or verify this address with Google first."
      );
    }
  }

  const username = await findAvailableUsername(usernameFromEmail(email));
  const randomPassword = crypto.randomBytes(32).toString("hex");
  const passwordHash = await hashPassword(randomPassword);

  const [newUser] = await db
    .insert(schema.users)
    .values({
      email,
      username,
      passwordHash,
      emailVerifiedAt: info.email_verified ? new Date().toISOString() : null,
    })
    .returning();

  await db.insert(schema.profiles).values({ userId: newUser.id, displayName: info.name || username });
  await db.insert(schema.expressPermissions).values({ userId: newUser.id });
  await db.insert(schema.oauthAccounts).values({
    userId: newUser.id,
    provider: "google",
    providerAccountId: info.sub,
    email,
  });

  return newUser;
}
