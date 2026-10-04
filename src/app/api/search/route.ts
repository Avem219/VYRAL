import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db";
import { and, eq, like, ne, notInArray, or } from "drizzle-orm";
import { requireUser } from "@/lib/require-auth";

export async function GET(req: NextRequest) {
  const { user, res } = await requireUser();
  if (!user) return res;

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json({ users: [], posts: [] });

  const like_ = `%${q.replace(/[%_]/g, "")}%`;

  const blockRows = await db
    .select()
    .from(schema.blocks)
    .where(or(eq(schema.blocks.blockerId, user.id), eq(schema.blocks.blockedId, user.id)));
  const blockedIds = blockRows.map((b) => (b.blockerId === user.id ? b.blockedId : b.blockerId));

  // Users: match username/display name, respect discoverability (private
  // profiles opted fully out of discovery — "nobody" — are excluded; the
  // person can still be found by exact username if they choose "everyone").
  const userMatches = await db
    .select({ user: schema.users, profile: schema.profiles })
    .from(schema.users)
    .innerJoin(schema.profiles, eq(schema.profiles.userId, schema.users.id))
    .where(
      and(
        ne(schema.users.id, user.id),
        or(like(schema.users.username, like_), like(schema.profiles.displayName, like_)),
        ne(schema.profiles.discoverability, "nobody"),
        blockedIds.length ? notInArray(schema.users.id, blockedIds) : undefined
      )
    )
    .limit(20);

  // Posts: only ones from discoverable authors, respecting audience.
  const postMatches = await db
    .select({ post: schema.posts, author: schema.users, profile: schema.profiles })
    .from(schema.posts)
    .innerJoin(schema.users, eq(schema.users.id, schema.posts.authorId))
    .innerJoin(schema.profiles, eq(schema.profiles.userId, schema.posts.authorId))
    .where(
      and(
        like(schema.posts.body, like_),
        eq(schema.posts.audience, "everyone"),
        ne(schema.profiles.discoverability, "nobody"),
        blockedIds.length ? notInArray(schema.posts.authorId, blockedIds) : undefined
      )
    )
    .limit(20);

  return NextResponse.json({
    users: userMatches.map(({ user: u, profile: p }) => ({
      id: u.id,
      username: u.username,
      displayName: p.displayName,
      accentColor: p.accentColor,
    })),
    posts: postMatches.map(({ post, author }) => ({
      id: post.id,
      body: post.body,
      author: { id: author.id, username: author.username },
    })),
  });
}
