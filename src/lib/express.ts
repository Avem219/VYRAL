/**
 * EXPRESS — private expression system.
 *
 * Rule: only the sender and the intended recipient may ever see an Express
 * message, or even learn that it exists. Every query in this file is scoped
 * to (senderId = viewerId OR recipientId = viewerId). Do not add a query
 * here that lists Express messages by any other predicate (e.g. "all
 * Express for a profile", "recent Express platform-wide") — that would
 * create a path for unauthorized visibility.
 *
 * No other module should import `expressMessages` from the schema directly;
 * go through the functions here so the privacy invariant stays in one place.
 */
import { db, schema } from "@/db";
import { and, eq, or, isNull } from "drizzle-orm";

export class ExpressAuthError extends Error {}

async function getSendPermission(recipientId: string) {
  const rows = await db
    .select()
    .from(schema.expressPermissions)
    .where(eq(schema.expressPermissions.userId, recipientId))
    .limit(1);
  return rows[0]?.whoCanSend ?? "connections";
}

async function areConnected(a: string, b: string) {
  const rows = await db
    .select()
    .from(schema.connections)
    .where(
      and(
        eq(schema.connections.status, "accepted"),
        or(
          and(eq(schema.connections.requesterId, a), eq(schema.connections.addresseeId, b)),
          and(eq(schema.connections.requesterId, b), eq(schema.connections.addresseeId, a))
        )
      )
    )
    .limit(1);
  return rows.length > 0;
}

async function isBlocked(a: string, b: string) {
  const rows = await db
    .select()
    .from(schema.blocks)
    .where(
      or(
        and(eq(schema.blocks.blockerId, a), eq(schema.blocks.blockedId, b)),
        and(eq(schema.blocks.blockerId, b), eq(schema.blocks.blockedId, a))
      )
    )
    .limit(1);
  return rows.length > 0;
}

function expiresAtFor(policy: "24h" | "7d" | "30d" | "never") {
  if (policy === "never") return null;
  const hours = { "24h": 24, "7d": 24 * 7, "30d": 24 * 30 }[policy];
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

export async function sendExpress(params: {
  senderId: string;
  recipientId: string;
  kind: "text" | "image" | "video" | "audio" | "music" | "link";
  body?: string;
  mediaId?: string;
  musicTrackId?: string;
  allowReply?: boolean;
  allowForward?: boolean;
  expiration?: "24h" | "7d" | "30d" | "never";
}) {
  if (params.senderId === params.recipientId) {
    throw new ExpressAuthError("Cannot send Express to yourself");
  }
  if (await isBlocked(params.senderId, params.recipientId)) {
    throw new ExpressAuthError("Not permitted");
  }

  const permission = await getSendPermission(params.recipientId);
  if (permission === "nobody") throw new ExpressAuthError("Recipient is not accepting Express");
  if (permission === "connections" && !(await areConnected(params.senderId, params.recipientId))) {
    throw new ExpressAuthError("Recipient only accepts Express from connections");
  }

  if (params.mediaId) {
    const [mediaRow] = await db.select().from(schema.media).where(eq(schema.media.id, params.mediaId)).limit(1);
    if (!mediaRow || mediaRow.ownerId !== params.senderId) {
      throw new ExpressAuthError("Media not found or not owned by sender");
    }
    // Any media attached to an Express becomes private by construction,
    // regardless of how it was originally uploaded — see the authorization
    // check in src/app/api/media/[id]/route.ts.
    await db.update(schema.media).set({ isPrivate: true }).where(eq(schema.media.id, params.mediaId));
  }

  const [row] = await db
    .insert(schema.expressMessages)
    .values({
      senderId: params.senderId,
      recipientId: params.recipientId,
      kind: params.kind,
      body: params.body,
      mediaId: params.mediaId,
      musicTrackId: params.musicTrackId,
      allowReply: params.allowReply ?? true,
      allowForward: params.allowForward ?? false,
      expiresAt: expiresAtFor(params.expiration ?? "never"),
    })
    .returning();

  await db.insert(schema.notifications).values({
    userId: params.recipientId,
    kind: "express",
    actorId: params.senderId,
    targetType: "express_message",
    targetId: row.id,
    // No body/preview stored — notification must never leak Express content.
  });

  return row;
}

/** Inbox: Express addressed to viewerId, not deleted by them, not expired. */
export async function listInbox(viewerId: string) {
  return db
    .select()
    .from(schema.expressMessages)
    .where(
      and(
        eq(schema.expressMessages.recipientId, viewerId),
        eq(schema.expressMessages.deletedByRecipient, false),
        isNull(schema.expressMessages.recalledAt) // recalled hidden from recipient
      )
    )
    .orderBy(schema.expressMessages.createdAt);
}

/** Sent folder: Express sent by viewerId, not deleted by them. */
export async function listSent(viewerId: string) {
  return db
    .select()
    .from(schema.expressMessages)
    .where(
      and(
        eq(schema.expressMessages.senderId, viewerId),
        eq(schema.expressMessages.deletedBySender, false)
      )
    )
    .orderBy(schema.expressMessages.createdAt);
}

/** Fetch a single Express message, authorized to sender or recipient only. */
export async function getExpressForViewer(expressId: string, viewerId: string) {
  const rows = await db
    .select()
    .from(schema.expressMessages)
    .where(eq(schema.expressMessages.id, expressId))
    .limit(1);
  const msg = rows[0];
  if (!msg) return null;
  if (msg.senderId !== viewerId && msg.recipientId !== viewerId) {
    throw new ExpressAuthError("Not authorized to view this Express");
  }
  if (msg.expiresAt && new Date(msg.expiresAt) < new Date()) return null;
  return msg;
}

export async function markOpened(expressId: string, viewerId: string) {
  const msg = await getExpressForViewer(expressId, viewerId);
  if (!msg || msg.recipientId !== viewerId) throw new ExpressAuthError("Not authorized");
  if (!msg.openedAt) {
    await db
      .update(schema.expressMessages)
      .set({ openedAt: new Date().toISOString() })
      .where(eq(schema.expressMessages.id, expressId));
  }
}

export async function recall(expressId: string, senderId: string) {
  const msg = await getExpressForViewer(expressId, senderId);
  if (!msg || msg.senderId !== senderId) throw new ExpressAuthError("Not authorized");
  await db
    .update(schema.expressMessages)
    .set({ recalledAt: new Date().toISOString() })
    .where(eq(schema.expressMessages.id, expressId));
}

export async function deleteForViewer(expressId: string, viewerId: string) {
  const msg = await getExpressForViewer(expressId, viewerId);
  if (!msg) throw new ExpressAuthError("Not authorized");
  if (msg.senderId === viewerId) {
    await db.update(schema.expressMessages).set({ deletedBySender: true }).where(eq(schema.expressMessages.id, expressId));
  } else {
    await db.update(schema.expressMessages).set({ deletedByRecipient: true }).where(eq(schema.expressMessages.id, expressId));
  }
}
