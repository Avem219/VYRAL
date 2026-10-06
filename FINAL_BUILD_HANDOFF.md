# VYRAL — Final Build Handoff

## What this package contains

This archive is the consolidated VYRAL application source intended to be uploaded as the next baseline before production debugging.

### Product areas present

- Authentication and session handling
- Google OAuth flow
- Feed, posts, comments, reactions and saves
- Profiles and profile customization
- Follow/connect/block/mute social graph
- Stories and story viewer/composer
- Reels with vertical playback, engagement and music attribution
- Direct and group messaging with Socket.IO
- Express private communication
- Close Circles
- Search
- Notifications
- Saved content
- Spotify catalog lookup / official-track linking
- Moderation/admin tools
- Analytics
- Supabase/local media abstraction
- Public profile/post/reel routes
- SEO, sitemap, robots, manifest and PWA metadata
- 3D VYRAL Universe backed by real discovery data

## Final UX pass included

- VYRAL-focused desktop navigation
- Five-item mobile primary navigation
- Universe elevated as the signature discovery surface
- Consistent chamfered-glass visual language
- Black / crimson / chrome / restrained gold visual direction
- Accessibility focus states and skip-to-content link
- Global loading, error recovery and not-found states
- Responsive layouts for mobile and desktop
- Real-data-only discovery presentation
- Privacy messaging around discovery and location
- Cleaner creation hub
- Improved Reels presentation
- Improved Universe identity presentation and interaction

## Important engineering rule

Do not replace the PostgreSQL, storage, authentication, Socket.IO, or media architecture during the first debugging pass unless a reproducible test proves a defect.

The current goal after upload is verification, not another rewrite.

## Verification to run after upload

```bash
npm ci
npm run typecheck
npm run lint
npm test
npm run build
```

Then verify in this order:

1. `/api/health`
2. registration
3. login/logout/session persistence
4. profile loading and update
5. small JPG media upload
6. private media retrieval/authorization
7. feed creation and reactions
8. story creation/view/expiry
9. reel creation/playback
10. messaging and Socket.IO
11. Express privacy
12. Close Circle privacy
13. Explore/Universe API and WebGL fallback
14. production browser E2E

## Verification limitation

This packaging environment could not complete a fresh dependency installation because the required npm package cache was incomplete. Therefore this archive must be treated as source-consolidated and statically reviewed until CI or a local `npm ci` + verification run passes.
