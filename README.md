# VYRAL — Your world. Connected.

VYRAL is a production-oriented social platform built around discovery, expression, private communication, real-time messaging, Stories, Reels, Close Circles, and a 3D social universe.

## Current consolidated build

This package consolidates the Claude progress snapshot with later VYRAL work and additional production-facing frontend/metadata work.

### Implemented product areas

- Email/password authentication and server sessions
- Google OAuth flow
- Follow, connect, block, mute
- Ranked feed, posts, comments, replies, reactions, saves
- Public browsing
- Profile pages with real post grids
- Avatar upload through the media pipeline
- Profile music links backed by Spotify catalog search
- Stories: creation, audience controls, viewing, expiry, deletion
- Reels: upload, playback, reactions, saves, comments, sharing, music attribution
- Direct and group messaging with Socket.IO
- Message attachments and reactions
- Express private messaging
- Close Circles
- 3D Explore universe
- Notifications
- Search
- Saved content
- Analytics
- Moderation/admin reports and content removal
- PWA manifest
- Dynamic robots/sitemap
- Public profile/post/Reel routes
- Dynamic Open Graph/Twitter metadata
- Shareable canonical profile/post/Reel URLs
- Media authorization and HTTP range retrieval
- Local development storage and Supabase production storage

## Music

Spotify catalog search is implemented using the Client Credentials flow.

Set:

```env
SPOTIFY_CLIENT_ID=...
SPOTIFY_CLIENT_SECRET=...
```

VYRAL searches Spotify, stores only track metadata plus the official Spotify URL, and does not re-host copyrighted Spotify audio.

Music can be attached to Reels and selected as profile music.

## Production storage

For production use Supabase Storage:

```env
STORAGE_PROVIDER=supabase
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_STORAGE_BUCKET=...
```

The media API validates file signatures, enforces the 50 MB upload limit, checks authorization before serving private bytes, and supports HTTP range requests for video playback.

## Public sharing

The public routes are:

```text
/profile/[username]
/post/[id]
/reel/[id]
```

They provide canonical URLs and dynamic social metadata. Public content is eligible for the sitemap; private/restricted content is not intentionally exposed through the public metadata layer.

## Development

```bash
npm install
npx drizzle-kit migrate
npm run dev
```

Quality commands:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

The included package-lock should be used for reproducible dependency installation.

## External configuration still required

The codebase cannot create external accounts or secrets for you. Deployment still requires your own:

- PostgreSQL database
- Supabase Storage credentials (if using Supabase)
- Spotify Developer credentials for music search
- Google OAuth credentials for Google sign-in
- production hosting configuration

No external credential is committed to this repository.
