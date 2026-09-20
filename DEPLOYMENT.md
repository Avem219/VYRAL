# VYRAL — Production Deployment

VYRAL is a Next.js App Router application hosted by a custom long-lived Node process (`server.ts`) with Socket.IO. It therefore needs a persistent Node/container service, not a serverless-only deployment.

## Required production services

- PostgreSQL 16+ (`DATABASE_URL`)
- Object storage: S3-compatible/R2 or Supabase Storage (`STORAGE_PROVIDER`)
- Persistent Node host (Docker-supported VPS/Render/Railway/Fly.io/etc.)
- HTTPS at the host/proxy
- Redis for more than one VYRAL Node instance (`REDIS_URL`)
- Google OAuth credentials if Google sign-in is enabled
- Spotify Web API credentials if music search is enabled

## Build and run

```bash
npm install
npx drizzle-kit migrate
npm run typecheck
npm run lint
npm test
npm run build
NODE_ENV=production npm start
```

Health check: `GET /api/health`.

## PostgreSQL

PostgreSQL is canonical; there is no SQLite runtime fallback. Use a dedicated least-privilege production role and TLS for remote databases.

`DATABASE_URL=postgres://USER:PASSWORD@HOST:5432/DB?sslmode=require`

Run migrations as a deployment step before serving the new version. Take provider-managed snapshots/PITR or scheduled `pg_dump` backups and test restores.

## Object storage

`STORAGE_PROVIDER=local` is development-only. Production should use `s3`, `r2`, or `supabase`.

S3/R2 variables:

```text
STORAGE_PROVIDER=r2
R2_ACCOUNT_ID=...
R2_BUCKET=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
S3_REGION=auto
```

or generic S3:

```text
STORAGE_PROVIDER=s3
S3_BUCKET=...
S3_REGION=...
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
S3_ENDPOINT=https://...
```

Supabase:

```text
STORAGE_PROVIDER=supabase
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_STORAGE_BUCKET=...
```

Media authorization is intentionally performed by VYRAL's `/api/media/[id]` route even when an object-storage provider is configured. This prevents a short-lived object URL from becoming an authorization bypass for private Express, Stories, Close Circles, restricted posts, Reels, or message attachments.

## Google OAuth

Register the exact callback:

```text
https://YOUR_HOST/api/auth/google/callback
```

Set:

```text
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=https://YOUR_HOST/api/auth/google/callback
```

The implementation validates OAuth state and verifies the returned Google ID token using Google's published signing keys. No client-supplied identity is trusted.

## Music

VYRAL uses a provider abstraction and currently supports Spotify Web API metadata/search when credentials are present:

```text
SPOTIFY_CLIENT_ID=...
SPOTIFY_CLIENT_SECRET=...
```

VYRAL does not download, scrape, or host copyrighted provider tracks. External provider URLs and provider-supplied metadata are used instead.

## Realtime and horizontal scaling

A single Node process works without Redis. Multiple VYRAL instances require Redis and the Socket.IO Redis adapter:

```text
REDIS_URL=redis://:PASSWORD@HOST:6379
```

When `REDIS_URL` is set, `server.ts` loads the Redis adapter and fails startup if the adapter cannot be initialized. This is deliberate: silently running multiple instances without shared pub/sub would produce inconsistent realtime behavior.

A production load balancer must support WebSocket upgrades and long-lived connections. Sticky sessions are optional with the Redis adapter for event propagation, but connection affinity can still simplify operational behavior. Test the chosen load-balancer configuration with WebSocket upgrades before launch.

## Docker

The repository includes a `Dockerfile` with:

- dependency installation
- production build
- minimal runtime image
- health check
- custom Node server startup

Example:

```bash
docker build -t vyral .
docker run --env-file .env.production -p 3000:3000 vyral
```

## Render

`render.yaml` provides a persistent Docker web-service configuration. It intentionally leaves secrets as `sync: false`; connect a managed PostgreSQL database and Redis instance in the hosting account and provide their URLs.

## Security

Never commit `.env.local` or production secrets. Production cookies require `NODE_ENV=production`. Keep OAuth client secrets, storage credentials, Redis credentials, and database credentials server-side only.

## E2E

The repository contains a Playwright smoke suite in `e2e/` and `playwright.config.ts`. Install the declared dev dependency and browser binaries in CI, then run:

```bash
npx playwright install --with-deps chromium
npm run e2e
```

Use a dedicated test database/environment. Never point destructive E2E tests at production.


## Dependency lockfile

The distributed source package intentionally does not include a stale `package-lock.json`; the dependency graph was changed during the PostgreSQL/Redis/Playwright production pass and this environment could not regenerate the lockfile because the npm registry was unavailable. On the connected CI/hosting runner, `npm install` should generate a fresh lockfile and subsequent CI runs should use the committed lockfile with `npm ci`.
