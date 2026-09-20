import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/require-auth";
import { sendExpress, listInbox, listSent, ExpressAuthError } from "@/lib/express";
import { getMediaUrl } from "@/lib/storage";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";

const SendSchema = z.object({
  recipientId: z.string().uuid(),
  kind: z.enum(["text", "image", "video", "audio", "music", "link"]).default("text"),
  body: z.string().max(3000).optional(),
  mediaId: z.string().uuid().optional(),
  allowReply: z.boolean().optional(),
  allowForward: z.boolean().optional(),
  expiration: z.enum(["24h", "7d", "30d", "never"]).optional(),
  musicTrackId: z.string().uuid().optional(),
});

export async function POST(req: NextRequest) {
  const { user, res } = await requireUser();
  if (!user) return res;

  const parsed = SendSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });

  if (parsed.data.musicTrackId) {
    const [track] = await db.select().from(schema.tracks).where(eq(schema.tracks.id, parsed.data.musicTrackId)).limit(1);
    if (!track) return NextResponse.json({ error: "Music track not found" }, { status: 400 });
  }

  try {
    const msg = await sendExpress({ senderId: user.id, ...parsed.data });
    return NextResponse.json({ express: msg });
  } catch (e) {
    if (e instanceof ExpressAuthError) return NextResponse.json({ error: e.message }, { status: 403 });
    throw e;
  }
}

export async function GET(req: NextRequest) {
  const { user, res } = await requireUser();
  if (!user) return res;

  const folder = req.nextUrl.searchParams.get("folder") ?? "inbox";
  const items = folder === "sent" ? await listSent(user.id) : await listInbox(user.id);

  const withUrls = await Promise.all(
    items.map(async (item) => {
      if (!item.mediaId) return { ...item, mediaUrl: null };
      const [row] = await db.select().from(schema.media).where(eq(schema.media.id, item.mediaId)).limit(1);
      return { ...item, mediaUrl: row ? await getMediaUrl(row) : null };
    })
  );

  return NextResponse.json({ items: withUrls });
}
