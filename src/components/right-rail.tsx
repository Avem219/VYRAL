"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Activity, ArrowUpRight, Flame, UserPlus } from "lucide-react";

type Node = { id: string; username: string; displayName: string; avatarUrl: string | null; accentColor: string; sharedInterestCount: number };
type FeedItem = { id: string; body: string | null; reactionCount: number; commentCount: number; author: { username: string; displayName?: string } | null };
type Analytics = { profileViews: { total: number; last7Days: number }; followers: { total: number; last30Days: number }; connections: { total: number } };

export function RightRail() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);

  useEffect(() => {
    Promise.allSettled([
      fetch("/api/explore").then((r) => (r.ok ? r.json() : null)),
      fetch("/api/feed").then((r) => (r.ok ? r.json() : null)),
      fetch("/api/analytics").then((r) => (r.ok ? r.json() : null)),
    ]).then(([explore, feedRes, analyticsRes]) => {
      if (explore.status === "fulfilled" && explore.value?.nodes) setNodes(explore.value.nodes.slice(0, 5));
      if (feedRes.status === "fulfilled" && feedRes.value?.items) setFeed(feedRes.value.items);
      if (analyticsRes.status === "fulfilled" && analyticsRes.value) setAnalytics(analyticsRes.value);
    });
  }, []);

  const trending = [...feed]
    .filter((x) => x.author)
    .sort((a, b) => (b.reactionCount + b.commentCount) - (a.reactionCount + a.commentCount))
    .slice(0, 4);

  return (
    <aside className="hidden xl:block w-[300px] shrink-0 border-l border-white/5 px-4 py-5 sticky top-0 h-screen overflow-y-auto">
      <section className="vy-glass vy-chamfer-sm p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div><p className="eyebrow">Discover</p><h2 className="text-sm font-semibold mt-1">Suggested for you</h2></div>
          <UserPlus size={16} className="text-steel" />
        </div>
        <div className="space-y-3">
          {nodes.map((node) => (
            <Link key={node.id} href={`/profile/${node.username}`} className="flex items-center gap-3 group">
              <Avatar src={node.avatarUrl} accent={node.accentColor} label={node.displayName} />
              <div className="min-w-0 flex-1"><p className="text-sm truncate group-hover:text-crimson">{node.displayName}</p><p className="text-xs text-steel truncate">@{node.username}</p></div>
              <ArrowUpRight size={14} className="text-steel group-hover:text-crimson" />
            </Link>
          ))}
          {!nodes.length && <p className="text-xs text-steel">No discoverable identities right now.</p>}
        </div>
      </section>

      <section className="vy-glass vy-chamfer-sm p-4 mb-4">
        <div className="flex items-center gap-2 mb-3"><Flame size={16} className="text-crimson" /><div><p className="eyebrow">Live signal</p><h2 className="text-sm font-semibold mt-1">Trending</h2></div></div>
        <div className="space-y-3">
          {trending.map((item, i) => <Link key={item.id} href={`/?post=${item.id}`} className="block border-b border-white/5 pb-2 last:border-0"><p className="text-xs text-steel">0{i + 1} · @{item.author?.username}</p><p className="text-sm line-clamp-2 mt-0.5">{item.body || "Media post"}</p><p className="text-[10px] text-steel mt-1">{item.reactionCount} reactions · {item.commentCount} comments</p></Link>)}
          {!trending.length && <p className="text-xs text-steel">Trending signals will appear as activity is generated.</p>}
        </div>
      </section>

      <section className="vy-glass vy-chamfer-sm p-4">
        <div className="flex items-center gap-2 mb-3"><Activity size={16} className="text-crimson" /><div><p className="eyebrow">Your signal</p><h2 className="text-sm font-semibold mt-1">Analytics</h2></div></div>
        {analytics ? <div className="grid grid-cols-3 gap-2"><Metric label="Views" value={analytics.profileViews.total} /><Metric label="Followers" value={analytics.followers.total} /><Metric label="Connects" value={analytics.connections.total} /></div> : <p className="text-xs text-steel">Loading your metrics…</p>}
        <Link href="/analytics" className="mt-3 inline-flex text-xs text-steel hover:text-offwhite">Open analytics <ArrowUpRight size={13} className="ml-1" /></Link>
      </section>
    </aside>
  );
}

function Metric({ label, value }: { label: string; value: number }) { return <div className="border border-white/5 bg-black/20 p-2"><p className="text-base font-semibold">{value.toLocaleString()}</p><p className="text-[10px] text-steel uppercase tracking-wider">{label}</p></div>; }
function Avatar({ src, accent, label }: { src: string | null; accent: string; label: string }) { return src ? <img src={src} alt="" className="w-9 h-9 rounded-full object-cover border border-white/10" /> : <div className="w-9 h-9 rounded-full border border-white/10" style={{ background: `radial-gradient(circle at 35% 30%, ${accent}, #111 68%)` }} aria-label={label} />; }
