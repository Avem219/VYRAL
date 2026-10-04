import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/require-auth";
import { addMessageReaction, removeMessageReaction, MessagingAuthError } from "@/lib/messaging";

const Schema = z.object({ emoji: z.string().min(1).max(8) });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, res } = await requireUser();
  if (!user) return res;
  const { id } = await params;

  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  try {
    await addMessageReaction(id, user.id, parsed.data.emoji);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof MessagingAuthError) return NextResponse.json({ error: "Not found" }, { status: 404 });
    throw e;
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, res } = await requireUser();
  if (!user) return res;
  const { id } = await params;

  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  try {
    await removeMessageReaction(id, user.id, parsed.data.emoji);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof MessagingAuthError) return NextResponse.json({ error: "Not found" }, { status: 404 });
    throw e;
  }
}
