import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, schema } from "@/db";
import { eq, desc } from "drizzle-orm";
import { requireAdmin, logAudit } from "@/lib/require-admin";

export async function GET() {
  const { user, res } = await requireAdmin();
  if (!user) return res;

  const items = await db.select().from(schema.reports).orderBy(desc(schema.reports.createdAt)).limit(100);
  return NextResponse.json({ items });
}

const UpdateSchema = z.object({
  reportId: z.string().uuid(),
  status: z.enum(["reviewed", "actioned", "dismissed"]),
});

export async function PATCH(req: NextRequest) {
  const { user, res } = await requireAdmin();
  if (!user) return res;

  const parsed = UpdateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const [updated] = await db
    .update(schema.reports)
    .set({ status: parsed.data.status })
    .where(eq(schema.reports.id, parsed.data.reportId))
    .returning();

  await logAudit(user.id, "report.status_changed", "report", parsed.data.reportId, { status: parsed.data.status });

  return NextResponse.json({ report: updated });
}
