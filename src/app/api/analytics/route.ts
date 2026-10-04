import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { eq, and, gte, sql, inArray, desc } from "drizzle-orm";
import { requireUser } from "@/lib/require-auth";

function daysAgoIso(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

export async function GET() {
  const { user, res } = await requireUser();
  if (!user) return res;

  const since7 = daysAgoIso(7);
  const since30 = daysAgoIso(30);

  // --- Profile views -----------------------------------------------------
  const [profileViewsTotal] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.profileViews)
    .where(eq(schema.profileViews.profileUserId, user.id));
  const [profileViews7d] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.profileViews)
    .where(and(eq(schema.profileViews.profileUserId, user.id), gte(schema.profileViews.viewedAt, since7)));

  // --- Follower growth -----------------------------------------------------
  const [followersTotal] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.follows)
    .where(eq(schema.follows.followingId, user.id));
  const [followers30d] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.follows)
    .where(and(eq(schema.follows.followingId, user.id), gte(schema.follows.createdAt, since30)));

  // --- Connections ---------------------------------------------------------
  const [connectionsTotal] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.connections)
    .where(
      and(
        eq(schema.connections.status, "accepted"),
        sql`(${schema.connections.requesterId} = ${user.id} OR ${schema.connections.addresseeId} = ${user.id})`
      )
    );

  // --- Per-post performance (own posts only, most recent 20) --------------
  const myPosts = await db.select().from(schema.posts).where(eq(schema.posts.authorId, user.id)).orderBy(desc(schema.posts.createdAt)).limit(20);
  const postIds = myPosts.map((p) => p.id);

  const [viewCounts, reactionCounts, commentCounts, saveCounts] = postIds.length
    ? await Promise.all([
        db
          .select({ targetId: schema.contentViews.targetId, count: sql<number>`count(*)::int` })
          .from(schema.contentViews)
          .where(and(eq(schema.contentViews.targetType, "post"), inArray(schema.contentViews.targetId, postIds)))
          .groupBy(schema.contentViews.targetId),
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
        db
          .select({ targetId: schema.saves.targetId, count: sql<number>`count(*)::int` })
          .from(schema.saves)
          .where(and(eq(schema.saves.targetType, "post"), inArray(schema.saves.targetId, postIds)))
          .groupBy(schema.saves.targetId),
      ])
    : [[], [], [], []];

  const viewMap = new Map(viewCounts.map((r) => [r.targetId, r.count]));
  const reactionMap = new Map(reactionCounts.map((r) => [r.targetId, r.count]));
  const commentMap = new Map(commentCounts.map((r) => [r.postId, r.count]));
  const saveMap = new Map(saveCounts.map((r) => [r.targetId, r.count]));

  const postPerformance = myPosts.map((p) => ({
    id: p.id,
    body: p.body,
    createdAt: p.createdAt,
    views: viewMap.get(p.id) ?? 0,
    reactions: reactionMap.get(p.id) ?? 0,
    comments: commentMap.get(p.id) ?? 0,
    saves: saveMap.get(p.id) ?? 0,
  }));

  // --- Reel performance (own reels, most recent 20) ------------------------
  const myReels = await db.select().from(schema.reels).where(eq(schema.reels.authorId, user.id)).orderBy(desc(schema.reels.createdAt)).limit(20);
  const reelIds = myReels.map((r) => r.id);
  const [reelViewCounts, reelReactionCounts] = reelIds.length
    ? await Promise.all([
        db
          .select({ targetId: schema.contentViews.targetId, count: sql<number>`count(*)::int` })
          .from(schema.contentViews)
          .where(and(eq(schema.contentViews.targetType, "reel"), inArray(schema.contentViews.targetId, reelIds)))
          .groupBy(schema.contentViews.targetId),
        db
          .select({ targetId: schema.reactions.targetId, count: sql<number>`count(*)::int` })
          .from(schema.reactions)
          .where(and(eq(schema.reactions.targetType, "reel"), inArray(schema.reactions.targetId, reelIds)))
          .groupBy(schema.reactions.targetId),
      ])
    : [[], []];
  const reelViewMap = new Map(reelViewCounts.map((r) => [r.targetId, r.count]));
  const reelReactionMap = new Map(reelReactionCounts.map((r) => [r.targetId, r.count]));

  const reelPerformance = myReels.map((r) => ({
    id: r.id,
    caption: r.caption,
    createdAt: r.createdAt,
    views: reelViewMap.get(r.id) ?? 0,
    reactions: reelReactionMap.get(r.id) ?? 0,
  }));

  // --- Story views (aggregate across own stories, last 30 days) -----------
  const myStories = await db
    .select()
    .from(schema.stories)
    .where(and(eq(schema.stories.authorId, user.id), gte(schema.stories.createdAt, since30)));
  const storyIds = myStories.map((s) => s.id);
  const [storyViewCount] = storyIds.length
    ? await db.select({ count: sql<number>`count(*)::int` }).from(schema.storyViews).where(inArray(schema.storyViews.storyId, storyIds))
    : [{ count: 0 }];

  return NextResponse.json({
    profileViews: { total: profileViewsTotal.count, last7Days: profileViews7d.count },
    followers: { total: followersTotal.count, last30Days: followers30d.count },
    connections: { total: connectionsTotal.count },
    posts: postPerformance,
    reels: reelPerformance,
    stories: { countLast30Days: myStories.length, totalViewsLast30Days: storyViewCount.count },
  });
}
