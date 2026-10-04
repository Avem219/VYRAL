import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/require-auth";

const Schema = z.object({
  targetType: z.enum(["post", "comment", "story", "reel", "user", "express"]),
  targetId: z.string().uuid(),
  reason: z.string().min(3).max(500),
});

export async function POST(req: NextRequest) {
  const { user, res } = await requireUser();
  if (!user) return res;

  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const [report] = await db
    .insert(schema.reports)
    .values({ reporterId: user.id, ...parsed.data })
    .returning();

  return NextResponse.json({ report: { id: report.id, status: report.status } });
}
