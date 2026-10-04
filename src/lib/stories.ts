import { db, schema } from "@/db";
import { and, eq, or, gt, inArray } from "drizzle-orm";

export async function isStoryAudienceAuthorized(story: typeof schema.stories.$inferSelect, viewerId: string) {
  if (story.authorId === viewerId) return true;

  const blocked = await db
    .select()
    .from(schema.blocks)
    .where(
      or(
        and(eq(schema.blocks.blockerId, story.authorId), eq(schema.blocks.blockedId, viewerId)),
        and(eq(schema.blocks.blockerId, viewerId), eq(schema.blocks.blockedId, story.authorId))
      )
    )
    .limit(1);
  if (blocked.length > 0) return false;

  if (story.audience === "everyone") return true;

  if (story.audience === "connections") {
    const conn = await db
      .select()
      .from(schema.connections)
      .where(
        and(
          eq(schema.connections.status, "accepted"),
          or(
            and(eq(schema.connections.requesterId, viewerId), eq(schema.connections.addresseeId, story.authorId)),
            and(eq(schema.connections.requesterId, story.authorId), eq(schema.connections.addresseeId, viewerId))
          )
        )
      )
      .limit(1);
    return conn.length > 0;
  }

  if (story.audience === "circle" && story.circleId) {
    const member = await db
      .select()
      .from(schema.circleMembers)
      .where(and(eq(schema.circleMembers.circleId, story.circleId), eq(schema.circleMembers.memberId, viewerId)))
      .limit(1);
    return member.length > 0;
  }

  return false;
}

/** Active (non-expired) stories from a set of authors, newest first. Expired rows are never returned as active — this is the single choke point for that rule. */
export async function getActiveStoriesByAuthors(authorIds: string[]) {
  if (authorIds.length === 0) return [];
  const nowIso = new Date().toISOString();
  return db
    .select()
    .from(schema.stories)
    .where(and(inArray(schema.stories.authorId, authorIds), gt(schema.stories.expiresAt, nowIso)))
    .orderBy(schema.stories.createdAt);
}
