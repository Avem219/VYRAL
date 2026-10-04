import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, schema } from "@/db";
import { eq, and, lt, desc, inArray } from "drizzle-orm";
import { requireUser } from "@/lib/require-auth";
import { canViewPost } from "@/lib/posts";
import { rateLimit } from "@/lib/auth";

const CreateSchema = z.object({
  body: z.string().min(1).max(1000),
  parentId: z.string().uuid().optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, res } = await requireUser();
  if (!user) return res;
  const { id: postId } = await params;

  const { allowed } = rateLimit(`comment:${user.id}`, 20, 60_000);
  if (!allowed) return NextResponse.json({ error: "Too many comments. Slow down." }, { status: 429 });

  const parsed = CreateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });

  const [post] = await db.select().from(schema.posts).where(eq(schema.posts.id, postId)).limit(1);
  if (!post || !(await canViewPost(post, user.id))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (parsed.data.parentId) {
    const [parent] = await db.select().from(schema.comments).where(eq(schema.comments.id, parsed.data.parentId)).limit(1);
    if (!parent || parent.postId !== postId) {
      return NextResponse.json({ error: "Parent comment not found" }, { status: 400 });
    }
  }

  // React's escaping (no dangerouslySetInnerHTML anywhere the body is
  // rendered) is what actually prevents XSS here; we still cap length and
  // strip control characters defensively.
  const cleanBody = parsed.data.body.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");

  const [comment] = await db
    .insert(schema.comments)
    .values({ postId, authorId: user.id, body: cleanBody, parentId: parsed.data.parentId })
    .returning();

  if (post.authorId !== user.id) {
    await db.insert(schema.notifications).values({
      userId: post.authorId,
      kind: "comment",
      actorId: user.id,
      targetType: "post",
      targetId: postId,
    });
  }
  if (parsed.data.parentId) {
    const [parent] = await db.select().from(schema.comments).where(eq(schema.comments.id, parsed.data.parentId)).limit(1);
    if (parent && parent.authorId !== user.id && parent.authorId !== post.authorId) {
      await db.insert(schema.notifications).values({
        userId: parent.authorId,
        kind: "reply",
        actorId: user.id,
        targetType: "comment",
        targetId: comment.id,
      });
    }
  }

  return NextResponse.json({ comment });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, res } = await requireUser();
  if (!user) return res;
  const { id: postId } = await params;

  const [post] = await db.select().from(schema.posts).where(eq(schema.posts.id, postId)).limit(1);
  if (!post || !(await canViewPost(post, user.id))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const before = req.nextUrl.searchParams.get("before");
  const conditions = [eq(schema.comments.postId, postId)];
  if (before) conditions.push(lt(schema.comments.createdAt, before));

  const rows = await db
    .select()
    .from(schema.comments)
    .where(and(...conditions))
    .orderBy(desc(schema.comments.createdAt))
    .limit(30);

  const authorIds = [...new Set(rows.map((c) => c.authorId))];
  const authors = authorIds.length ? await db.select().from(schema.users).where(inArray(schema.users.id, authorIds)) : [];
  const authorById = new Map(authors.map((a) => [a.id, a]));

  const items = rows.reverse().map((c) => ({
    id: c.id,
    body: c.body,
    parentId: c.parentId,
    createdAt: c.createdAt,
    author: authorById.get(c.authorId) && { id: c.authorId, username: authorById.get(c.authorId)!.username },
  }));

  return NextResponse.json({ items });
}
