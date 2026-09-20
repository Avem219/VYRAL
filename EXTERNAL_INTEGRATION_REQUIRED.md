# VYRAL — External Integration Required

This is the **only** remaining activation checklist. The application source is intended to be internally complete; these items require accounts, credentials, infrastructure, or DNS outside the repository.

| Item | Required? | Purpose | Configuration |
|---|---|---|---|
| PostgreSQL 16+ | Yes | Production database | `DATABASE_URL` |
| Object storage (R2/S3/Supabase) | Yes | Durable media storage | `STORAGE_PROVIDER` + provider credentials |
| Persistent Node hosting | Yes | Next.js + Socket.IO process | Deploy the Docker image / repository |
| HTTPS + production origin | Yes | Secure cookies, OAuth, canonical URLs | `NEXT_PUBLIC_APP_URL` |
| Google OAuth | Optional | Google sign-in | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` |
| Spotify Web API | Optional | Music metadata/search | `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET` |
| Redis | Optional for one instance; required for multiple instances | Cross-instance Socket.IO events | `REDIS_URL` |

## Google OAuth callback

`https://YOUR_HOST/api/auth/google/callback`

## What must NOT be done in the repository

- Do not commit production secrets.
- Do not put OAuth client secrets or storage service keys in browser code.
- Do not enable local media storage in production.
- Do not claim an external provider is live until credentials have been supplied and the integration has been tested.
