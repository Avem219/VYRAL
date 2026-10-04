# VYRAL — Deployment Guide

## Architecture requirement (read this first)

VYRAL uses a **custom Node server** (`server.ts`) that hosts Next.js and
Socket.IO on the same HTTP server, because real-time messaging needs a
persistent WebSocket connection. **Do not deploy this to a
serverless/edge-only platform** (e.g. Vercel's default serverless
functions, Cloudflare Pages Functions) — those tear down the process
between requests and cannot hold a persistent Socket.IO connection.

Deploy to a platform that runs a long-lived Node process: a VPS, Fly.io,
Railway, Render, or a container on any standard host.

## Build & start

```bash
npm install
npm run build              # runs `next build`
npm start                  # runs `NODE_ENV=production tsx server.ts`
```

`npm run dev` runs the same custom server in development mode
(`tsx watch server.ts`), so Socket.IO works identically in dev and prod.

## Database: PostgreSQL

VYRAL requires PostgreSQL. There is no SQLite fallback — `DATABASE_URL`
is a hard requirement; the app throws on startup without it (see
`src/db/index.ts` and `drizzle.config.ts`).

### Local development setup

```bash
# Install Postgres (Ubuntu/Debian example)
sudo apt-get install postgresql postgresql-contrib
sudo service postgresql start

# Create a role and database
sudo -u postgres psql -c "CREATE ROLE vyral WITH LOGIN PASSWORD 'vyral_dev_password' CREATEDB;"
sudo -u postgres psql -c "CREATE DATABASE vyral_dev OWNER vyral;"

# In .env.local:
DATABASE_URL=postgres://vyral:vyral_dev_password@localhost:5432/vyral_dev
```

### Test database setup

The automated test suite (`npm test`) creates a **uniquely-named,
isolated Postgres database per test file run**, applies the full
migration chain to it, runs the tests, and drops it afterward (see
`src/lib/__tests__/pg-test-db.ts`). It needs a role with `CREATEDB`
privilege — the same `vyral` role above works, since it already has
`CREATEDB`. Point `TEST_DATABASE_ADMIN_URL` at that role's connection to
the `postgres` admin database (defaults to derriving it from
`DATABASE_URL` if unset):

```bash
TEST_DATABASE_ADMIN_URL=postgres://vyral:vyral_dev_password@localhost:5432/postgres
```

### Production setup

Use a managed Postgres provider (RDS, Supabase, Neon, Railway Postgres,
etc.) or a self-hosted instance. Whatever you choose:

1. Create a production database and a role scoped to just that database
   (don't reuse a broad admin role).
2. Set `DATABASE_URL` in your hosting platform's environment variables —
   never commit it.
3. Enable TLS (`?sslmode=require` in the connection string) for any
   connection that crosses a network boundary (i.e. anything that isn't
   `localhost`).

### Migration procedure

```bash
# Generate a migration after changing src/db/schema.ts:
npx drizzle-kit generate

# Apply pending migrations (safe to run repeatedly — already-applied
# migrations are skipped):
npx drizzle-kit migrate
```

Run `drizzle-kit migrate` as a deploy step — before the new application
version starts serving traffic, not after. For zero-downtime deploys
with additive schema changes (new nullable columns, new tables), this is
safe to run while the previous version is still live. Destructive changes
(dropping/renaming a column that's in active use) need a
backward-compatible multi-step migration — VYRAL hasn't needed one yet
because all schema changes so far have been additive.

### Backup recommendation

VYRAL's application code does **not** implement its own backup system —
don't assume it does. Use your Postgres provider's built-in backups
(most managed providers do automated daily snapshots + point-in-time
recovery) or, if self-hosting:

```bash
# Backup
pg_dump --format=custom "$DATABASE_URL" > vyral-backup-$(date +%Y%m%d).dump

# Restore (to an empty database)
pg_restore --dbname="$DATABASE_URL" vyral-backup-20260101.dump
```

Schedule `pg_dump` via cron (or your provider's snapshot feature) and
test the restore procedure at least once before you need it for real —
an untested backup is not a backup.

### Connection pooling

`src/db/index.ts` uses a single `pg.Pool` per process (node-postgres's
built-in pooling), which is appropriate for a single long-lived server
process. If you scale to multiple app instances (or a serverless
component elsewhere in your stack), put a connection pooler (PgBouncer,
or your managed provider's built-in pooler — e.g. Supabase's
"Transaction" mode pooler) in front of Postgres so you don't exhaust the
database's own connection limit across instances.

## Object storage (media)

The default storage provider (`STORAGE_PROVIDER=local`) writes to local
disk under `.data/media` — **development only**, not durable across
deploys, no CDN. For production, use the implemented Supabase provider by setting `STORAGE_PROVIDER=supabase` and providing `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_STORAGE_BUCKET`. Local disk remains suitable only for development.

## WebSocket / real-time requirements

- The reverse proxy / load balancer in front of the app must support
  WebSocket upgrade requests and hold connections open (no aggressive
  idle timeouts below a minute or so).
- If you run multiple app instances behind a load balancer, use
  **sticky sessions** (session affinity) so a client's WebSocket
  reconnects land on the same instance — the current Socket.IO setup
  doesn't use a shared adapter (e.g. `socket.io-redis`) across instances,
  so cross-instance broadcast wouldn't work without adding one first.

## HTTPS

Terminate TLS at your reverse proxy/load balancer (or your hosting
platform's built-in HTTPS). Set the `Secure` cookie flag is already
conditional on `NODE_ENV === "production"` in `src/lib/auth.ts` — make
sure `NODE_ENV=production` is actually set in your deployment
environment, or session cookies won't get the `Secure` flag.

## Environment variables checklist

See `.env.example` for the full annotated list. At minimum for
production:

- `NODE_ENV=production`
- `DATABASE_URL` (Postgres, required)
- `STORAGE_PROVIDER` + its credentials (once you've implemented a real
  provider — local disk is not viable in production)
- `PORT` (optional, defaults to 3000)

## What's NOT deployment-blocked but also not done

Google OAuth and a real music-provider integration are both genuinely
unimplemented — not blocked on missing credentials, just not built yet.
The `users`/`sessions` tables and session-creation logic in
`src/lib/auth.ts` would support adding an OAuth login path without a
schema change, and the `tracks` table plus music-attachment fields on
posts/stories/reels/Express exist in the schema, but no OAuth callback
route and no music-provider client code exist in this codebase yet. Both
are real remaining engineering work.
