import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, schema } from "@/db";
import { eq, or, and } from "drizzle-orm";
import { requireUser } from "@/lib/require-auth";
import { getActiveStoriesByAuthors, isStoryAudienceAuthorized } from "@/lib/stories";
import { getMediaUrl } from "@/lib/storage";
import { getMutedIds } from "@/lib/mutes";

const CreateSchema = z.object({
  kind: z.enum(["photo", "video", "text"]).default("text"),
  mediaId: z.string().uuid().optional(),
  body: z.string().max(500).optional(),
  audience: z.enum(["everyone", "connections", "circle"]).default("everyone"),
  circleId: z.string().uuid().optional(),
  durationHours: z.number().min(1).max(24).default(24),
  musicTrackId: z.string().uuid().optional(),
});

export async function POST(req: NextRequest) {
  const { user, res } = await requireUser();
  if (!user) return res;

  const parsed = CreateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  const { kind, mediaId, body, audience, circleId, durationHours, musicTrackId } = parsed.data;

  if (kind !== "text" && !mediaId) {
    return NextResponse.json({ error: "Photo/video stories require media" }, { status: 400 });
  }
  if (musicTrackId) {
    const [track] = await db.select().from(schema.tracks).where(eq(schema.tracks.id, musicTrackId)).limit(1);
    if (!track) return NextResponse.json({ error: "Music track not found" }, { status: 400 });
  }
  if (mediaId) {
    const [m] = await db.select().from(schema.media).where(eq(schema.media.id, mediaId)).limit(1);
    if (!m || m.ownerId !== user.id) return NextResponse.json({ error: "Media not found or not yours" }, { status: 403 });
  }
  if (audience === "circle") {
    if (!circleId) return NextResponse.json({ error: "circleId required for circle audience" }, { status: 400 });
    const [circle] = await db.select().from(schema.circles).where(eq(schema.circles.id, circleId)).limit(1);
    if (!circle || circle.ownerId !== user.id) return NextResponse.json({ error: "Circle not found or not yours" }, { status: 403 });
  }

  const expiresAt = new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString();

  const [story] = await db
    .insert(schema.stories)
    .values({ authorId: user.id, kind, mediaId, body, audience, circleId, expiresAt, musicTrackId })
    .returning();

  return NextResponse.json({ story });
}

export async function GET() {
  const { user, res } = await requireUser();
  if (!user) return res;

  const followingRows = await db.select({ id: schema.follows.followingId }).from(schema.follows).where(eq(schema.follows.followerId, user.id));
  const connectionRows = await db
    .select()
    .from(schema.connections)
    .where(and(eq(schema.connections.status, "accepted"), or(eq(schema.connections.requesterId, user.id), eq(schema.connections.addresseeId, user.id))));
  const connectedIds = connectionRows.map((c) => (c.requesterId === user.id ? c.addresseeId : c.requesterId));
  const mutedIds = new Set(await getMutedIds(user.id));
  const authorIds = [...new Set([user.id, ...followingRows.map((r) => r.id), ...connectedIds])].filter(
    (id) => id === user.id || !mutedIds.has(id)
  );

  const active = await getActiveStoriesByAuthors(authorIds);
  const authorized = [];
  for (const s of active) {
    if (await isStoryAudienceAuthorized(s, user.id)) authorized.push(s);
  }

  const authors = await db.select().from(schema.users).where(or(...authorIds.map((id) => eq(schema.users.id, id))));
  const profiles = await db.select().from(schema.profiles).where(or(...authorIds.map((id) => eq(schema.profiles.userId, id))));
  const authorById = new Map(authors.map((a) => [a.id, a]));
  const profileByUser = new Map(profiles.map((p) => [p.userId, p]));

  const items = await Promise.all(
    authorized.map(async (s) => {
      const mediaRow = s.mediaId ? (await db.select().from(schema.media).where(eq(schema.media.id, s.mediaId)).limit(1))[0] : null;
      const author = authorById.get(s.authorId);
      const profile = profileByUser.get(s.authorId);
      return {
        id: s.id,
        kind: s.kind,
        body: s.body,
        mediaUrl: mediaRow ? await getMediaUrl(mediaRow) : null,
        expiresAt: s.expiresAt,
        createdAt: s.createdAt,
        author: author && { id: author.id, username: author.username, displayName: profile?.displayName },
      };
    })
  );

  // Group by author for a standard story-tray shape.
  const grouped = new Map<string, typeof items>();
  for (const item of items) {
    if (!item.author) continue;
    grouped.set(item.author.id, [...(grouped.get(item.author.id) ?? []), item]);
  }

  return NextResponse.json({ trays: [...grouped.entries()].map(([authorId, stories]) => ({ authorId, stories })) });
}
