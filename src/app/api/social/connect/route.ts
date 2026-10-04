import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, schema } from "@/db";
import { and, eq, or } from "drizzle-orm";
import { requireUser } from "@/lib/require-auth";

const RequestSchema = z.object({ action: z.literal("request"), targetUserId: z.string().uuid() });
const RespondSchema = z.object({
  action: z.enum(["accept", "decline", "remove"]),
  connectionId: z.string().uuid(),
});

export async function POST(req: NextRequest) {
  const { user, res } = await requireUser();
  if (!user) return res;

  const body = await req.json().catch(() => null);

  if (body?.action === "request") {
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    const { targetUserId } = parsed.data;
    if (targetUserId === user.id) return NextResponse.json({ error: "Cannot connect to yourself" }, { status: 400 });

    const existing = await db
      .select()
      .from(schema.connections)
      .where(
        or(
          and(eq(schema.connections.requesterId, user.id), eq(schema.connections.addresseeId, targetUserId)),
          and(eq(schema.connections.requesterId, targetUserId), eq(schema.connections.addresseeId, user.id))
        )
      )
      .limit(1);
    if (existing.length > 0) {
      return NextResponse.json({ error: "Connection already exists or pending" }, { status: 409 });
    }

    const [conn] = await db
      .insert(schema.connections)
      .values({ requesterId: user.id, addresseeId: targetUserId, status: "pending" })
      .returning();

    await db.insert(schema.notifications).values({
      userId: targetUserId,
      kind: "connection",
      actorId: user.id,
      targetType: "connection",
      targetId: conn.id,
    });

    return NextResponse.json({ connection: conn });
  }

  const parsed = RespondSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const { action, connectionId } = parsed.data;

  const rows = await db.select().from(schema.connections).where(eq(schema.connections.id, connectionId)).limit(1);
  const conn = rows[0];
  if (!conn || (conn.requesterId !== user.id && conn.addresseeId !== user.id)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  if (action === "accept") {
    if (conn.addresseeId !== user.id) return NextResponse.json({ error: "Only the addressee can accept" }, { status: 403 });
    await db.update(schema.connections).set({ status: "accepted" }).where(eq(schema.connections.id, connectionId));
  } else if (action === "decline") {
    if (conn.addresseeId !== user.id) return NextResponse.json({ error: "Only the addressee can decline" }, { status: 403 });
    await db.update(schema.connections).set({ status: "declined" }).where(eq(schema.connections.id, connectionId));
  } else {
    await db.delete(schema.connections).where(eq(schema.connections.id, connectionId));
  }

  return NextResponse.json({ ok: true });
}
