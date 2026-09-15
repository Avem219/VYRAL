import { db, schema } from "@/db";
import { and, eq } from "drizzle-orm";

/** True if viewerId has muted subjectId. Mute is one-directional and never observable by the muted user. */
export async function isMutedBy(viewerId: string, subjectId: string) {
  const rows = await db
    .select()
    .from(schema.mutes)
    .where(and(eq(schema.mutes.muterId, viewerId), eq(schema.mutes.mutedId, subjectId)))
    .limit(1);
  return rows.length > 0;
}

export async function getMutedIds(viewerId: string): Promise<string[]> {
  const rows = await db.select({ mutedId: schema.mutes.mutedId }).from(schema.mutes).where(eq(schema.mutes.muterId, viewerId));
  return rows.map((r) => r.mutedId);
}
