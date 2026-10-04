import { NextResponse } from "next/server";
import { requireUser } from "@/lib/require-auth";
import { markRead, MessagingAuthError } from "@/lib/messaging";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, res } = await requireUser();
  if (!user) return res;
  const { id } = await params;

  try {
    await markRead(id, user.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof MessagingAuthError) return NextResponse.json({ error: "Not found" }, { status: 404 });
    throw e;
  }
}
