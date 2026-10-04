import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/require-auth";
import { canViewPost } from "@/lib/posts";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, res } = await requireUser();
  if (!user) return res;
  const { id } = await params;

  const [post] = await db.select().from(schema.posts).where(eq(schema.posts.id, id)).limit(1);
  if (!post || !(await canViewPost(post, user.id))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Authors viewing their own content don't count as a "view" for analytics purposes.
  if (post.authorId !== user.id) {
    await db.insert(schema.contentViews).values({ targetType: "post", targetId: id, viewerId: user.id });
  }

  return NextResponse.json({ ok: true });
}
