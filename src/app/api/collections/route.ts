import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/require-auth";

const CreateSchema = z.object({ name: z.string().min(1).max(60), isPrivate: z.boolean().default(true) });

export async function POST(req: NextRequest) {
  const { user, res } = await requireUser();
  if (!user) return res;

  const parsed = CreateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const [collection] = await db
    .insert(schema.collections)
    .values({ userId: user.id, name: parsed.data.name, isPrivate: parsed.data.isPrivate })
    .returning();

  return NextResponse.json({ collection });
}

export async function GET() {
  const { user, res } = await requireUser();
  if (!user) return res;

  const items = await db.select().from(schema.collections).where(eq(schema.collections.userId, user.id));
  return NextResponse.json({ items });
}
