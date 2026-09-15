"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-context";

type Analytics = {
  profileViews: { total: number; last7Days: number };
  followers: { total: number; last30Days: number };
  connections: { total: number };
  posts: { id: string; body: string | null; views: number; reactions: number; comments: number; saves: number }[];
  reels: { id: string; caption: string | null; views: number; reactions: number }[];
  stories: { countLast30Days: number; totalViewsLast30Days: number };
};

export default function AnalyticsPage() {
  const { user } = useAuth();
  const [data, setData] = useState<Analytics | null>(null);

  useEffect(() => {
    if (!user) return;
    fetch("/api/analytics")
      .then((r) => r.json())
      .then(setData);
  }, [user]);

  if (!user) {
    return <div className="h-screen flex items-center justify-center text-steel text-sm">Sign in to see your analytics.</div>;
  }
  if (!data) return null;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-lg font-semibold tracking-tight mb-1">Analytics</h1>
      <p className="text-steel text-sm mb-6">Real numbers from your account — nothing here is estimated.</p>

      <div className="grid grid-cols-3 gap-3 mb-8">
        <StatCard label="Profile views" value={data.profileViews.total} sub={`${data.profileViews.last7Days} in 7d`} />
        <StatCard label="Followers" value={data.followers.total} sub={`+${data.followers.last30Days} in 30d`} />
        <StatCard label="Connections" value={data.connections.total} />
      </div>

      <div className="vy-panel vy-chamfer p-4 mb-8">
        <h2 className="text-xs uppercase tracking-wide text-steel mb-1">Stories (last 30 days)</h2>
        <p className="text-sm">
          {data.stories.countLast30Days} posted · {data.stories.totalViewsLast30Days} total views
        </p>
      </div>

      <h2 className="text-xs uppercase tracking-wide text-steel mb-3">Post performance</h2>
      {data.posts.length === 0 ? (
        <p className="text-steel text-sm mb-8">No posts yet.</p>
      ) : (
        <ul className="space-y-2 mb-8">
          {data.posts.map((p) => (
            <li key={p.id} className="vy-panel vy-chamfer p-3">
              <p className="text-sm mb-2 truncate">{p.body ?? "(media post)"}</p>
              <div className="flex gap-4 text-xs text-steel">
                <span>{p.views} views</span>
                <span>{p.reactions} likes</span>
                <span>{p.comments} comments</span>
                <span>{p.saves} saves</span>
              </div>
            </li>
          ))}
        </ul>
      )}

      <h2 className="text-xs uppercase tracking-wide text-steel mb-3">Reel performance</h2>
      {data.reels.length === 0 ? (
        <p className="text-steel text-sm">No reels yet.</p>
      ) : (
        <ul className="space-y-2">
          {data.reels.map((r) => (
            <li key={r.id} className="vy-panel vy-chamfer p-3">
              <p className="text-sm mb-2 truncate">{r.caption ?? "(untitled reel)"}</p>
              <div className="flex gap-4 text-xs text-steel">
                <span>{r.views} views</span>
                <span>{r.reactions} likes</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="vy-panel vy-chamfer p-4">
      <div className="text-2xl font-semibold tracking-tight">{value}</div>
      <div className="text-xs text-steel mt-1">{label}</div>
      {sub && <div className="text-xs text-crimson mt-0.5">{sub}</div>}
    </div>
  );
}
