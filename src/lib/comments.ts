import { db, schema } from "@/db";
import { and, eq, or } from "drizzle-orm";
import { canViewPost } from "@/lib/posts";

export async function canViewReel(reel: typeof schema.reels.$inferSelect, viewerId: string): Promise<boolean> {
  if (reel.authorId === viewerId) return true;

  const blocked = await db
    .select()
    .from(schema.blocks)
    .where(
      or(
        and(eq(schema.blocks.blockerId, reel.authorId), eq(schema.blocks.blockedId, viewerId)),
        and(eq(schema.blocks.blockerId, viewerId), eq(schema.blocks.blockedId, reel.authorId))
      )
    )
    .limit(1);
  if (blocked.length > 0) return false;

  if (reel.audience === "everyone") return true;

  const conn = await db
    .select()
    .from(schema.connections)
    .where(
      and(
        eq(schema.connections.status, "accepted"),
        or(
          and(eq(schema.connections.requesterId, viewerId), eq(schema.connections.addresseeId, reel.authorId)),
          and(eq(schema.connections.requesterId, reel.authorId), eq(schema.connections.addresseeId, viewerId))
        )
      )
    )
    .limit(1);
  return conn.length > 0;
}

export { canViewPost };
