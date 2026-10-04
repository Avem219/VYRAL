# VYRAL — External Integration Checklist

Everything on this list requires **your** action outside this repository —
an account, a credential, a domain you own, or a decision only you can make.
Nothing here is unfinished code; the corresponding implementation is
complete and waiting on these values. No secret values are stored in this
repository — only variable names in `.env.example`.

---

## 1. Google OAuth ("Continue with Google")

- **Purpose**: lets people sign in/register with their Google account
  instead of a password.
- **Status**: code complete (`src/lib/oauth-google.ts`,
  `src/lib/oauth-account.ts`, `/api/auth/oauth/google`,
  `/api/auth/oauth/google/callback`), unit-tested (`oauth.test.ts`, 9
  tests covering state generation, URL building, and every account-linking
  branch — new user, returning user, verified-email linking, and the
  unverified-email collision case). **Not** end-to-end tested against
  Google's real servers — this sandbox has no network route to
  `accounts.google.com` regardless of credentials, so that step is yours.
- **Environment variables**: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
  (optionally `GOOGLE_REDIRECT_URI` if your public URL differs from what
  the server sees directly, e.g. behind a proxy).
- **Where to obtain it**: [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
  → Create Credentials → OAuth client ID → Web application.
- **Exact redirect URI to register**: `https://YOUR_DOMAIN/api/auth/oauth/google/callback`
  (and `http://localhost:3000/api/auth/oauth/google/callback` for local testing).
- **Required or optional**: optional — the app works fully with
  email/password only; the Google button simply doesn't appear when
  unconfigured (checked via `/api/auth/oauth/config`).

---

## 2. Production object storage (media)

- **Purpose**: durable, CDN-backed storage for uploaded images/videos —
  the local-disk provider (`STORAGE_PROVIDER=local`) is dev-only and
  won't survive a redeploy.
- **Status**: local storage and a real Supabase Storage provider are implemented. The media route also supports HTTP range retrieval for video playback. Use `STORAGE_PROVIDER=supabase` plus the Supabase credentials for production.
- **Environment variables**: depends on provider —
  `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`,
  `S3_ENDPOINT` (R2/non-AWS only) — or `SUPABASE_URL`,
  `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET`. See
  `.env.example`.
- **Where to obtain it**: your chosen provider's console (AWS S3,
  Cloudflare R2, or Supabase Storage).
- **Required or optional**: **required for production** — local disk is
  not viable once you have more than one server instance or a redeploy.

---

## 3. Music provider (Spotify)

- **Purpose**: real track/artist catalog search and attribution.
- **Status**: implemented. `src/lib/music.ts` uses Spotify Client Credentials, `/api/music/search` searches the catalog, and `/api/music/tracks` persists selected track metadata. The frontend picker is wired into Reel creation and profile music.
- **Environment variables**: `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET`.
- **Important limitation**: VYRAL stores metadata and the official Spotify URL; it does not re-host Spotify audio. Full in-app playback would require a separate Spotify playback integration and applicable account/licensing requirements.
- **Required or optional**: optional.

---

## 4. Production PostgreSQL

- **Purpose**: the actual production database. Development/testing use a
  local Postgres instance (see `DEPLOYMENT.md`); production needs a real
  managed or self-hosted instance reachable from your app server.
- **Status**: fully cut over and tested (see `FINALIZATION_STATUS.md`) —
  this is purely a "point it at a real instance" step, no code work
  remains.
- **Environment variable**: `DATABASE_URL`.
- **Where to obtain it**: a managed provider (RDS, Supabase, Neon,
  Railway Postgres) or your own self-hosted instance.
- **Required or optional**: **required** — there is no SQLite fallback.

---

## 5. Hosting / domain / DNS

- **Purpose**: actually running the app somewhere reachable, with HTTPS.
- **Status**: `DEPLOYMENT.md` documents the exact requirement — a
  platform that runs a **persistent Node process** (not
  serverless/edge-only), because the custom Socket.IO server needs a
  long-lived connection.
- **Required or optional**: required to launch, obviously — but purely
  an account/billing/DNS decision, no remaining code work.

---

## 6. Redis (only if you scale to multiple app instances)

- **Purpose**: lets Socket.IO broadcast real-time events across more
  than one server process, and would let the in-memory rate limiter
  (`src/lib/auth.ts`) work correctly across instances too.
- **Status**: **not implemented** — the current setup assumes a single
  Node process, which is correct for a first production deployment.
  Needed only once you scale horizontally; at that point, add the
  `socket.io-redis` adapter and move the rate limiter to Redis-backed
  counters.
- **Environment variable**: `REDIS_URL` (not yet read anywhere in the
  code — add it when you actually need this).
- **Required or optional**: optional, until you run more than one
  instance.

---

## What is deliberately NOT on this list

Anything that could be built without an external account was built:
PostgreSQL cutover, CSRF hardening, the OAuth code path itself, Stories
and Reels frontends, Close Circles, analytics aggregation, and the full
authorization model across posts/reels/messaging/Express. See
`FINALIZATION_STATUS.md` for the honest, tested-vs-untested breakdown of
all of that.
