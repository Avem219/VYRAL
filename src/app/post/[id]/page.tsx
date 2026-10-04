import type { Metadata } from "next";
import Link from "next/link";
import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { getCurrentUser } from "@/lib/auth";
import { canViewPost } from "@/lib/posts";
import { getMediaUrl } from "@/lib/storage";

async function loadPost(id: string) {
  const [post] = await db.select().from(schema.posts).where(eq(schema.posts.id, id)).limit(1);
  if (!post) return null;
  const viewer = await getCurrentUser();
  if (!viewer && post.audience !== "everyone") return null;
  if (viewer && !(await canViewPost(post, viewer.id))) return null;
  const [author] = await db.select().from(schema.users).where(eq(schema.users.id, post.authorId)).limit(1);
  const [profile] = await db.select().from(schema.profiles).where(eq(schema.profiles.userId, post.authorId)).limit(1);
  const ids: string[] = post.mediaJson ? JSON.parse(post.mediaJson) : [];
  const mediaRows = ids.length ? await db.select().from(schema.media).where(inArray(schema.media.id, ids)) : [];
  const media = await Promise.all(mediaRows.map((row) => getMediaUrl(row)));
  return { post, author, profile, media };
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const data = await loadPost(id);
  if (!data) return { title: "Post unavailable · VYRAL" };
  const name = data.profile?.displayName || data.author?.username || "VYRAL";
  const description = data.post.body?.slice(0, 160) || `A post from @${data.author?.username ?? "VYRAL"}`;
  const image = data.media.find((url) => /\.(jpe?g|png|gif|webp)(\?|$)/i.test(url));
  return { title: `${name} on VYRAL`, description, alternates: { canonical: `/post/${id}` }, openGraph: { title: `${name} on VYRAL`, description, type: "article", url: `/post/${id}`, ...(image ? { images: [{ url: image }] } : {}) }, twitter: { card: image ? "summary_large_image" : "summary", title: `${name} on VYRAL`, description, ...(image ? { images: [image] } : {}) } };
}

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await loadPost(id);
  if (!data) return <main className="min-h-screen flex items-center justify-center text-sm text-steel">This post isn&apos;t available.</main>;
  const name = data.profile?.displayName || data.author?.username || "VYRAL";
  return <main className="min-h-screen bg-black text-white px-4 py-8"><article className="mx-auto max-w-2xl border border-white/10 bg-white/[0.02] p-5 sm:p-7"><div className="flex items-center gap-3"><div className="h-10 w-10 rounded-full" style={{ background: data.profile?.accentColor ?? "#e11d2e" }}>{!data.profile?.avatarUrl && <span className="flex h-full items-center justify-center font-semibold">{name[0]?.toUpperCase()}</span>}{data.profile?.avatarUrl && <img src={data.profile.avatarUrl} alt="" className="h-full w-full rounded-full object-cover" />}</div><div><Link href={`/profile/${data.author?.username}`} className="text-sm font-medium hover:text-crimson">{name}</Link><p className="text-xs text-steel">@{data.author?.username}</p></div></div>{data.post.body && <p className="mt-6 whitespace-pre-wrap text-[15px] leading-7 text-white/90">{data.post.body}</p>}{data.media.length > 0 && <div className="mt-5 grid gap-2">{data.media.map((url, i) => data.post.kind === "video" ? <video key={i} src={url} controls playsInline className="max-h-[70vh] w-full bg-black object-contain" /> : <img key={i} src={url} alt="" className="max-h-[70vh] w-full object-contain" />)}</div>}<div className="mt-6 text-xs text-steel">Posted on VYRAL · <Link href="/" className="hover:text-white">Open VYRAL</Link></div></article></main>;
}
