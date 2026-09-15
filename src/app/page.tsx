"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Heart, MessageSquare, Bookmark } from "lucide-react";
import { useAuth } from "@/components/auth-context";
import { CommentsThread } from "@/components/comments-thread";

type FeedItem = {
  id: string;
  kind: string;
  body: string | null;
  media: string[];
  createdAt: string;
  reactionCount: number;
  commentCount: number;
  author: { id: string; username: string; displayName?: string; avatarUrl?: string | null } | null;
};

export default function FeedPage() {
  const { user, loading } = useAuth();
  const [items, setItems] = useState<FeedItem[] | null>(null);
  const [composerText, setComposerText] = useState("");
  const [posting, setPosting] = useState(false);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  const [commentBumps, setCommentBumps] = useState<Record<string, number>>({});

  const loadFeed = useCallback(async () => {
    const res = await fetch("/api/feed");
    if (res.ok) {
      const data = await res.json();
      setItems(data.items);
      // Fire-and-forget view tracking: real events, but render-based rather
      // than scroll/visibility-verified — see analytics honesty notes in README.
      for (const item of data.items as FeedItem[]) {
        fetch(`/api/posts/${item.id}/view`, { method: "POST" }).catch(() => {});
      }
    }
  }, []);

  useEffect(() => {
    if (user) loadFeed();
  }, [user, loadFeed]);

  async function submitPost() {
    if (!composerText.trim()) return;
    setPosting(true);
    try {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "text", body: composerText, audience: "everyone" }),
      });
      if (res.ok) {
        setComposerText("");
        await loadFeed();
      }
    } finally {
      setPosting(false);
    }
  }

  async function toggleLike(postId: string) {
    setLikedIds((prev) => {
      const next = new Set(prev);
      if (next.has(postId)) next.delete(postId);
      else next.add(postId);
      return next;
    });
    await fetch("/api/reactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetType: "post", targetId: postId, kind: "like" }),
    });
  }

  async function toggleSave(postId: string) {
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (next.has(postId)) next.delete(postId);
      else next.add(postId);
      return next;
    });
    await fetch("/api/saved", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetType: "post", targetId: postId }),
    });
  }

  function toggleComments(postId: string) {
    setExpandedComments((prev) => {
      const next = new Set(prev);
      if (next.has(postId)) next.delete(postId);
      else next.add(postId);
      return next;
    });
  }

  if (loading) return null;

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Your world. Connected.</h1>
        <p className="text-steel mt-2 max-w-sm">
          Sign in to see your feed, explore the social universe, and build your VYRAL identity.
        </p>
        <Link href="/login" className="vy-btn-primary mt-6">
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-8">
      <h1 className="text-lg font-semibold tracking-tight mb-4">Feed</h1>

      <div className="vy-panel vy-chamfer p-4 mb-6">
        <textarea
          value={composerText}
          onChange={(e) => setComposerText(e.target.value)}
          placeholder="Share something with your world…"
          rows={3}
          className="vy-input resize-none"
        />
        <div className="flex justify-end mt-3">
          <button onClick={submitPost} disabled={posting || !composerText.trim()} className="vy-btn-primary">
            {posting ? "Posting…" : "Post"}
          </button>
        </div>
      </div>

      {items === null ? (
        <p className="text-steel text-sm">Loading feed…</p>
      ) : items.length === 0 ? (
        <div className="vy-panel vy-chamfer p-8 text-center">
          <p className="text-steel text-sm">
            Nothing here yet. Follow or connect with people to build your feed — or post the first thing yourself.
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {items.map((item) => (
            <li key={item.id} className="vy-panel vy-chamfer p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-full bg-charcoal shrink-0" />
                <div className="min-w-0">
                  <Link
                    href={`/profile/${item.author?.username}`}
                    className="text-sm font-medium hover:text-crimson transition-colors"
                  >
                    {item.author?.displayName ?? item.author?.username}
                  </Link>
                  <div className="text-xs text-steel">
                    @{item.author?.username} · {timeAgo(item.createdAt)}
                  </div>
                </div>
              </div>

              {item.body && <p className="text-sm leading-relaxed whitespace-pre-wrap">{item.body}</p>}

              <div className="flex items-center gap-5 mt-4 pt-3 border-t vy-hairline text-steel">
                <button
                  onClick={() => toggleLike(item.id)}
                  className={`flex items-center gap-1.5 text-xs transition-colors hover:text-crimson ${likedIds.has(item.id) ? "text-crimson" : ""}`}
                >
                  <Heart size={15} fill={likedIds.has(item.id) ? "currentColor" : "none"} />
                  {item.reactionCount + (likedIds.has(item.id) ? 1 : 0)}
                </button>
                <button
                  onClick={() => toggleComments(item.id)}
                  className={`flex items-center gap-1.5 text-xs transition-colors hover:text-crimson ${expandedComments.has(item.id) ? "text-crimson" : ""}`}
                >
                  <MessageSquare size={15} /> {item.commentCount + (commentBumps[item.id] ?? 0)}
                </button>
                <button
                  onClick={() => toggleSave(item.id)}
                  className={`flex items-center gap-1.5 text-xs ml-auto transition-colors hover:text-crimson ${savedIds.has(item.id) ? "text-crimson" : ""}`}
                >
                  <Bookmark size={15} fill={savedIds.has(item.id) ? "currentColor" : "none"} />
                </button>
              </div>

              {expandedComments.has(item.id) && (
                <CommentsThread
                  postId={item.id}
                  onCountChange={(delta) => setCommentBumps((prev) => ({ ...prev, [item.id]: (prev[item.id] ?? 0) + delta }))}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function timeAgo(iso: string) {
  const seconds = Math.floor((Date.now() - new Date(iso + "Z").getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}
