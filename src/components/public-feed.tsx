"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Heart, MessageSquare, Bookmark } from "lucide-react";

type PublicFeedItem = {
  id: string;
  body: string | null;
  createdAt: string;
  reactionCount: number;
  commentCount: number;
  author: { id: string; username: string; displayName?: string } | null;
};

export function PublicFeed() {
  const [items, setItems] = useState<PublicFeedItem[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/public/feed")
      .then((r) => r.json())
      .then((d) => setItems(d.items ?? []))
      .catch(() => setError(true));
  }, []);

  return (
    <div className="max-w-xl mx-auto px-4 py-8">
      <div className="vy-panel vy-chamfer p-4 mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-sm font-semibold">You&apos;re browsing VYRAL</h1>
          <p className="text-xs text-steel mt-0.5">Sign in to like, comment, save, and see everything your network shares.</p>
        </div>
        <Link href="/login" className="vy-btn-primary shrink-0">
          Sign in
        </Link>
      </div>

      {error ? (
        <p className="text-steel text-sm">Couldn&apos;t load posts right now.</p>
      ) : items === null ? (
        <p className="text-steel text-sm">Loading…</p>
      ) : items.length === 0 ? (
        <div className="vy-panel vy-chamfer p-8 text-center">
          <p className="text-steel text-sm">Nothing public to show yet.</p>
        </div>
      ) : (
        <ul className="space-y-4">
          {items.map((item) => (
            <li key={item.id} className="vy-panel vy-chamfer p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-full bg-charcoal shrink-0" />
                <div className="min-w-0">
                  <Link href={`/profile/${item.author?.username}`} className="text-sm font-medium hover:text-crimson transition-colors">
                    {item.author?.displayName ?? item.author?.username}
                  </Link>
                  <div className="text-xs text-steel">@{item.author?.username}</div>
                </div>
              </div>

              {item.body && <p className="text-sm leading-relaxed whitespace-pre-wrap">{item.body}</p>}

              <div className="flex items-center gap-5 mt-4 pt-3 border-t vy-hairline text-steel">
                <SignInPrompt icon={<Heart size={15} />} count={item.reactionCount} />
                <SignInPrompt icon={<MessageSquare size={15} />} count={item.commentCount} />
                <SignInPrompt icon={<Bookmark size={15} />} className="ml-auto" />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SignInPrompt({ icon, count, className }: { icon: React.ReactNode; count?: number; className?: string }) {
  return (
    <Link href="/login" className={`flex items-center gap-1.5 text-xs hover:text-crimson transition-colors ${className ?? ""}`}>
      {icon}
      {count !== undefined && count}
    </Link>
  );
}
