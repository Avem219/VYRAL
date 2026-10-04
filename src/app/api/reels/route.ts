import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, schema } from "@/db";
import { eq, and, or, inArray, notInArray, sql, desc } from "drizzle-orm";
import { requireUser } from "@/lib/require-auth";
import { getMediaUrl } from "@/lib/storage";
import { getMutedIds } from "@/lib/mutes";

const CreateSchema = z.object({
  mediaId: z.string().uuid(),
  thumbnailMediaId: z.string().uuid().optional(),
  caption: z.string().max(500).optional(),
  musicTrackId: z.string().uuid().optional(),
  audience: z.enum(["everyone", "connections"]).default("everyone"),
});

export async function POST(req: NextRequest) {
  const { user, res } = await requireUser();
  if (!user) return res;

  const parsed = CreateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  const { mediaId, thumbnailMediaId, caption, musicTrackId, audience } = parsed.data;

  const [videoMedia] = await db.select().from(schema.media).where(eq(schema.media.id, mediaId)).limit(1);
  if (!videoMedia || videoMedia.ownerId !== user.id || videoMedia.kind !== "video") {
    return NextResponse.json({ error: "Video media not found, not yours, or not a video" }, { status: 403 });
  }
  if (thumbnailMediaId) {
    const [thumb] = await db.select().from(schema.media).where(eq(schema.media.id, thumbnailMediaId)).limit(1);
    if (!thumb || thumb.ownerId !== user.id) {
      return NextResponse.json({ error: "Thumbnail media not found or not yours" }, { status: 403 });
    }
  }

  const [reel] = await db
    .insert(schema.reels)
    .values({ authorId: user.id, mediaId, thumbnailMediaId, caption, musicTrackId, audience })
    .returning();

  return NextResponse.json({ reel });
}

export async function GET() {
  const { user, res } = await requireUser();
  if (!user) return res;

  const blockRows = await db
    .select()
    .from(schema.blocks)
    .where(or(eq(schema.blocks.blockerId, user.id), eq(schema.blocks.blockedId, user.id)));
  const blockedIds = blockRows.map((b) => (b.blockerId === user.id ? b.blockedId : b.blockerId));
  const mutedIds = await getMutedIds(user.id);
  const excludedIds = [...new Set([...blockedIds, ...mutedIds])];

  const connectionRows = await db
    .select()
    .from(schema.connections)
    .where(and(eq(schema.connections.status, "accepted"), or(eq(schema.connections.requesterId, user.id), eq(schema.connections.addresseeId, user.id))));
  const connectedIds = new Set(connectionRows.map((c) => (c.requesterId === user.id ? c.addresseeId : c.requesterId)));

  const reels = excludedIds.length
    ? await db.select().from(schema.reels).where(notInArray(schema.reels.authorId, excludedIds)).orderBy(desc(schema.reels.createdAt)).limit(30)
    : await db.select().from(schema.reels).orderBy(desc(schema.reels.createdAt)).limit(30);

  const visible = reels.filter((r) => r.authorId === user.id || r.audience === "everyone" || connectedIds.has(r.authorId));

  const authorIds = [...new Set(visible.map((r) => r.authorId))];
  const authors = authorIds.length ? await db.select().from(schema.users).where(inArray(schema.users.id, authorIds)) : [];
  const profiles = authorIds.length ? await db.select().from(schema.profiles).where(inArray(schema.profiles.userId, authorIds)) : [];
  const authorById = new Map(authors.map((a) => [a.id, a]));
  const profileByUser = new Map(profiles.map((p) => [p.userId, p]));

  const reelIds = visible.map((r) => r.id);
  const [reactionCounts, commentCounts, saveCounts, myLikes, mySaves] = reelIds.length
    ? await Promise.all([
        db
          .select({ targetId: schema.reactions.targetId, count: sql<number>`count(*)::int` })
          .from(schema.reactions)
          .where(and(eq(schema.reactions.targetType, "reel"), inArray(schema.reactions.targetId, reelIds)))
          .groupBy(schema.reactions.targetId),
        db
          .select({ reelId: schema.comments.reelId, count: sql<number>`count(*)::int` })
          .from(schema.comments)
          .where(inArray(schema.comments.reelId, reelIds))
          .groupBy(schema.comments.reelId),
        db
          .select({ targetId: schema.saves.targetId, count: sql<number>`count(*)::int` })
          .from(schema.saves)
          .where(and(eq(schema.saves.targetType, "reel"), inArray(schema.saves.targetId, reelIds)))
          .groupBy(schema.saves.targetId),
        db
          .select({ targetId: schema.reactions.targetId })
          .from(schema.reactions)
          .where(and(eq(schema.reactions.userId, user.id), eq(schema.reactions.targetType, "reel"), inArray(schema.reactions.targetId, reelIds))),
        db
          .select({ targetId: schema.saves.targetId })
          .from(schema.saves)
          .where(and(eq(schema.saves.userId, user.id), eq(schema.saves.targetType, "reel"), inArray(schema.saves.targetId, reelIds))),
      ])
    : [[], [], [], [], []];

  const reactionMap = new Map(reactionCounts.map((r) => [r.targetId, r.count]));
  const commentMap = new Map(commentCounts.map((r) => [r.reelId, r.count]));
  const saveMap = new Map(saveCounts.map((r) => [r.targetId, r.count]));
  const likedSet = new Set(myLikes.map((r) => r.targetId));
  const savedSet = new Set(mySaves.map((r) => r.targetId));

  const trackIds = [...new Set(visible.map((r) => r.musicTrackId).filter((id): id is string => !!id))];
  const tracks = trackIds.length ? await db.select().from(schema.tracks).where(inArray(schema.tracks.id, trackIds)) : [];
  const trackById = new Map(tracks.map((t) => [t.id, t]));

  const items = await Promise.all(
    visible.map(async (r) => {
      const [videoMedia] = await db.select().from(schema.media).where(eq(schema.media.id, r.mediaId)).limit(1);
      const thumbMedia = r.thumbnailMediaId ? (await db.select().from(schema.media).where(eq(schema.media.id, r.thumbnailMediaId)).limit(1))[0] : null;
      const author = authorById.get(r.authorId);
      const profile = profileByUser.get(r.authorId);
      return {
        id: r.id,
        videoUrl: videoMedia ? await getMediaUrl(videoMedia) : null,
        thumbnailUrl: thumbMedia ? await getMediaUrl(thumbMedia) : null,
        caption: r.caption,
        createdAt: r.createdAt,
        music: r.musicTrackId ? trackById.get(r.musicTrackId) ? {
          id: trackById.get(r.musicTrackId)!.id,
          title: trackById.get(r.musicTrackId)!.title,
          artist: trackById.get(r.musicTrackId)!.artist,
          provider: trackById.get(r.musicTrackId)!.provider,
          externalUrl: trackById.get(r.musicTrackId)!.externalUrl,
        } : null : null,
        reactionCount: reactionMap.get(r.id) ?? 0,
        commentCount: commentMap.get(r.id) ?? 0,
        saveCount: saveMap.get(r.id) ?? 0,
        likedByMe: likedSet.has(r.id),
        savedByMe: savedSet.has(r.id),
        author: author && {
          id: author.id,
          username: author.username,
          displayName: profile?.displayName,
          accentColor: profile?.accentColor,
        },
      };
    })
  );

  return NextResponse.json({ items });
}
