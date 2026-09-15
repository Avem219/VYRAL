import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/require-auth";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, res } = await requireUser();
  if (!user) return res;
  const { id } = await params;

  const [comment] = await db.select().from(schema.comments).where(eq(schema.comments.id, id)).limit(1);
  if (!comment) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (comment.authorId !== user.id) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  await db.delete(schema.comments).where(eq(schema.comments.id, id));
  return NextResponse.json({ ok: true });
}
