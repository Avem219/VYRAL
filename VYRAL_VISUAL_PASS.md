# VYRAL Visual / Responsive Pass

This package applies the requested VYRAL visual direction to the existing functional codebase rather than replacing functionality with a mockup.

## Included
- VYRAL logo asset wired into navigation and metadata.
- Desktop fixed navigation rail with glass treatment and active-state signal.
- Mobile top bar plus mobile bottom navigation.
- Shared glassmorphism design layer, restrained red signal accents, borders, blur and reduced-motion compatibility.
- Desktop contextual right rail using live `/api/explore`, `/api/feed`, and `/api/analytics` data for suggestions, trending signals and personal metrics.
- Responsive workspace shell that keeps immersive Explore and individual conversations full-width.
- User appearance theme from profile settings is now applied to the document root.
- Conversation chat themes (Carbon, Crimson, Glass, Aurora) with local per-conversation persistence.
- Feed visual refresh while preserving its existing real posting, reactions, saves, comments and view tracking.
- Settings theme previews.

## Verification
- ZIP integrity verified with `unzip -t`.
- A standalone TypeScript compiler is available in the environment, but dependencies are not installed in this sandbox, so a full `tsc`, ESLint, Next production build, database test suite and Playwright run cannot be claimed from this package build alone.
- The package intentionally contains the source and configuration needed for the connected GitHub/Render environment to run the normal verification workflow.

## External integrations remain separate
Google OAuth credentials, production database/storage credentials, music provider credentials, hosting/DNS and any future multi-instance Redis setup remain governed by `EXTERNAL_INTEGRATION_REQUIRED.md`.
