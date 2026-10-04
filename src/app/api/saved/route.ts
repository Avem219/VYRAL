import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, schema } from "@/db";
import { eq, and, desc } from "drizzle-orm";
import { requireUser } from "@/lib/require-auth";

const Schema = z.object({
  targetType: z.enum(["post", "reel", "profile"]),
  targetId: z.string().uuid(),
  collectionId: z.string().uuid().optional(),
});

export async function POST(req: NextRequest) {
  const { user, res } = await requireUser();
  if (!user) return res;

  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const { targetType, targetId, collectionId } = parsed.data;

  if (collectionId) {
    const [c] = await db.select().from(schema.collections).where(eq(schema.collections.id, collectionId)).limit(1);
    if (!c || c.userId !== user.id) return NextResponse.json({ error: "Collection not found or not yours" }, { status: 403 });
  }

  const existing = await db
    .select()
    .from(schema.saves)
    .where(and(eq(schema.saves.userId, user.id), eq(schema.saves.targetType, targetType), eq(schema.saves.targetId, targetId)))
    .limit(1);

  if (existing.length > 0) {
    await db.delete(schema.saves).where(eq(schema.saves.id, existing[0].id));
    return NextResponse.json({ saved: false });
  }

  await db.insert(schema.saves).values({ userId: user.id, targetType, targetId, collectionId });
  return NextResponse.json({ saved: true });
}

export async function GET() {
  const { user, res } = await requireUser();
  if (!user) return res;

  const items = await db.select().from(schema.saves).where(eq(schema.saves.userId, user.id)).orderBy(desc(schema.saves.createdAt));
  return NextResponse.json({ items });
}
