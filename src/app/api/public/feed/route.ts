import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { eq, inArray, desc, sql } from "drizzle-orm";
import { getMediaUrl } from "@/lib/storage";

/**
 * No authentication required — this is the logged-out "browse" experience.
 * Deliberately narrow: only posts whose author explicitly chose "everyone"
 * visibility, and only public profile fields. Never touches Express,
 * private/connections-only content, or anything gated by discoverability.
 */
export async function GET() {
  const posts = await db
    .select()
    .from(schema.posts)
    .where(eq(schema.posts.audience, "everyone"))
    .orderBy(desc(schema.posts.createdAt))
    .limit(20);

  if (posts.length === 0) return NextResponse.json({ items: [] });

  const authorIds = [...new Set(posts.map((p) => p.authorId))];
  const [authors, profiles, reactionCounts, commentCounts] = await Promise.all([
    db.select().from(schema.users).where(inArray(schema.users.id, authorIds)),
    db.select().from(schema.profiles).where(inArray(schema.profiles.userId, authorIds)),
    db
      .select({ targetId: schema.reactions.targetId, count: sql<number>`count(*)::int` })
      .from(schema.reactions)
      .where(inArray(schema.reactions.targetId, posts.map((p) => p.id)))
      .groupBy(schema.reactions.targetId),
    db
      .select({ postId: schema.comments.postId, count: sql<number>`count(*)::int` })
      .from(schema.comments)
      .where(inArray(schema.comments.postId, posts.map((p) => p.id)))
      .groupBy(schema.comments.postId),
  ]);

  const publicProfiles = new Map(profiles.filter((p) => p.discoverability !== "nobody").map((p) => [p.userId, p]));
  const authorById = new Map(authors.map((a) => [a.id, a]));
  const reactionMap = new Map(reactionCounts.map((r) => [r.targetId, r.count]));
  const commentMap = new Map(commentCounts.map((c) => [c.postId, c.count]));

  const visible = posts.filter((p) => publicProfiles.has(p.authorId));

  const mediaIds = visible.flatMap((p) => (p.mediaJson ? (JSON.parse(p.mediaJson) as string[]) : []));
  const mediaRows = mediaIds.length ? await db.select().from(schema.media).where(inArray(schema.media.id, [...new Set(mediaIds)])) : [];
  const mediaUrlById = new Map<string, string>();
  await Promise.all(mediaRows.map(async (m) => mediaUrlById.set(m.id, await getMediaUrl(m))));

  const items = visible.map((p) => {
    const mediaIdsForPost: string[] = p.mediaJson ? JSON.parse(p.mediaJson) : [];
    const profile = publicProfiles.get(p.authorId);
    const author = authorById.get(p.authorId);
    return {
      id: p.id,
      kind: p.kind,
      body: p.body,
      media: mediaIdsForPost.map((id) => mediaUrlById.get(id)).filter((u): u is string => !!u),
      createdAt: p.createdAt,
      reactionCount: reactionMap.get(p.id) ?? 0,
      commentCount: commentMap.get(p.id) ?? 0,
      author: author && { id: author.id, username: author.username, displayName: profile?.displayName },
    };
  });

  return NextResponse.json({ items });
}
