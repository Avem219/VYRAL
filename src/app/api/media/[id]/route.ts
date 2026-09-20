import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db";
import { eq, like, and, or } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { getStorageProvider } from "@/lib/storage";
import { isStoryAudienceAuthorized } from "@/lib/stories";
import { canViewPost } from "@/lib/posts";

/**
 * Media authorization is resolved from whatever content actually
 * references it, not from a single static flag — a photo attached to a
 * "connections only" post must be exactly as restricted as the post
 * itself, even if it was uploaded with isPrivate=false. This is the one
 * place that decides "can this viewer see these bytes"; extend it here
 * (not by relaxing a check elsewhere) as new content types attach media.
 */
async function isAuthorizedForMedia(mediaId: string, viewerId: string | null): Promise<boolean> {
  // Express: sender/recipient only, regardless of anything else.
  const [express] = await db.select().from(schema.expressMessages).where(eq(schema.expressMessages.mediaId, mediaId)).limit(1);
  if (express) return viewerId != null && (express.senderId === viewerId || express.recipientId === viewerId);

  // Stories: reuse the Stories API's own audience/circle/block logic.
  const [story] = await db.select().from(schema.stories).where(eq(schema.stories.mediaId, mediaId)).limit(1);
  if (story) return viewerId != null && (await isStoryAudienceAuthorized(story, viewerId));

  // Reels: same broad rule the reels feed uses (everyone, or connections-only).
  const [reel] = await db.select().from(schema.reels).where(eq(schema.reels.mediaId, mediaId)).limit(1);
  if (reel) {
    if (reel.audience === "everyone") return true;
    if (!viewerId) return false;
    const [conn] = await db
      .select()
      .from(schema.connections)
      .where(
        and(
          eq(schema.connections.status, "accepted"),
          or(
            and(eq(schema.connections.requesterId, viewerId), eq(schema.connections.addresseeId, reel.authorId)),
            and(eq(schema.connections.requesterId, reel.authorId), eq(schema.connections.addresseeId, viewerId))
          )
        )
      )
      .limit(1);
    return !!conn;
  }

  // Message attachments: only members of the conversation the message
  // belongs to.
  const [message] = await db.select().from(schema.messages).where(eq(schema.messages.mediaId, mediaId)).limit(1);
  if (message) {
    if (!viewerId) return false;
    const [membership] = await db
      .select()
      .from(schema.conversationMembers)
      .where(and(eq(schema.conversationMembers.conversationId, message.conversationId), eq(schema.conversationMembers.userId, viewerId)))
      .limit(1);
    return !!membership;
  }

  // Posts: media IDs live inside a JSON array column, so we match on the
  // quoted id substring, then re-check full post audience/block rules.
  const candidatePosts = await db.select().from(schema.posts).where(like(schema.posts.mediaJson, `%"${mediaId}"%`));
  if (candidatePosts.length > 0) {
    if (!viewerId) return candidatePosts.some((p) => p.audience === "everyone");
    for (const post of candidatePosts) {
      if (await canViewPost(post, viewerId)) return true;
    }
    return false;
  }

  // Not yet referenced by any content (e.g. mid-upload, not yet attached to
  // a post) — only the owner can see it. Caller already allows the owner
  // through before reaching this function.
  return false;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await getCurrentUser();

  const [row] = await db.select().from(schema.media).where(eq(schema.media.id, id)).limit(1);
  if (!row || row.status !== "ready") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (viewer?.id !== row.ownerId) {
    const authorized = await isAuthorizedForMedia(row.id, viewer?.id ?? null);
    if (!authorized) return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const provider = getStorageProvider();
  const bytes = await provider.get(row.storageKey);
  if (!bytes) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": row.mimeType,
      // The media URL is always an authorization boundary. Never allow a
      // shared browser/CDN cache to replay bytes to a different viewer after
      // the authorization decision has changed (e.g. a connection is removed
      // or an Express is recalled).
      "Cache-Control": "private, no-store",
    },
  });
}
