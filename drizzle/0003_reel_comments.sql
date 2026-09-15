ALTER TABLE "comments" ADD COLUMN IF NOT EXISTS "reel_id" uuid;
ALTER TABLE "comments" ADD CONSTRAINT "comments_reel_id_reels_id_fk" FOREIGN KEY ("reel_id") REFERENCES "public"."reels"("id") ON DELETE cascade ON UPDATE no action;
CREATE INDEX IF NOT EXISTS "comments_reel_idx" ON "comments" USING btree ("reel_id");
ALTER TABLE "comments" ALTER COLUMN "post_id" DROP NOT NULL;
ALTER TABLE "comments" ADD CONSTRAINT "comments_target_check" CHECK (("post_id" IS NOT NULL) <> ("reel_id" IS NOT NULL));
