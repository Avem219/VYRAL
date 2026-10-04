import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, schema } from "@/db";
import { inArray } from "drizzle-orm";
import { requireUser } from "@/lib/require-auth";
import { getOrCreateDirectConversation, listConversationsFor, MessagingAuthError } from "@/lib/messaging";

const CreateSchema = z.object({ targetUserId: z.string().uuid() });

export async function POST(req: NextRequest) {
  const { user, res } = await requireUser();
  if (!user) return res;

  const parsed = CreateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  try {
    const conversation = await getOrCreateDirectConversation(user.id, parsed.data.targetUserId);
    return NextResponse.json({ conversation });
  } catch (e) {
    if (e instanceof MessagingAuthError) return NextResponse.json({ error: e.message }, { status: 403 });
    throw e;
  }
}

export async function GET() {
  const { user, res } = await requireUser();
  if (!user) return res;

  const conversations = await listConversationsFor(user.id);

  const otherUserIds = [...new Set(conversations.flatMap((c) => c.memberIds.filter((id) => id !== user.id)))];
  const users = otherUserIds.length ? await db.select().from(schema.users).where(inArray(schema.users.id, otherUserIds)) : [];
  const profiles = otherUserIds.length ? await db.select().from(schema.profiles).where(inArray(schema.profiles.userId, otherUserIds)) : [];
  const userById = new Map(users.map((u) => [u.id, u]));
  const profileByUser = new Map(profiles.map((p) => [p.userId, p]));

  const items = conversations.map((c) => {
    const otherId = c.memberIds.find((id) => id !== user.id);
    const other = otherId ? userById.get(otherId) : null;
    const otherProfile = otherId ? profileByUser.get(otherId) : null;
    return {
      id: c.conversation.id,
      isGroup: c.conversation.isGroup,
      isRequest: c.isRequest,
      lastMessage: c.lastMessage,
      unread: c.lastMessage ? (!c.lastReadAt || c.lastMessage.createdAt > c.lastReadAt) && c.lastMessage.senderId !== user.id : false,
      otherUser: !c.conversation.isGroup && other ? { id: other.id, username: other.username, displayName: otherProfile?.displayName } : null,
    };
  });

  return NextResponse.json({ items });
}
