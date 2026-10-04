"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ExternalLink, MessageCircle, Send, Settings, UserPlus } from "lucide-react";
import { useAuth } from "@/components/auth-context";

type ProfileData = {
  user: { id: string; username: string };
  profile: { displayName: string; bio: string | null; avatarUrl?: string | null; accentColor: string; theme: string; profileMusicUrl?: string | null } | null;
  interests: string[];
  socialLinks: { id: string; platform: string; url: string }[];
  isSelf: boolean;
  isConnected: boolean;
  following: boolean;
  followerCount: number;
  followingCount: number;
  postCount: number;
};

type Post = { id: string; kind: string; body: string | null; media: string[]; createdAt: string };

export default function ProfileClient() {
  const { username } = useParams<{ username: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [data, setData] = useState<ProfileData | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [postsLoading, setPostsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setNotFound(false);
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(username)}`, { cache: "no-store" });
      if (res.status === 404) { setNotFound(true); return; }
      if (!res.ok) throw new Error("Profile unavailable");
      setData(await res.json());
    } finally { setLoading(false); }
  }, [username]);

  const loadPosts = useCallback(async () => {
    setPostsLoading(true);
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(username)}/posts`, { cache: "no-store" });
      const json = await res.json();
      setPosts(Array.isArray(json.items) ? json.items : []);
    } finally { setPostsLoading(false); }
  }, [username]);

  useEffect(() => { void load(); void loadPosts(); }, [load, loadPosts]);

  async function toggleFollow() {
    if (!data || actionLoading) return;
    setActionLoading(true);
    try {
      const res = await fetch("/api/social/follow", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ targetUserId: data.user.id }) });
      if (res.ok) await load();
    } finally { setActionLoading(false); }
  }

  async function connect() {
    if (!data || actionLoading) return;
    setActionLoading(true);
    try {
      await fetch("/api/social/connect", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "request", targetUserId: data.user.id }) });
      await load();
    } finally { setActionLoading(false); }
  }

  async function message() {
    if (!data || actionLoading) return;
    setActionLoading(true);
    try {
      const res = await fetch("/api/conversations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ targetUserId: data.user.id }) });
      if (res.ok) {
        const json = await res.json();
        if (json.conversation?.id) router.push(`/messages/${json.conversation.id}`);
      }
    } finally { setActionLoading(false); }
  }

  if (loading) return <main className="min-h-screen flex items-center justify-center text-steel text-sm">Loading profile…</main>;
  if (notFound || !data) return <main className="min-h-screen flex items-center justify-center px-6 text-center"><div><p className="text-steel text-sm">This profile isn&apos;t available.</p><Link href="/explore" className="vy-btn-secondary inline-flex mt-5">Back to Explore</Link></div></main>;

  const displayName = data.profile?.displayName || data.user.username;
  const accent = data.profile?.accentColor || "#e11d2e";

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-10">
        <section className="border-b border-white/10 pb-7">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            <div className="h-28 w-28 shrink-0 overflow-hidden rounded-full border border-white/10" style={{ background: accent }}>
              {data.profile?.avatarUrl ? <img src={data.profile.avatarUrl} alt={`${displayName}'s profile`} className="h-full w-full object-cover" /> : <div className="h-full w-full flex items-center justify-center text-3xl font-semibold">{displayName[0]?.toUpperCase()}</div>}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-col gap-4 sm:flex-row sm:justify-between">
                <div><h1 className="text-2xl font-semibold tracking-tight">{displayName}</h1><p className="mt-1 text-sm text-steel">@{data.user.username}</p></div>
                <div className="flex flex-wrap gap-2">
                  {data.isSelf ? <Link href="/settings" className="vy-btn-secondary inline-flex items-center gap-2"><Settings size={16}/>Edit Profile</Link> : user && <>
                    <button onClick={toggleFollow} disabled={actionLoading} className="vy-btn-primary inline-flex items-center gap-2 disabled:opacity-50"><UserPlus size={16}/>{data.following ? "Following" : "Follow"}</button>
                    <button onClick={connect} disabled={actionLoading || data.isConnected} className="vy-btn-secondary inline-flex items-center gap-2 disabled:opacity-50"><UserPlus size={16}/>{data.isConnected ? "Connected" : "Connect"}</button>
                    <button onClick={message} disabled={actionLoading} className="vy-btn-secondary inline-flex items-center gap-2 disabled:opacity-50"><MessageCircle size={16}/>Message</button>
                    <Link href={`/express?to=${data.user.id}`} className="vy-btn-secondary inline-flex items-center gap-2"><Send size={16}/>Express</Link>
                  </>}
                </div>
              </div>
              <div className="mt-6 flex gap-8"><Stat value={data.postCount} label="Posts"/><Stat value={data.followerCount} label="Followers"/><Stat value={data.followingCount} label="Following"/></div>
              {data.profile?.bio && <p className="mt-5 max-w-xl whitespace-pre-wrap text-sm leading-6 text-white/85">{data.profile.bio}</p>}
              {data.profile?.profileMusicUrl && <a href={data.profile.profileMusicUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 text-xs text-steel hover:text-white">♫ Profile music <ExternalLink size={12}/></a>}
            </div>
          </div>
        </section>

        {data.interests.length > 0 && <section className="border-b border-white/10 py-5"><div className="flex flex-wrap gap-2">{data.interests.map((interest) => <span key={interest} className="border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-steel">{interest}</span>)}</div></section>}
        {data.socialLinks.length > 0 && <section className="border-b border-white/10 py-5"><div className="flex flex-wrap gap-4">{data.socialLinks.map((link) => <a key={link.id} href={link.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm text-steel hover:text-white">{link.platform}<ExternalLink size={13}/></a>)}</div></section>}

        <section className="pt-6">
          <div className="mb-5 flex items-center justify-between"><h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-steel">Posts</h2><span className="text-xs text-steel">{posts.length}</span></div>
          {postsLoading ? <div className="py-16 text-center text-sm text-steel">Loading posts…</div> : posts.length === 0 ? <div className="py-16 text-center text-sm text-steel">No public posts yet.</div> : <div className="grid grid-cols-3 gap-1 sm:gap-2">{posts.map((post) => <Link key={post.id} href={`/post/${post.id}`} className="group relative aspect-square overflow-hidden bg-white/[0.03]">{post.media[0] ? (post.kind === "video" ? <video src={post.media[0]} muted playsInline preload="metadata" className="h-full w-full object-cover" /> : <img src={post.media[0]} alt="" className="h-full w-full object-cover transition-transform group-hover:scale-[1.03]" />) : <div className="h-full w-full p-4 flex items-end text-sm text-white/80">{post.body}</div>}</Link>)}</div>}
        </section>
      </div>
    </main>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return <div><p className="text-lg font-semibold">{value}</p><p className="text-xs text-steel">{label}</p></div>;
}
