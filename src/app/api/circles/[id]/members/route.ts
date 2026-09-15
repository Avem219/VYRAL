import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, schema } from "@/db";
import { eq, and, inArray } from "drizzle-orm";
import { requireUser } from "@/lib/require-auth";

const Schema = z.object({ memberId: z.string().uuid() });

async function assertOwner(circleId: string, userId: string) {
  const [circle] = await db.select().from(schema.circles).where(eq(schema.circles.id, circleId)).limit(1);
  if (!circle || circle.ownerId !== userId) return null;
  return circle;
}

/** Owner-only: circle membership is never visible to anyone else, including the members themselves. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, res } = await requireUser();
  if (!user) return res;
  const { id } = await params;

  const circle = await assertOwner(id, user.id);
  if (!circle) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const memberRows = await db.select().from(schema.circleMembers).where(eq(schema.circleMembers.circleId, id));
  const memberIds = memberRows.map((m) => m.memberId).filter((mid) => mid !== user.id);
  const users = memberIds.length ? await db.select().from(schema.users).where(inArray(schema.users.id, memberIds)) : [];

  return NextResponse.json({ members: users.map((u) => ({ id: u.id, username: u.username })) });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, res } = await requireUser();
  if (!user) return res;
  const { id } = await params;

  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const circle = await assertOwner(id, user.id);
  if (!circle) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.insert(schema.circleMembers).values({ circleId: id, memberId: parsed.data.memberId }).onConflictDoNothing();
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, res } = await requireUser();
  if (!user) return res;
  const { id } = await params;

  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const circle = await assertOwner(id, user.id);
  if (!circle) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db
    .delete(schema.circleMembers)
    .where(and(eq(schema.circleMembers.circleId, id), eq(schema.circleMembers.memberId, parsed.data.memberId)));
  return NextResponse.json({ ok: true });
}
