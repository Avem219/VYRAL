import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, schema } from "@/db";
import { and, eq } from "drizzle-orm";
import { requireUser } from "@/lib/require-auth";

const Schema = z.object({
  targetType: z.enum(["post", "comment", "story", "reel"]),
  targetId: z.string().uuid(),
  kind: z.string().max(20).default("like"),
});

export async function POST(req: NextRequest) {
  const { user, res } = await requireUser();
  if (!user) return res;

  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const { targetType, targetId, kind } = parsed.data;

  const existing = await db
    .select()
    .from(schema.reactions)
    .where(
      and(
        eq(schema.reactions.userId, user.id),
        eq(schema.reactions.targetType, targetType),
        eq(schema.reactions.targetId, targetId),
        eq(schema.reactions.kind, kind)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    await db.delete(schema.reactions).where(eq(schema.reactions.id, existing[0].id));
    return NextResponse.json({ reacted: false });
  }

  await db.insert(schema.reactions).values({ userId: user.id, targetType, targetId, kind });
  return NextResponse.json({ reacted: true });
}
