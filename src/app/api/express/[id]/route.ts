import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/require-auth";
import { getExpressForViewer, markOpened, deleteForViewer, ExpressAuthError } from "@/lib/express";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, res } = await requireUser();
  if (!user) return res;
  const { id } = await params;

  try {
    const msg = await getExpressForViewer(id, user.id);
    if (!msg) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (msg.recipientId === user.id) await markOpened(id, user.id);
    return NextResponse.json({ express: msg });
  } catch (e) {
    if (e instanceof ExpressAuthError) return NextResponse.json({ error: "Not found" }, { status: 404 });
    throw e;
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, res } = await requireUser();
  if (!user) return res;
  const { id } = await params;

  try {
    await deleteForViewer(id, user.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof ExpressAuthError) return NextResponse.json({ error: "Not found" }, { status: 404 });
    throw e;
  }
}
