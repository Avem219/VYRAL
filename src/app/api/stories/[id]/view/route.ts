import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db";
import { eq, and, inArray } from "drizzle-orm";
import { requireUser } from "@/lib/require-auth";
import { isStoryAudienceAuthorized } from "@/lib/stories";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, res } = await requireUser();
  if (!user) return res;
  const { id } = await params;

  const [story] = await db.select().from(schema.stories).where(eq(schema.stories.id, id)).limit(1);
  if (!story || new Date(story.expiresAt) < new Date()) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await isStoryAudienceAuthorized(story, user.id))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const existing = await db
    .select()
    .from(schema.storyViews)
    .where(and(eq(schema.storyViews.storyId, id), eq(schema.storyViews.viewerId, user.id)))
    .limit(1);
  if (existing.length === 0) {
    await db.insert(schema.storyViews).values({ storyId: id, viewerId: user.id });
  }

  return NextResponse.json({ ok: true });
}

/** Author-only: who has viewed this story. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, res } = await requireUser();
  if (!user) return res;
  const { id } = await params;

  const [story] = await db.select().from(schema.stories).where(eq(schema.stories.id, id)).limit(1);
  if (!story) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (story.authorId !== user.id) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const views = await db.select().from(schema.storyViews).where(eq(schema.storyViews.storyId, id));
  const viewerIds = views.map((v) => v.viewerId);
  const viewers = viewerIds.length
    ? await db.select().from(schema.users).where(inArray(schema.users.id, viewerIds))
    : [];

  return NextResponse.json({ count: views.length, viewers: viewers.map((v) => ({ id: v.id, username: v.username })) });
}
