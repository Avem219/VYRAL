import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { requireAdmin, logAudit } from "@/lib/require-admin";
import { disconnectUser } from "@/lib/realtime";

const Schema = z.object({ suspend: z.boolean() });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, res } = await requireAdmin();
  if (!user) return res;
  const { id } = await params;

  // Only a full admin (not a moderator) can lift/impose suspensions.
  if (user.role !== "admin") return NextResponse.json({ error: "Admin role required" }, { status: 403 });

  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const [target] = await db.select().from(schema.users).where(eq(schema.users.id, id)).limit(1);
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db
    .update(schema.users)
    .set({ suspendedAt: parsed.data.suspend ? new Date().toISOString() : null })
    .where(eq(schema.users.id, id));

  await logAudit(user.id, parsed.data.suspend ? "user.suspended" : "user.unsuspended", "user", id);

  if (parsed.data.suspend) {
    await disconnectUser(id);
  }

  return NextResponse.json({ ok: true });
}
