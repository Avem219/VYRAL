import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { eq, desc, inArray } from "drizzle-orm";
import { requireUser } from "@/lib/require-auth";

export async function GET() {
  const { user, res } = await requireUser();
  if (!user) return res;

  const rows = await db
    .select()
    .from(schema.notifications)
    .where(eq(schema.notifications.userId, user.id))
    .orderBy(desc(schema.notifications.createdAt))
    .limit(50);

  const actorIds = [...new Set(rows.map((r) => r.actorId).filter((x): x is string => !!x))];
  const actors = actorIds.length ? await db.select().from(schema.users).where(inArray(schema.users.id, actorIds)) : [];
  const actorById = new Map(actors.map((a) => [a.id, a]));

  const items = rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    // For 'express', we intentionally surface only that *something* arrived —
    // no target/content — matching the "no preview leakage" requirement.
    targetType: r.kind === "express" ? null : r.targetType,
    targetId: r.kind === "express" ? null : r.targetId,
    actor: r.actorId ? { id: r.actorId, username: actorById.get(r.actorId)?.username } : null,
    readAt: r.readAt,
    createdAt: r.createdAt,
  }));

  return NextResponse.json({ items });
}

export async function PATCH() {
  const { user, res } = await requireUser();
  if (!user) return res;

  await db
    .update(schema.notifications)
    .set({ readAt: new Date().toISOString() })
    .where(eq(schema.notifications.userId, user.id));

  return NextResponse.json({ ok: true });
}
