import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { inArray, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/require-auth";

const PostSchema = z.object({
  kind: z.enum(["text", "photo", "video", "carousel", "music", "project", "poll"]).default("text"),
  body: z.string().max(3000).optional(),
  mediaIds: z.array(z.string().uuid()).max(10).optional(),
  musicTrackId: z.string().uuid().optional(),
  audience: z.enum(["everyone", "connections", "nobody"]).default("everyone"),
});

export async function POST(req: NextRequest) {
  const { user, res } = await requireUser();
  if (!user) return res;

  const parsed = PostSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const { kind, body, mediaIds, musicTrackId, audience } = parsed.data;
  if (!body && (!mediaIds || mediaIds.length === 0)) {
    return NextResponse.json({ error: "Post needs text or media" }, { status: 400 });
  }

  if (musicTrackId) {
    const [track] = await db.select().from(schema.tracks).where(eq(schema.tracks.id, musicTrackId)).limit(1);
    if (!track) return NextResponse.json({ error: "Music track not found" }, { status: 400 });
  }
  if (mediaIds && mediaIds.length > 0) {
    const owned = await db.select().from(schema.media).where(inArray(schema.media.id, mediaIds));
    const ownedIds = new Set(owned.filter((m) => m.ownerId === user.id).map((m) => m.id));
    if (ownedIds.size !== mediaIds.length) {
      return NextResponse.json({ error: "One or more media items were not found or aren't yours" }, { status: 403 });
    }
  }

  const [post] = await db
    .insert(schema.posts)
    .values({
      authorId: user.id,
      kind,
      body,
      mediaJson: mediaIds ? JSON.stringify(mediaIds) : null,
      musicTrackId,
      audience,
    })
    .returning();

  return NextResponse.json({ post });
}
