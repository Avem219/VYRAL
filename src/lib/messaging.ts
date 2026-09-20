import { db, schema } from "@/db";
import { and, eq, inArray, or, desc, lt } from "drizzle-orm";
import { emitToConversation, emitToUser } from "@/lib/realtime";

export class MessagingAuthError extends Error {}

/** Throws unless userId is a member of conversationId. Every read/write below calls this first. */
export async function assertMember(conversationId: string, userId: string) {
  const rows = await db
    .select()
    .from(schema.conversationMembers)
    .where(and(eq(schema.conversationMembers.conversationId, conversationId), eq(schema.conversationMembers.userId, userId)))
    .limit(1);
  if (rows.length === 0) throw new MessagingAuthError("Not a member of this conversation");
}

async function areBlocked(a: string, b: string) {
  const rows = await db
    .select()
    .from(schema.blocks)
    .where(or(and(eq(schema.blocks.blockerId, a), eq(schema.blocks.blockedId, b)), and(eq(schema.blocks.blockerId, b), eq(schema.blocks.blockedId, a))))
    .limit(1);
  return rows.length > 0;
}

/** Finds or creates a direct (1:1) conversation between two users. */
export async function getOrCreateDirectConversation(userA: string, userB: string) {
  if (userA === userB) throw new MessagingAuthError("Cannot message yourself");
  if (await areBlocked(userA, userB)) throw new MessagingAuthError("Not permitted");

  const aMemberships = await db.select({ conversationId: schema.conversationMembers.conversationId }).from(schema.conversationMembers).where(eq(schema.conversationMembers.userId, userA));
  const bMemberships = await db.select({ conversationId: schema.conversationMembers.conversationId }).from(schema.conversationMembers).where(eq(schema.conversationMembers.userId, userB));
  const bSet = new Set(bMemberships.map((m) => m.conversationId));
  const sharedIds = aMemberships.map((m) => m.conversationId).filter((id) => bSet.has(id));

  if (sharedIds.length > 0) {
    const candidates = await db.select().from(schema.conversations).where(and(inArray(schema.conversations.id, sharedIds), eq(schema.conversations.isGroup, false)));
    if (candidates.length > 0) return candidates[0];
  }

  const [conversation] = await db.insert(schema.conversations).values({ isGroup: false }).returning();
  await db.insert(schema.conversationMembers).values([
    { conversationId: conversation.id, userId: userA },
    { conversationId: conversation.id, userId: userB },
  ]);
  return conversation;
}

export async function listConversationsFor(userId: string) {
  const memberships = await db.select().from(schema.conversationMembers).where(eq(schema.conversationMembers.userId, userId));
  const conversationIds = memberships.map((m) => m.conversationId);
  if (conversationIds.length === 0) return [];

  const conversations = await db.select().from(schema.conversations).where(inArray(schema.conversations.id, conversationIds));
  const allMembers = await db.select().from(schema.conversationMembers).where(inArray(schema.conversationMembers.conversationId, conversationIds));

  const results = [];
  for (const c of conversations) {
    const members = allMembers.filter((m) => m.conversationId === c.id);
    const myMembership = members.find((m) => m.userId === userId)!;
    const [lastMessage] = await db
      .select()
      .from(schema.messages)
      .where(eq(schema.messages.conversationId, c.id))
      .orderBy(desc(schema.messages.createdAt))
      .limit(1);
    results.push({
      conversation: c,
      memberIds: members.map((m) => m.userId),
      lastMessage: lastMessage ?? null,
      lastReadAt: myMembership.lastReadAt,
      isRequest: myMembership.isRequest,
    });
  }
  return results.sort((a, b) => {
    const at = a.lastMessage?.createdAt ?? a.conversation.createdAt;
    const bt = b.lastMessage?.createdAt ?? b.conversation.createdAt;
    return bt.localeCompare(at);
  });
}

export async function getMessages(conversationId: string, userId: string, opts: { before?: string; limit?: number } = {}) {
  await assertMember(conversationId, userId);
  const limit = Math.min(opts.limit ?? 50, 100);

  const conditions = [eq(schema.messages.conversationId, conversationId)];
  if (opts.before) conditions.push(lt(schema.messages.createdAt, opts.before));

  const rows = await db
    .select()
    .from(schema.messages)
    .where(and(...conditions))
    .orderBy(desc(schema.messages.createdAt))
    .limit(limit);

  return rows.reverse();
}

async function isMuted(mutedBy: string, mutedUser: string) {
  const rows = await db
    .select()
    .from(schema.mutes)
    .where(and(eq(schema.mutes.muterId, mutedBy), eq(schema.mutes.mutedId, mutedUser)))
    .limit(1);
  return rows.length > 0;
}

