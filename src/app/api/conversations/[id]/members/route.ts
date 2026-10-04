import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/require-auth";
import { addGroupMember, removeGroupMember, MessagingAuthError } from "@/lib/messaging";

const Schema = z.object({ memberId: z.string().uuid() });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, res } = await requireUser();
  if (!user) return res;
  const { id } = await params;

  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  try {
    await addGroupMember(id, user.id, parsed.data.memberId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof MessagingAuthError) return NextResponse.json({ error: e.message }, { status: 403 });
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
    await removeGroupMember(id, user.id, parsed.data.memberId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof MessagingAuthError) return NextResponse.json({ error: e.message }, { status: 403 });
    throw e;
  }
}
