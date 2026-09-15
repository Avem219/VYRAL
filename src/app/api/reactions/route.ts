import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, schema } from "@/db";
import { and, eq } from "drizzle-orm";
import { requireUser } from "@/lib/require-auth";
import { canViewPost } from "@/lib/posts";
import { canViewReel } from "@/lib/reels";
import { isStoryAudienceAuthorized } from "@/lib/stories";

const Schema = z.object({
  targetType: z.enum(["post", "comment", "story", "reel"]),
  targetId: z.string().uuid(),
  kind: z.string().max(20).default("like"),
});

export async function POST(req: NextRequest) {
  const { user, res } = await requireUser();
  if (!user) return res;

  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const { targetType, targetId, kind } = parsed.data;

  // A reaction is also an interaction with content. Do not allow callers to
  // create reactions against arbitrary UUIDs or content they cannot view.
  if (targetType === "post") {
    const [post] = await db.select().from(schema.posts).where(eq(schema.posts.id, targetId)).limit(1);
    if (!post || !(await canViewPost(post, user.id))) return NextResponse.json({ error: "Not found" }, { status: 404 });
  } else if (targetType === "reel") {
    const [reel] = await db.select().from(schema.reels).where(eq(schema.reels.id, targetId)).limit(1);
    if (!reel || !(await canViewReel(reel, user.id))) return NextResponse.json({ error: "Not found" }, { status: 404 });
  } else if (targetType === "story") {
    const [story] = await db.select().from(schema.stories).where(eq(schema.stories.id, targetId)).limit(1);
    if (!story || new Date(story.expiresAt) <= new Date() || !(await isStoryAudienceAuthorized(story, user.id))) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  } else {
    const [comment] = await db.select().from(schema.comments).where(eq(schema.comments.id, targetId)).limit(1);
    if (!comment) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (comment.postId) {
      const [post] = await db.select().from(schema.posts).where(eq(schema.posts.id, comment.postId)).limit(1);
      if (!post || !(await canViewPost(post, user.id))) return NextResponse.json({ error: "Not found" }, { status: 404 });
    } else if (comment.reelId) {
      const [reel] = await db.select().from(schema.reels).where(eq(schema.reels.id, comment.reelId)).limit(1);
      if (!reel || !(await canViewReel(reel, user.id))) return NextResponse.json({ error: "Not found" }, { status: 404 });
    } else {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  }

  const existing = await db
    .select()
    .from(schema.reactions)
    .where(
      and(
        eq(schema.reactions.userId, user.id),
        eq(schema.reactions.targetType, targetType),
        eq(schema.reactions.targetId, targetId),
        eq(schema.reactions.kind, kind)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    await db.delete(schema.reactions).where(eq(schema.reactions.id, existing[0].id));
    return NextResponse.json({ reacted: false });
  }

  await db.insert(schema.reactions).values({ userId: user.id, targetType, targetId, kind });
  return NextResponse.json({ reacted: true });
}
