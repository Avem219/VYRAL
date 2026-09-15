import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, schema } from "@/db";
import { eq, and } from "drizzle-orm";
import { requireUser } from "@/lib/require-auth";

const ActionSchema = z.object({ action: z.enum(["view", "like", "unlike"]) });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, res } = await requireUser();
  if (!user) return res;
  const { id } = await params;

  const [reel] = await db.select().from(schema.reels).where(eq(schema.reels.id, id)).limit(1);
  if (!reel) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = ActionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  if (parsed.data.action === "view") {
    await db.insert(schema.contentViews).values({ targetType: "reel", targetId: id, viewerId: user.id });
  } else if (parsed.data.action === "like") {
    await db
      .insert(schema.reactions)
      .values({ userId: user.id, targetType: "reel", targetId: id, kind: "like" })
      .onConflictDoNothing();
  } else {
    await db
      .delete(schema.reactions)
      .where(and(eq(schema.reactions.userId, user.id), eq(schema.reactions.targetType, "reel"), eq(schema.reactions.targetId, id), eq(schema.reactions.kind, "like")));
  }

  return NextResponse.json({ ok: true });
}
