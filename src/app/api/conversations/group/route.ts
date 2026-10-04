import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/require-auth";
import { createGroupConversation, MessagingAuthError } from "@/lib/messaging";

const Schema = z.object({
  memberIds: z.array(z.string().uuid()).min(1).max(50),
  title: z.string().min(1).max(100).optional(),
});

export async function POST(req: NextRequest) {
  const { user, res } = await requireUser();
  if (!user) return res;

  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });

  try {
    const conversation = await createGroupConversation(user.id, parsed.data.memberIds, parsed.data.title);
    return NextResponse.json({ conversation });
  } catch (e) {
    if (e instanceof MessagingAuthError) return NextResponse.json({ error: e.message }, { status: 403 });
    throw e;
  }
}
