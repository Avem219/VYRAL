import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { and, eq, ne, notInArray, or, inArray } from "drizzle-orm";
import { requireUser } from "@/lib/require-auth";

/**
 * Discovery is opt-in and abstracted behind this endpoint so a future
 * native app can swap in a real DiscoveryProvider (e.g. proximity via
 * privacy-preserving ephemeral IDs) without touching consumers of this API.
 * The web client only ever sees users who set discoverability to
 * 'everyone' or 'discoverable', and never sees exact location — this
 * endpoint doesn't collect location at all.
 */
export async function GET() {
  const { user, res } = await requireUser();
  if (!user) return res;

  const blockRows = await db
    .select()
    .from(schema.blocks)
    .where(or(eq(schema.blocks.blockerId, user.id), eq(schema.blocks.blockedId, user.id)));
  const blockedIds = blockRows.map((b) => (b.blockerId === user.id ? b.blockedId : b.blockerId));

  const discoverableProfiles = await db
    .select()
    .from(schema.profiles)
    .where(
      and(
        ne(schema.profiles.userId, user.id),
        or(eq(schema.profiles.discoverability, "everyone"), eq(schema.profiles.discoverability, "discoverable")),
        blockedIds.length ? notInArray(schema.profiles.userId, blockedIds) : undefined
      )
    )
    .limit(150);

  const userIds = discoverableProfiles.map((p) => p.userId);
  if (userIds.length === 0) return NextResponse.json({ nodes: [] });

  const users = await db.select().from(schema.users).where(inArray(schema.users.id, userIds));
  const userById = new Map(users.map((u) => [u.id, u]));

  const myInterests = await db.select().from(schema.interests).where(eq(schema.interests.userId, user.id));
  const myInterestSet = new Set(myInterests.map((i) => i.label.toLowerCase()));

  const allInterests = await db.select().from(schema.interests).where(inArray(schema.interests.userId, userIds));
  const interestsByUser = new Map<string, string[]>();
  for (const i of allInterests) {
    interestsByUser.set(i.userId, [...(interestsByUser.get(i.userId) ?? []), i.label]);
  }

  // Deterministic pseudo-random placement (seeded by id) so the layout is
  // stable between loads, clustered by shared-interest overlap: higher
  // overlap => closer to center (radius shrinks with similarity).
  function seededAngleAndRadius(id: string, similarity: number) {
    let hash = 0;
    for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
    const angle = (hash % 3600) / 3600 * Math.PI * 2;
    const jitter = ((hash >> 8) % 100) / 100;
    const radius = 6 + (1 - similarity) * 14 + jitter * 2;
    return { angle, radius };
  }

  const nodes = discoverableProfiles.map((p) => {
    const u = userById.get(p.userId)!;
    const theirInterests = interestsByUser.get(p.userId) ?? [];
    const overlap = theirInterests.filter((i) => myInterestSet.has(i.toLowerCase())).length;
    const similarity = myInterestSet.size ? overlap / myInterestSet.size : 0;
    const { angle, radius } = seededAngleAndRadius(p.userId, similarity);
    const height = ((overlap * 37) % 10) - 5;

    return {
      id: p.userId,
      username: u.username,
      displayName: p.displayName,
      avatarUrl: p.avatarUrl,
      accentColor: p.accentColor,
      sharedInterestCount: overlap,
      position: [Math.cos(angle) * radius, height, Math.sin(angle) * radius] as [number, number, number],
    };
  });

  return NextResponse.json({ nodes });
}
