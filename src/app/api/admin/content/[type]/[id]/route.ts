import { NextRequest, NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireAdmin, logAudit } from "@/lib/require-admin";
import { getStorageProvider } from "@/lib/storage";

const TYPES = ["post", "reel", "story", "comment"] as const;
type ContentType = (typeof TYPES)[number];

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ type: string; id: string }> }
) {
  const { user, res } = await requireAdmin();
  if (!user) return res;

  const { type, id } = await params;
  if (!TYPES.includes(type as ContentType)) {
    return NextResponse.json({ error: "Unsupported content type" }, { status: 400 });
  }

  const contentType = type as ContentType;
  const storage = getStorageProvider();

  if (contentType === "post") {
    const [post] = await db.select().from(schema.posts).where(eq(schema.posts.id, id)).limit(1);
    if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });

    let mediaIds: unknown = [];
    try { mediaIds = post.mediaJson ? JSON.parse(post.mediaJson) : []; } catch { mediaIds = []; }
    const ids = Array.isArray(mediaIds) ? mediaIds.filter((v): v is string => typeof v === "string") : [];
    const mediaRows = ids.length ? await db.select().from(schema.media).where(inArray(schema.media.id, ids)) : [];

    await db.delete(schema.reactions).where(and(eq(schema.reactions.targetType, "post"), eq(schema.reactions.targetId, id)));
    await db.delete(schema.saves).where(and(eq(schema.saves.targetType, "post"), eq(schema.saves.targetId, id)));
    await db.delete(schema.contentViews).where(and(eq(schema.contentViews.targetType, "post"), eq(schema.contentViews.targetId, id)));
    await db.delete(schema.posts).where(eq(schema.posts.id, id));

    for (const media of mediaRows) {
      try { await storage.delete(media.storageKey); } catch { /* DB cleanup must not be undone by object-storage failure. */ }
      await db.delete(schema.media).where(eq(schema.media.id, media.id));
    }
  } else if (contentType === "reel") {
    const [reel] = await db.select().from(schema.reels).where(eq(schema.reels.id, id)).limit(1);
    if (!reel) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const mediaIds = [reel.mediaId, reel.thumbnailMediaId].filter((v): v is string => Boolean(v));
    const mediaRows = mediaIds.length ? await db.select().from(schema.media).where(inArray(schema.media.id, mediaIds)) : [];

    await db.delete(schema.reactions).where(and(eq(schema.reactions.targetType, "reel"), eq(schema.reactions.targetId, id)));
    await db.delete(schema.saves).where(and(eq(schema.saves.targetType, "reel"), eq(schema.saves.targetId, id)));
    await db.delete(schema.contentViews).where(and(eq(schema.contentViews.targetType, "reel"), eq(schema.contentViews.targetId, id)));
    await db.delete(schema.reels).where(eq(schema.reels.id, id));

    for (const media of mediaRows) {
      try { await storage.delete(media.storageKey); } catch { /* Best-effort object cleanup. */ }
      await db.delete(schema.media).where(eq(schema.media.id, media.id));
    }
  } else if (contentType === "story") {
    const [story] = await db.select().from(schema.stories).where(eq(schema.stories.id, id)).limit(1);
    if (!story) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const media = story.mediaId
      ? (await db.select().from(schema.media).where(eq(schema.media.id, story.mediaId)).limit(1))[0]
      : null;

    await db.delete(schema.reactions).where(and(eq(schema.reactions.targetType, "story"), eq(schema.reactions.targetId, id)));
    await db.delete(schema.contentViews).where(and(eq(schema.contentViews.targetType, "story"), eq(schema.contentViews.targetId, id)));
    await db.delete(schema.stories).where(eq(schema.stories.id, id));
    if (media) {
      try { await storage.delete(media.storageKey); } catch { /* Best-effort object cleanup. */ }
      await db.delete(schema.media).where(eq(schema.media.id, media.id));
    }
  } else {
    const [comment] = await db.select().from(schema.comments).where(eq(schema.comments.id, id)).limit(1);
    if (!comment) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await db.delete(schema.reactions).where(and(eq(schema.reactions.targetType, "comment"), eq(schema.reactions.targetId, id)));
    await db.delete(schema.comments).where(eq(schema.comments.id, id));
  }

  await logAudit(user.id, "content.deleted", contentType, id, { moderatorRole: user.role });
  return NextResponse.json({ ok: true });
}
