import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, schema } from "@/db";
import { and, eq } from "drizzle-orm";
import { requireUser } from "@/lib/require-auth";
import { isMutedBy } from "@/lib/mutes";

const Schema = z.object({ targetUserId: z.string().uuid() });

export async function POST(req: NextRequest) {
  const { user, res } = await requireUser();
  if (!user) return res;

  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const { targetUserId } = parsed.data;
  if (targetUserId === user.id) return NextResponse.json({ error: "Cannot follow yourself" }, { status: 400 });

  const existing = await db
    .select()
    .from(schema.follows)
    .where(and(eq(schema.follows.followerId, user.id), eq(schema.follows.followingId, targetUserId)))
    .limit(1);

  if (existing.length > 0) {
    await db.delete(schema.follows).where(eq(schema.follows.id, existing[0].id));
    return NextResponse.json({ following: false });
  }

  await db.insert(schema.follows).values({ followerId: user.id, followingId: targetUserId });
  if (!(await isMutedBy(targetUserId, user.id))) {
    await db.insert(schema.notifications).values({
      userId: targetUserId,
      kind: "follow",
      actorId: user.id,
    });
  }
  return NextResponse.json({ following: true });
}
