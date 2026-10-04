import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { and, eq, gte, inArray, notInArray, or, sql } from "drizzle-orm";
import { requireUser } from "@/lib/require-auth";
import { getMutedIds } from "@/lib/mutes";

export async function GET() {
  const { user, res } = await requireUser();
  if (!user) return res;

  const blockRows = await db.select().from(schema.blocks).where(or(eq(schema.blocks.blockerId, user.id), eq(schema.blocks.blockedId, user.id)));
  const blockedIds = blockRows.map((b) => (b.blockerId === user.id ? b.blockedId : b.blockerId));
  const mutedIds = await getMutedIds(user.id);
  const excludedIds = [...new Set([...blockedIds, ...mutedIds])];

  const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

  const recentPosts = excludedIds.length
    ? await db
        .select()
        .from(schema.posts)
        .where(and(eq(schema.posts.audience, "everyone"), gte(schema.posts.createdAt, since), notInArray(schema.posts.authorId, excludedIds)))
    : await db.select().from(schema.posts).where(and(eq(schema.posts.audience, "everyone"), gte(schema.posts.createdAt, since)));

  if (recentPosts.length === 0) return NextResponse.json({ items: [] });

  const postIds = recentPosts.map((p) => p.id);
  const [reactionCounts, commentCounts] = await Promise.all([
    db
      .select({ targetId: schema.reactions.targetId, count: sql<number>`count(*)::int` })
      .from(schema.reactions)
      .where(and(eq(schema.reactions.targetType, "post"), inArray(schema.reactions.targetId, postIds)))
      .groupBy(schema.reactions.targetId),
    db
      .select({ postId: schema.comments.postId, count: sql<number>`count(*)::int` })
      .from(schema.comments)
      .where(inArray(schema.comments.postId, postIds))
      .groupBy(schema.comments.postId),
  ]);
  const reactionMap = new Map(reactionCounts.map((r) => [r.targetId, r.count]));
  const commentMap = new Map(commentCounts.map((c) => [c.postId, c.count]));

  const ranked = recentPosts
    .map((p) => ({ post: p, score: (reactionMap.get(p.id) ?? 0) + (commentMap.get(p.id) ?? 0) * 2 }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  const authorIds = [...new Set(ranked.map((r) => r.post.authorId))];
  const authors = authorIds.length ? await db.select().from(schema.users).where(inArray(schema.users.id, authorIds)) : [];
  const authorById = new Map(authors.map((a) => [a.id, a]));

  return NextResponse.json({
    items: ranked.map(({ post, score }) => ({
      id: post.id,
      body: post.body,
      reactionCount: reactionMap.get(post.id) ?? 0,
      commentCount: commentMap.get(post.id) ?? 0,
      score,
      author: authorById.get(post.authorId) && { username: authorById.get(post.authorId)!.username },
    })),
  });
}
