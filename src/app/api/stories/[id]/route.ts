import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/require-auth";
import { isStoryAudienceAuthorized } from "@/lib/stories";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, res } = await requireUser();
  if (!user) return res;
  const { id } = await params;

  const [story] = await db.select().from(schema.stories).where(eq(schema.stories.id, id)).limit(1);
  if (!story) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (story.authorId !== user.id) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  await db.delete(schema.stories).where(eq(schema.stories.id, id));
  return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, res } = await requireUser();
  if (!user) return res;
  const { id } = await params;

  const [story] = await db.select().from(schema.stories).where(eq(schema.stories.id, id)).limit(1);
  if (!story || new Date(story.expiresAt) < new Date()) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await isStoryAudienceAuthorized(story, user.id))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ story });
}
