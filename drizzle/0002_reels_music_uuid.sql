-- VYRAL PostgreSQL hardening: normalize the legacy reels music reference.
-- Older SQLite-derived schema used text here; Spotify IDs are external strings
-- and are never valid VYRAL track UUIDs, so invalid legacy values become NULL.
ALTER TABLE "reels"
  ALTER COLUMN "music_track_id" TYPE uuid
  USING CASE
    WHEN "music_track_id" IS NULL THEN NULL
    WHEN "music_track_id" ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
      THEN "music_track_id"::uuid
    ELSE NULL
  END;
