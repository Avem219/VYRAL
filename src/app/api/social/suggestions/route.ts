import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { and, eq, ne, notInArray, or, sql } from "drizzle-orm";
import { requireUser } from "@/lib/require-auth";
import { getMutedIds } from "@/lib/mutes";

export async function GET() {
  const { user, res } = await requireUser();
  if (!user) return res;

  const followingRows = await db.select({ id: schema.follows.followingId }).from(schema.follows).where(eq(schema.follows.followerId, user.id));
  const blockRows = await db.select().from(schema.blocks).where(or(eq(schema.blocks.blockerId, user.id), eq(schema.blocks.blockedId, user.id)));
  const mutedIds = await getMutedIds(user.id);

  const excludedIds = [
    user.id,
    ...followingRows.map((r) => r.id),
    ...blockRows.map((b) => (b.blockerId === user.id ? b.blockedId : b.blockerId)),
    ...mutedIds,
  ];

  const candidates = await db
    .select({ profile: schema.profiles, user: schema.users, followerCount: sql<number>`count(${schema.follows.id})::int` })
    .from(schema.profiles)
    .innerJoin(schema.users, eq(schema.users.id, schema.profiles.userId))
    .leftJoin(schema.follows, eq(schema.follows.followingId, schema.profiles.userId))
    .where(and(ne(schema.profiles.discoverability, "nobody"), notInArray(schema.profiles.userId, excludedIds)))
    .groupBy(schema.profiles.id, schema.users.id)
    .orderBy(sql`count(${schema.follows.id}) desc`)
    .limit(5);

  return NextResponse.json({
    items: candidates.map((c) => ({
      id: c.user.id,
      username: c.user.username,
      displayName: c.profile.displayName,
      accentColor: c.profile.accentColor,
      followerCount: c.followerCount,
    })),
  });
}
