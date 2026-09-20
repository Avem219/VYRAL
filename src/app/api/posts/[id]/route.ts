import { NextRequest, NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/require-auth";
import { getStorageProvider } from "@/lib/storage";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, res } = await requireUser();
  if (!user) return res;
  const { id } = await params;
  const [post] = await db.select().from(schema.posts).where(eq(schema.posts.id, id)).limit(1);
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (post.authorId !== user.id) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const parsed = post.mediaJson ? JSON.parse(post.mediaJson) as unknown : [];
  const mediaIds = Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  const mediaRows = mediaIds.length ? await db.select().from(schema.media).where(inArray(schema.media.id, mediaIds)) : [];
  await db.delete(schema.reactions).where(and(eq(schema.reactions.targetType, "post"), eq(schema.reactions.targetId, id)));
  await db.delete(schema.saves).where(and(eq(schema.saves.targetType, "post"), eq(schema.saves.targetId, id)));
  await db.delete(schema.contentViews).where(and(eq(schema.contentViews.targetType, "post"), eq(schema.contentViews.targetId, id)));
  await db.delete(schema.posts).where(eq(schema.posts.id, id));
  const storage = getStorageProvider();
  for (const media of mediaRows) {
    try { await storage.delete(media.storageKey); } catch { /* best-effort object cleanup */ }
    await db.delete(schema.media).where(eq(schema.media.id, media.id));
  }
  return NextResponse.json({ ok: true });
}
