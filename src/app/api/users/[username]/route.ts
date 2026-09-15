import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db";
import { and, eq, or, sql } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const viewer = await getCurrentUser();

  const [targetUser] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.username, username.toLowerCase()))
    .limit(1);
  if (!targetUser) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (viewer) {
    const blocked = await db
      .select()
      .from(schema.blocks)
      .where(
        or(
          and(eq(schema.blocks.blockerId, viewer.id), eq(schema.blocks.blockedId, targetUser.id)),
          and(eq(schema.blocks.blockerId, targetUser.id), eq(schema.blocks.blockedId, viewer.id))
        )
      )
      .limit(1);
    if (blocked.length > 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [profile] = await db.select().from(schema.profiles).where(eq(schema.profiles.userId, targetUser.id)).limit(1);

  const isSelf = viewer?.id === targetUser.id;
  const isConnected = viewer
    ? (
        await db
          .select()
          .from(schema.connections)
          .where(
            and(
              eq(schema.connections.status, "accepted"),
              or(
                and(eq(schema.connections.requesterId, viewer.id), eq(schema.connections.addresseeId, targetUser.id)),
                and(eq(schema.connections.requesterId, targetUser.id), eq(schema.connections.addresseeId, viewer.id))
              )
            )
          )
          .limit(1)
      ).length > 0
    : false;

  const interests = await db.select().from(schema.interests).where(eq(schema.interests.userId, targetUser.id));
  const socialLinksRaw = await db.select().from(schema.socialLinks).where(eq(schema.socialLinks.userId, targetUser.id));
  const socialLinks = socialLinksRaw.filter((l) => {
    if (isSelf) return true;
    if (l.visibility === "everyone") return true;
    if (l.visibility === "connections") return isConnected;
    return false;
  });

  const [followerCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.follows)
    .where(eq(schema.follows.followingId, targetUser.id));

  if (viewer) {
    await db.insert(schema.profileViews).values({ profileUserId: targetUser.id, viewerId: viewer.id });
  }

  return NextResponse.json({
    user: { id: targetUser.id, username: targetUser.username },
    profile,
    interests: interests.map((i) => i.label),
    socialLinks,
    isSelf,
    isConnected,
    followerCount: followerCount?.count ?? 0,
  });
}