export async function sendMessage(params: {
  conversationId: string;
  senderId: string;
  kind: "text" | "image" | "video" | "audio" | "shared_post" | "shared_reel" | "shared_profile";
  body?: string;
  mediaId?: string;
  sharedTargetType?: string;
  sharedTargetId?: string;
  replyToId?: string;
}) {
  await assertMember(params.conversationId, params.senderId);

  if (params.mediaId) {
    const [mediaRow] = await db.select().from(schema.media).where(eq(schema.media.id, params.mediaId)).limit(1);
    if (!mediaRow || mediaRow.ownerId !== params.senderId) {
      throw new MessagingAuthError("Media not found or not owned by sender");
    }
    await db.update(schema.media).set({ isPrivate: true }).where(eq(schema.media.id, params.mediaId));
  }

  const [message] = await db
    .insert(schema.messages)
    .values({
      conversationId: params.conversationId,
      senderId: params.senderId,
      kind: params.kind,
      body: params.body,
      mediaId: params.mediaId,
      sharedTargetType: params.sharedTargetType,
      sharedTargetId: params.sharedTargetId,
      replyToId: params.replyToId,
      deliveredAt: new Date().toISOString(),
    })
    .returning();

  const members = await db.select().from(schema.conversationMembers).where(eq(schema.conversationMembers.conversationId, params.conversationId));
  for (const m of members) {
    if (m.userId === params.senderId) continue;
    // Muting the sender suppresses the notification, but the message itself
    // still delivers — mute is a personal noise filter, not a block.
    if (await isMuted(m.userId, params.senderId)) continue;
    await db.insert(schema.notifications).values({ userId: m.userId, kind: "message", actorId: params.senderId, targetType: "conversation", targetId: params.conversationId });
    emitToUser(m.userId, "notification:new", { kind: "message", conversationId: params.conversationId });
  }

  emitToConversation(params.conversationId, "message:new", message);

  return message;
}

export async function markRead(conversationId: string, userId: string) {
  await assertMember(conversationId, userId);
  await db
    .update(schema.conversationMembers)
    .set({ lastReadAt: new Date().toISOString() })
    .where(and(eq(schema.conversationMembers.conversationId, conversationId), eq(schema.conversationMembers.userId, userId)));
  emitToConversation(conversationId, "read:update", { conversationId, userId, readAt: new Date().toISOString() });
}

export async function setPresence(userId: string, status: "online" | "away" | "offline") {
  await db
    .insert(schema.presence)
    .values({ userId, status, lastSeenAt: new Date().toISOString() })
    .onConflictDoUpdate({ target: schema.presence.userId, set: { status, lastSeenAt: new Date().toISOString() } });
}

/* --------------------------------- GROUPS --------------------------------- */

export async function createGroupConversation(creatorId: string, memberIds: string[], title?: string) {
  const uniqueMembers = [...new Set([creatorId, ...memberIds])];
  if (uniqueMembers.length < 2) throw new MessagingAuthError("A group needs at least one other member");

  for (const id of memberIds) {
    if (await areBlocked(creatorId, id)) throw new MessagingAuthError("Cannot add a blocked user to a group");
  }

  const [conversation] = await db.insert(schema.conversations).values({ isGroup: true, title }).returning();
  await db.insert(schema.conversationMembers).values(
    uniqueMembers.map((userId) => ({ conversationId: conversation.id, userId, isAdmin: userId === creatorId }))
  );
  return conversation;
}

async function assertGroupAdmin(conversationId: string, userId: string) {
  const [membership] = await db
    .select()
    .from(schema.conversationMembers)
    .where(and(eq(schema.conversationMembers.conversationId, conversationId), eq(schema.conversationMembers.userId, userId)))
    .limit(1);
  if (!membership || !membership.isAdmin) throw new MessagingAuthError("Group admin rights required");
}

export async function addGroupMember(conversationId: string, actingUserId: string, newMemberId: string) {
  const [conversation] = await db.select().from(schema.conversations).where(eq(schema.conversations.id, conversationId)).limit(1);
  if (!conversation || !conversation.isGroup) throw new MessagingAuthError("Not a group conversation");
  await assertGroupAdmin(conversationId, actingUserId);
  if (await areBlocked(actingUserId, newMemberId)) throw new MessagingAuthError("Cannot add a blocked user");

  await db.insert(schema.conversationMembers).values({ conversationId, userId: newMemberId }).onConflictDoNothing();
  emitToConversation(conversationId, "group:member_added", { conversationId, userId: newMemberId });
}

export async function removeGroupMember(conversationId: string, actingUserId: string, targetMemberId: string) {
  const [conversation] = await db.select().from(schema.conversations).where(eq(schema.conversations.id, conversationId)).limit(1);
  if (!conversation || !conversation.isGroup) throw new MessagingAuthError("Not a group conversation");

  // A member can always remove themself (leave); removing someone else
  // requires group admin rights.
  if (actingUserId !== targetMemberId) {
    await assertGroupAdmin(conversationId, actingUserId);
  } else {
    await assertMember(conversationId, actingUserId);
  }

  await db
    .delete(schema.conversationMembers)
    .where(and(eq(schema.conversationMembers.conversationId, conversationId), eq(schema.conversationMembers.userId, targetMemberId)));
  emitToConversation(conversationId, "group:member_removed", { conversationId, userId: targetMemberId });
}

/* ------------------------------ REACTIONS ------------------------------ */

export async function addMessageReaction(messageId: string, userId: string, emoji: string) {
  const [message] = await db.select().from(schema.messages).where(eq(schema.messages.id, messageId)).limit(1);
  if (!message) throw new MessagingAuthError("Message not found");
  await assertMember(message.conversationId, userId);

  await db.insert(schema.messageReactions).values({ messageId, userId, emoji }).onConflictDoNothing();
  emitToConversation(message.conversationId, "message:reaction", { messageId, userId, emoji, added: true });
}

export async function removeMessageReaction(messageId: string, userId: string, emoji: string) {
  const [message] = await db.select().from(schema.messages).where(eq(schema.messages.id, messageId)).limit(1);
  if (!message) throw new MessagingAuthError("Message not found");
  await assertMember(message.conversationId, userId);

  await db
    .delete(schema.messageReactions)
    .where(and(eq(schema.messageReactions.messageId, messageId), eq(schema.messageReactions.userId, userId), eq(schema.messageReactions.emoji, emoji)));
  emitToConversation(message.conversationId, "message:reaction", { messageId, userId, emoji, added: false });
}
