import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, schema } from "@/db";
import { inArray } from "drizzle-orm";
import { requireUser } from "@/lib/require-auth";
import { getMessages, sendMessage, MessagingAuthError } from "@/lib/messaging";
import { getMediaUrl } from "@/lib/storage";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, res } = await requireUser();
  if (!user) return res;
  const { id } = await params;

  const before = req.nextUrl.searchParams.get("before") ?? undefined;

  try {
    const items = await getMessages(id, user.id, { before });

    // Resolve attached media to URLs. Safe to do unconditionally here: only
    // conversation members ever reach this point (getMessages already
    // enforced membership above), so anyone seeing these rows is already
    // authorized to see the attachments too.
    const mediaIds = items.map((m) => m.mediaId).filter((x): x is string => !!x);
    const mediaRows = mediaIds.length ? await db.select().from(schema.media).where(inArray(schema.media.id, mediaIds)) : [];
    const mediaById = new Map(mediaRows.map((m) => [m.id, m]));
    const withUrls = await Promise.all(
      items.map(async (m) => ({
        ...m,
        mediaUrl: m.mediaId && mediaById.has(m.mediaId) ? await getMediaUrl(mediaById.get(m.mediaId)!) : null,
      }))
    );

    return NextResponse.json({ items: withUrls });
  } catch (e) {
    if (e instanceof MessagingAuthError) return NextResponse.json({ error: "Not found" }, { status: 404 });
    throw e;
  }
}

const SendSchema = z.object({
  kind: z.enum(["text", "image", "video", "audio", "shared_post", "shared_reel", "shared_profile"]).default("text"),
  body: z.string().max(3000).optional(),
  mediaId: z.string().uuid().optional(),
  sharedTargetType: z.string().optional(),
  sharedTargetId: z.string().uuid().optional(),
  replyToId: z.string().uuid().optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, res } = await requireUser();
  if (!user) return res;
  const { id } = await params;

  const parsed = SendSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });

  try {
    const message = await sendMessage({ conversationId: id, senderId: user.id, ...parsed.data });
    return NextResponse.json({ message });
  } catch (e) {
    if (e instanceof MessagingAuthError) return NextResponse.json({ error: e.message }, { status: e.message.includes("owned") ? 403 : 404 });
    throw e;
  }
}
