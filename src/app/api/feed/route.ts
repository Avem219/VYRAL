import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { and, eq, inArray, notInArray, or, sql } from "drizzle-orm";
import { requireUser } from "@/lib/require-auth";
import { rankFeed, type FeedCandidate } from "@/lib/feed-ranking";
import { getMediaUrl } from "@/lib/storage";
import { getMutedIds } from "@/lib/mutes";

export async function GET() {
  const { user, res } = await requireUser();
  if (!user) return res;

  const blockRows = await db
    .select()
    .from(schema.blocks)
    .where(or(eq(schema.blocks.blockerId, user.id), eq(schema.blocks.blockedId, user.id)));
  const blockedUserIds = new Set(
    blockRows.map((b) => (b.blockerId === user.id ? b.blockedId : b.blockerId))
  );
  const mutedIds = await getMutedIds(user.id);
  const excludedAuthorIds = new Set<string>([...blockedUserIds, ...mutedIds]);

  const followingRows = await db
    .select({ id: schema.follows.followingId })
    .from(schema.follows)
    .where(eq(schema.follows.followerId, user.id));
  const followingIds = new Set(followingRows.map((r) => r.id));

  const connectionRows = await db
    .select()
    .from(schema.connections)
    .where(
      and(
        eq(schema.connections.status, "accepted"),
        or(eq(schema.connections.requesterId, user.id), eq(schema.connections.addresseeId, user.id))
      )
    );
  const connectedIds = new Set(
    connectionRows.map((c) => (c.requesterId === user.id ? c.addresseeId : c.requesterId))
  );

  const visibleAuthorIds = new Set<string>([user.id, ...followingIds, ...connectedIds]);

  const posts = excludedAuthorIds.size
    ? await db
        .select()
        .from(schema.posts)
        .where(
          and(
            inArray(schema.posts.authorId, [...visibleAuthorIds]),
            notInArray(schema.posts.authorId, [...excludedAuthorIds])
          )
        )
    : await db.select().from(schema.posts).where(inArray(schema.posts.authorId, [...visibleAuthorIds]));

  const filtered = posts.filter((p) => {
    if (p.audience === "nobody" && p.authorId !== user.id) return false;
    if (p.audience === "connections" && p.authorId !== user.id && !connectedIds.has(p.authorId)) return false;
    return true;
  });

  const postIds = filtered.map((p) => p.id);
  const reactionCounts = postIds.length
    ? await db
        .select({ targetId: schema.reactions.targetId, count: sql<number>`count(*)::int` })
        .from(schema.reactions)
        .where(and(eq(schema.reactions.targetType, "post"), inArray(schema.reactions.targetId, postIds)))
        .groupBy(schema.reactions.targetId)
    : [];
  const commentCounts = postIds.length
    ? await db
        .select({ postId: schema.comments.postId, count: sql<number>`count(*)::int` })
        .from(schema.comments)
        .where(inArray(schema.comments.postId, postIds))
        .groupBy(schema.comments.postId)
    : [];
  const reactionMap = new Map(reactionCounts.map((r) => [r.targetId, r.count]));
  const commentMap = new Map(commentCounts.map((c) => [c.postId, c.count]));

  const authorIds = [...new Set(filtered.map((p) => p.authorId))];
  const authorProfiles = authorIds.length
    ? await db.select().from(schema.profiles).where(inArray(schema.profiles.userId, authorIds))
    : [];
  const authorUsers = authorIds.length
    ? await db.select().from(schema.users).where(inArray(schema.users.id, authorIds))
    : [];
  const profileByUser = new Map(authorProfiles.map((p) => [p.userId, p]));
  const userById = new Map(authorUsers.map((u) => [u.id, u]));

  const candidates: FeedCandidate[] = filtered.map((p) => ({
    id: p.id,
    authorId: p.authorId,
    createdAt: p.createdAt,
    reactionCount: reactionMap.get(p.id) ?? 0,
    commentCount: commentMap.get(p.id) ?? 0,
    isFollowedAuthor: followingIds.has(p.authorId),
    isConnectedAuthor: connectedIds.has(p.authorId),
  }));

  const ranked = rankFeed(candidates);
  const postById = new Map(filtered.map((p) => [p.id, p]));

  const allMediaIds = filtered.flatMap((p) => (p.mediaJson ? (JSON.parse(p.mediaJson) as string[]) : []));
  const mediaRows = allMediaIds.length
    ? await db.select().from(schema.media).where(inArray(schema.media.id, [...new Set(allMediaIds)]))
    : [];
  const mediaById = new Map(mediaRows.map((m) => [m.id, m]));
  const mediaUrlById = new Map<string, string>();
  await Promise.all(
    [...mediaById.values()].map(async (m) => {
      mediaUrlById.set(m.id, await getMediaUrl(m));
    })
  );

  const items = ranked.map((c) => {
    const p = postById.get(c.id)!;
    const author = userById.get(p.authorId);
    const profile = profileByUser.get(p.authorId);
    const mediaIds: string[] = p.mediaJson ? JSON.parse(p.mediaJson) : [];
    return {
      id: p.id,
      kind: p.kind,
      body: p.body,
      media: mediaIds.map((id) => mediaUrlById.get(id)).filter((u): u is string => !!u),
      createdAt: p.createdAt,
      reactionCount: c.reactionCount,
      commentCount: c.commentCount,
      author: author && { id: author.id, username: author.username, displayName: profile?.displayName, avatarUrl: profile?.avatarUrl },
    };
  });

  return NextResponse.json({ items });
}
