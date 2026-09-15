import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, schema } from "@/db";
import { and, eq } from "drizzle-orm";
import { requireUser } from "@/lib/require-auth";

const Schema = z.object({ targetUserId: z.string().uuid() });

export async function POST(req: NextRequest) {
  const { user, res } = await requireUser();
  if (!user) return res;

  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const { targetUserId } = parsed.data;
  if (targetUserId === user.id) return NextResponse.json({ error: "Cannot mute yourself" }, { status: 400 });

  const existing = await db
    .select()
    .from(schema.mutes)
    .where(and(eq(schema.mutes.muterId, user.id), eq(schema.mutes.mutedId, targetUserId)))
    .limit(1);

  if (existing.length > 0) {
    await db.delete(schema.mutes).where(eq(schema.mutes.id, existing[0].id));
    return NextResponse.json({ muted: false });
  }

  await db.insert(schema.mutes).values({ muterId: user.id, mutedId: targetUserId });
  return NextResponse.json({ muted: true });
}

/** My own mute list — never exposed to anyone else; being muted is not observable by the muted user. */
export async function GET() {
  const { user, res } = await requireUser();
  if (!user) return res;

  const items = await db.select().from(schema.mutes).where(eq(schema.mutes.muterId, user.id));
  return NextResponse.json({ mutedUserIds: items.map((m) => m.mutedId) });
}
