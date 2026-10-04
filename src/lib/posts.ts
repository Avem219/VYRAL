import { db, schema } from "@/db";
import { and, eq, or } from "drizzle-orm";

export async function canViewPost(post: typeof schema.posts.$inferSelect, viewerId: string): Promise<boolean> {
  if (post.authorId === viewerId) return true;

  const blocked = await db
    .select()
    .from(schema.blocks)
    .where(
      or(
        and(eq(schema.blocks.blockerId, post.authorId), eq(schema.blocks.blockedId, viewerId)),
        and(eq(schema.blocks.blockerId, viewerId), eq(schema.blocks.blockedId, post.authorId))
      )
    )
    .limit(1);
  if (blocked.length > 0) return false;

  if (post.audience === "nobody") return false;
  if (post.audience === "everyone") return true;

  // "connections"
  const conn = await db
    .select()
    .from(schema.connections)
    .where(
      and(
        eq(schema.connections.status, "accepted"),
        or(
          and(eq(schema.connections.requesterId, viewerId), eq(schema.connections.addresseeId, post.authorId)),
          and(eq(schema.connections.requesterId, post.authorId), eq(schema.connections.addresseeId, viewerId))
        )
      )
    )
    .limit(1);
  return conn.length > 0;
}
