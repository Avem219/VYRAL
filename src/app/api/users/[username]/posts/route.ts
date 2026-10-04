import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db";
import { eq, desc, inArray } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { canViewPost } from "@/lib/posts";
import { getMediaUrl } from "@/lib/storage";

export async function GET(req: NextRequest, { params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const viewer = await getCurrentUser();

  const [targetUser] = await db.select().from(schema.users).where(eq(schema.users.username, username.toLowerCase())).limit(1);
  if (!targetUser) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const allPosts = await db
    .select()
    .from(schema.posts)
    .where(eq(schema.posts.authorId, targetUser.id))
    .orderBy(desc(schema.posts.createdAt))
    .limit(60);

  const visible: typeof allPosts = [];
  for (const post of allPosts) {
    if (!viewer) {
      if (post.audience === "everyone") visible.push(post);
      continue;
    }
    if (await canViewPost(post, viewer.id)) visible.push(post);
  }

  const mediaIds = visible.flatMap((p) => (p.mediaJson ? (JSON.parse(p.mediaJson) as string[]) : []));
  const mediaRows = mediaIds.length ? await db.select().from(schema.media).where(inArray(schema.media.id, [...new Set(mediaIds)])) : [];
  const mediaUrlById = new Map<string, string>();
  await Promise.all(mediaRows.map(async (m) => mediaUrlById.set(m.id, await getMediaUrl(m))));

  const items = visible.map((p) => {
    const ids: string[] = p.mediaJson ? JSON.parse(p.mediaJson) : [];
    return {
      id: p.id,
      kind: p.kind,
      body: p.body,
      media: ids.map((id) => mediaUrlById.get(id)).filter((u): u is string => !!u),
      createdAt: p.createdAt,
    };
  });

  return NextResponse.json({ items });
}
