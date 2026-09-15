import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/require-auth";

async function assertOwner(circleId: string, userId: string) {
  const [circle] = await db.select().from(schema.circles).where(eq(schema.circles.id, circleId)).limit(1);
  if (!circle || circle.ownerId !== userId) return null;
  return circle;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, res } = await requireUser();
  if (!user) return res;
  const { id } = await params;

  const parsed = z.object({ name: z.string().min(1).max(60) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const circle = await assertOwner(id, user.id);
  if (!circle) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [updated] = await db.update(schema.circles).set({ name: parsed.data.name }).where(eq(schema.circles.id, id)).returning();
  return NextResponse.json({ circle: updated });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, res } = await requireUser();
  if (!user) return res;
  const { id } = await params;

  const circle = await assertOwner(id, user.id);
  if (!circle) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.delete(schema.circles).where(eq(schema.circles.id, id));
  return NextResponse.json({ ok: true });
}
