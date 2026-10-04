import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { createIsolatedTestDatabase } from "./pg-test-db";

let dropTestDb: () => Promise<void>;

describe("OAuth", () => {
  let db: typeof import("../../db").db;
  let schema: typeof import("../../db").schema;

  before(async () => {
    dropTestDb = await createIsolatedTestDatabase();
    ({ db, schema } = await import("../../db"));
    process.env.GOOGLE_CLIENT_ID = "test-client-id";
    process.env.GOOGLE_CLIENT_SECRET = "test-client-secret";
  });

  after(async () => {
    const { pool } = await import("../../db");
    await pool.end();
    await dropTestDb();
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
  });

  describe("pure logic (no network required)", () => {
    test("generateOAuthState produces unique, sufficiently long tokens", async () => {
      const { generateOAuthState } = await import("../oauth-google");
      const a = generateOAuthState();
      const b = generateOAuthState();
      assert.notEqual(a, b);
      assert.ok(a.length >= 32);
    });

    test("isGoogleOAuthConfigured reflects whether both env vars are set", async () => {
      const { isGoogleOAuthConfigured } = await import("../oauth-google");
      assert.equal(isGoogleOAuthConfigured(), true);

      delete process.env.GOOGLE_CLIENT_SECRET;
      assert.equal(isGoogleOAuthConfigured(), false);
      process.env.GOOGLE_CLIENT_SECRET = "test-client-secret";
    });

    test("buildGoogleAuthUrl includes state, redirect_uri, and requests email+profile scope", async () => {
      const { buildGoogleAuthUrl } = await import("../oauth-google");
      const url = new URL(buildGoogleAuthUrl({ state: "abc123", redirectUri: "https://vyral.example/api/auth/oauth/google/callback" }));
      assert.equal(url.searchParams.get("state"), "abc123");
      assert.equal(url.searchParams.get("redirect_uri"), "https://vyral.example/api/auth/oauth/google/callback");
      assert.match(url.searchParams.get("scope") ?? "", /email/);
      assert.match(url.searchParams.get("scope") ?? "", /profile/);
      assert.equal(url.searchParams.get("client_id"), "test-client-id");
    });

    test("getGoogleRedirectUri derives from the request origin when no override is set", async () => {
      const { getGoogleRedirectUri } = await import("../oauth-google");
      assert.equal(
        getGoogleRedirectUri("https://vyral.example"),
        "https://vyral.example/api/auth/oauth/google/callback"
      );
    });
  });

  describe("account linking (real database, no network)", () => {
    test("a brand-new Google identity creates a new user, profile, and oauth_accounts link", async () => {
      const { findOrCreateUserForGoogleAccount } = await import("../oauth-account");
      const info = { sub: "google-sub-" + Date.now(), email: `newuser${Date.now()}@example.com`, email_verified: true, name: "New User" };

      const user = await findOrCreateUserForGoogleAccount(info);
      assert.equal(user.email, info.email);

      const [profile] = await db.select().from(schema.profiles).where(eq(schema.profiles.userId, user.id));
      assert.equal(profile.displayName, "New User");

      const [link] = await db.select().from(schema.oauthAccounts).where(eq(schema.oauthAccounts.providerAccountId, info.sub));
      assert.equal(link.userId, user.id);
      assert.equal(link.provider, "google");
    });

    test("signing in again with the same Google sub returns the same user, not a duplicate", async () => {
      const { findOrCreateUserForGoogleAccount } = await import("../oauth-account");
      const info = { sub: "google-sub-repeat-" + Date.now(), email: `repeat${Date.now()}@example.com`, email_verified: true };

      const first = await findOrCreateUserForGoogleAccount(info);
      const second = await findOrCreateUserForGoogleAccount(info);
      assert.equal(first.id, second.id);
    });

    test("a verified email matching an existing account links to it instead of creating a duplicate", async () => {
      const { findOrCreateUserForGoogleAccount } = await import("../oauth-account");
      const email = `existing${Date.now()}@example.com`;
      const [existingUser] = await db.insert(schema.users).values({ email, username: "existinguser" + Date.now(), passwordHash: "x" }).returning();

      const linked = await findOrCreateUserForGoogleAccount({ sub: "google-sub-link-" + Date.now(), email, email_verified: true });
      assert.equal(linked.id, existingUser.id);
    });

    test("an unverified email with NO existing collision still creates a new account normally", async () => {
      const { findOrCreateUserForGoogleAccount } = await import("../oauth-account");
      const email = `freshunverified${Date.now()}@example.com`;

      const user = await findOrCreateUserForGoogleAccount({ sub: "google-sub-fresh-unverified-" + Date.now(), email, email_verified: false });
      assert.equal(user.email, email);
    });

    test("an UNVERIFIED email matching an existing account does NOT auto-link, and does not silently create a duplicate-email user", async () => {
      const { findOrCreateUserForGoogleAccount, OAuthAccountError } = await import("../oauth-account");
      const email = `unverified${Date.now()}@example.com`;
      await db.insert(schema.users).values({ email, username: "unverifieduser" + Date.now(), passwordHash: "x" }).returning();

      await assert.rejects(
        () => findOrCreateUserForGoogleAccount({ sub: "google-sub-unverified-" + Date.now(), email, email_verified: false }),
        OAuthAccountError
      );
    });
  });
});
