import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/require-auth";
import { recall, ExpressAuthError } from "@/lib/express";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, res } = await requireUser();
  if (!user) return res;
  const { id } = await params;

  try {
    await recall(id, user.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof ExpressAuthError) return NextResponse.json({ error: "Not found" }, { status: 404 });
    throw e;
  }
}
