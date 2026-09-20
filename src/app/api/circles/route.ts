import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/require-auth";

const CreateSchema = z.object({ name: z.string().min(1).max(60) });

export async function POST(req: NextRequest) {
  const { user, res } = await requireUser();
  if (!user) return res;

  const parsed = CreateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const [circle] = await db.insert(schema.circles).values({ ownerId: user.id, name: parsed.data.name }).returning();
  await db.insert(schema.circleMembers).values({ circleId: circle.id, memberId: user.id });

  return NextResponse.json({ circle });
}

/** Only the owner's own circles — membership and circle existence are private. */
export async function GET() {
  const { user, res } = await requireUser();
  if (!user) return res;

  const items = await db.select().from(schema.circles).where(eq(schema.circles.ownerId, user.id));
  return NextResponse.json({ items });
}
