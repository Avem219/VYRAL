ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "music_track_id" uuid;
--> statement-breakpoint
ALTER TABLE "stories" ADD COLUMN IF NOT EXISTS "music_track_id" uuid;
--> statement-breakpoint
ALTER TABLE "express_messages" ADD COLUMN IF NOT EXISTS "music_track_id" uuid;
