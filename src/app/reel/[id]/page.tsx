import type { Metadata } from "next";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getCurrentUser } from "@/lib/auth";
import { canViewReel } from "@/lib/comments";
import { getMediaUrl } from "@/lib/storage";

async function loadReel(id: string) {
  const [reel] = await db.select().from(schema.reels).where(eq(schema.reels.id, id)).limit(1);
  if (!reel) return null;
  const viewer = await getCurrentUser();
  if (!viewer && reel.audience !== "everyone") return null;
  if (viewer && !(await canViewReel(reel, viewer.id))) return null;
  const [video] = await db.select().from(schema.media).where(eq(schema.media.id, reel.mediaId)).limit(1);
  const [author] = await db.select().from(schema.users).where(eq(schema.users.id, reel.authorId)).limit(1);
  const [profile] = await db.select().from(schema.profiles).where(eq(schema.profiles.userId, reel.authorId)).limit(1);
  const track = reel.musicTrackId ? (await db.select().from(schema.tracks).where(eq(schema.tracks.id, reel.musicTrackId)).limit(1))[0] : null;
  return { reel, video, author, profile, track };
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const data = await loadReel(id);
  if (!data) return { title: "Reel unavailable · VYRAL" };
  const name = data.profile?.displayName || data.author?.username || "VYRAL";
  const description = data.reel.caption?.slice(0, 160) || `A Reel from @${data.author?.username ?? "VYRAL"}`;
  const image = data.profile?.avatarUrl || undefined;
  return { title: `${name} · VYRAL Reel`, description, alternates: { canonical: `/reel/${id}` }, openGraph: { title: `${name} · VYRAL Reel`, description, type: "website", url: `/reel/${id}`, ...(image ? { images: [image] } : {}) }, twitter: { card: image ? "summary_large_image" : "summary", title: `${name} · VYRAL Reel`, description, ...(image ? { images: [image] } : {}) } };
}

export default async function ReelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await loadReel(id);
  if (!data || !data.video) return <main className="min-h-screen flex items-center justify-center text-sm text-steel">This Reel isn&apos;t available.</main>;
  const name = data.profile?.displayName || data.author?.username || "VYRAL";
  const videoUrl = await getMediaUrl(data.video);
  return <main className="min-h-screen bg-black text-white"><div className="mx-auto flex min-h-screen max-w-5xl items-center justify-center px-4 py-8"><div className="grid w-full gap-6 md:grid-cols-[minmax(0,1fr)_320px]"><div className="flex min-h-[70vh] items-center justify-center bg-black"><video src={videoUrl} poster={data.profile?.avatarUrl ?? undefined} controls playsInline preload="metadata" className="max-h-[80vh] max-w-full" /></div><aside className="self-center border border-white/10 bg-white/[0.02] p-6"><Link href={`/profile/${data.author?.username}`} className="text-sm font-medium hover:text-crimson">{name}</Link><p className="text-xs text-steel">@{data.author?.username}</p>{data.reel.caption && <p className="mt-5 whitespace-pre-wrap text-sm leading-6 text-white/85">{data.reel.caption}</p>}{data.track && <a href={data.track.externalUrl} target="_blank" rel="noreferrer" className="mt-5 block border-t border-white/10 pt-4 text-xs text-steel hover:text-white">♫ {data.track.title} · {data.track.artist}</a>}<Link href="/reels" className="mt-6 inline-flex vy-btn-secondary">Open Reels</Link></aside></div></div></main>;
}
