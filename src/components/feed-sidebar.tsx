"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Suggestion = { id: string; username: string; displayName: string; accentColor: string; followerCount: number };
type TrendingPost = { id: string; body: string | null; reactionCount: number; commentCount: number; author: { username: string } | null };
type AnalyticsSummary = {
  profileViews: { total: number };
  followers: { total: number };
  posts: { views: number; reactions: number; comments: number }[];
};

export function FeedSidebar() {
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [trending, setTrending] = useState<TrendingPost[] | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch("/api/social/suggestions")
      .then((r) => r.json())
      .then((d) => setSuggestions(d.items ?? []));
    fetch("/api/posts/trending")
      .then((r) => r.json())
      .then((d) => setTrending(d.items ?? []));
    fetch("/api/analytics")
      .then((r) => r.json())
      .then(setAnalytics);
  }, []);

  async function follow(userId: string) {
    setFollowingIds((prev) => new Set(prev).add(userId));
    await fetch("/api/social/follow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetUserId: userId }),
    });
  }

  const totals = analytics
    ? analytics.posts.reduce(
        (acc, p) => ({ views: acc.views + p.views, reactions: acc.reactions + p.reactions, comments: acc.comments + p.comments }),
        { views: 0, reactions: 0, comments: 0 }
      )
    : null;

  return (
    <aside className="hidden lg:flex w-72 shrink-0 flex-col gap-4 py-8 pr-4">
      <div className="vy-panel vy-chamfer p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs uppercase tracking-wide text-steel">Suggested for you</h2>
        </div>
        {suggestions === null ? (
          <p className="text-xs text-steel">Loading…</p>
        ) : suggestions.length === 0 ? (
          <p className="text-xs text-steel">No suggestions right now.</p>
        ) : (
          <ul className="space-y-3">
            {suggestions.map((s) => (
              <li key={s.id} className="flex items-center gap-2.5">
                <Link href={`/profile/${s.username}`} className="flex items-center gap-2.5 flex-1 min-w-0">
                  <div className="w-8 h-8 rounded-full shrink-0" style={{ background: s.accentColor }} />
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{s.displayName}</div>
                    <div className="text-xs text-steel truncate">@{s.username}</div>
                  </div>
                </Link>
                <button
                  onClick={() => follow(s.id)}
                  disabled={followingIds.has(s.id)}
                  className="text-xs text-crimson hover:underline shrink-0 disabled:text-steel disabled:no-underline"
                >
                  {followingIds.has(s.id) ? "Following" : "Follow"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="vy-panel vy-chamfer p-4">
        <h2 className="text-xs uppercase tracking-wide text-steel mb-3">Trending</h2>
        {trending === null ? (
          <p className="text-xs text-steel">Loading…</p>
        ) : trending.length === 0 ? (
          <p className="text-xs text-steel">Nothing trending in the last 48 hours yet.</p>
        ) : (
          <ul className="space-y-3">
            {trending.map((t) => (
              <li key={t.id}>
                <p className="text-xs text-steel truncate">
                  @{t.author?.username} · {t.reactionCount} likes · {t.commentCount} comments
                </p>
                {t.body && <p className="text-sm truncate">{t.body}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="vy-panel vy-chamfer p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs uppercase tracking-wide text-steel">Your analytics</h2>
          <Link href="/analytics" className="text-xs text-crimson hover:underline">
            See all
          </Link>
        </div>
        {!analytics || !totals ? (
          <p className="text-xs text-steel">Loading…</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 text-xs">
            <Stat label="Profile views" value={analytics.profileViews.total} />
            <Stat label="Followers" value={analytics.followers.total} />
            <Stat label="Post views" value={totals.views} />
            <Stat label="Likes" value={totals.reactions} />
          </div>
        )}
      </div>
    </aside>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-base font-semibold">{value}</div>
      <div className="text-steel">{label}</div>
    </div>
  );
}
