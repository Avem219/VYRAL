"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bookmark, Heart, MessageCircle, Plus, RefreshCw, Volume2, VolumeX, X } from "lucide-react";
import { useAuth } from "@/components/auth-context";
import { CommentsThread } from "@/components/comments-thread";

type Reel = {
  id: string;
  videoUrl: string | null;
  thumbnailUrl: string | null;
  caption: string | null;
  reactionCount: number;
  commentCount: number;
  liked: boolean;
  saved: boolean;
  author: { username: string; displayName?: string };
};

export default function ReelsPage() {
  const { user, loading } = useAuth();
  const [items, setItems] = useState<Reel[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(true);
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await fetch("/api/reels", { cache: "no-store" });
      const d = await r.json();
      if (!r.ok) throw Error(d.error || "Unable to load reels");
      const nextItems = d.items || [];
      setItems(nextItems);
      setLiked(new Set(nextItems.filter((x: Reel) => x.liked).map((x: Reel) => x.id)));
      setSaved(new Set(nextItems.filter((x: Reel) => x.saved).map((x: Reel) => x.id)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load reels");
    }
  }, []);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  if (loading) return null;
  if (!user) return <div className="min-h-screen flex items-center justify-center text-steel">Sign in to watch Reels.</div>;

  return (
    <main className="min-h-screen bg-black">
      <header className="sticky top-0 z-20 flex items-center justify-between px-4 py-4 bg-black/85 backdrop-blur border-b border-white/10">
        <div>
          <p className="eyebrow">VYRAL / REELS</p>
          <h1 className="font-semibold">Reels</h1>
        </div>
        <Link href="/create?type=reel" className="vy-btn-primary inline-flex items-center gap-2">
          <Plus size={16} /> Create
        </Link>
      </header>

      {error ? (
        <div className="max-w-md mx-auto p-8 text-center">
          <p className="text-sm text-crimson">{error}</p>
          <button onClick={load} className="vy-btn-secondary mt-4 inline-flex gap-2">
            <RefreshCw size={15} /> Retry
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="min-h-[70vh] flex items-center justify-center text-sm text-steel">No Reels yet.</div>
      ) : (
        <div className="h-[calc(100vh-73px)] overflow-y-auto snap-y snap-mandatory">
          {items.map((r) => (
            <Card
              key={r.id}
              reel={r}
              muted={muted}
              setMuted={setMuted}
              liked={liked.has(r.id)}
              saved={saved.has(r.id)}
              onLike={async () => {
                const action = liked.has(r.id) ? "unlike" : "like";
                const previous = liked.has(r.id);
                setLiked((s) => {
                  const n = new Set(s);
                  action === "like" ? n.add(r.id) : n.delete(r.id);
                  return n;
                });
                const response = await fetch(`/api/reels/${r.id}`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ action }),
                });
                if (!response.ok) {
                  setLiked((s) => {
                    const n = new Set(s);
                    previous ? n.add(r.id) : n.delete(r.id);
                    return n;
                  });
                }
              }}
              onSave={async () => {
                const previous = saved.has(r.id);
                setSaved((s) => {
                  const n = new Set(s);
                  previous ? n.delete(r.id) : n.add(r.id);
                  return n;
                });
                const response = await fetch("/api/saved", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ targetType: "reel", targetId: r.id }),
                });
                if (!response.ok) {
                  setSaved((s) => {
                    const n = new Set(s);
                    previous ? n.add(r.id) : n.delete(r.id);
                    return n;
                  });
                }
              }}
              onView={() =>
                fetch(`/api/reels/${r.id}`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ action: "view" }),
                }).catch(() => {})
              }
            />
          ))}
        </div>
      )}
    </main>
  );
}

function Card({
  reel,
  muted,
  setMuted,
  liked,
  saved,
  onLike,
  onSave,
  onView,
}: {
  reel: Reel;
  muted: boolean;
  setMuted: (v: boolean) => void;
  liked: boolean;
  saved: boolean;
  onLike: () => void;
  onSave: () => void;
  onView: () => void;
}) {
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentCount, setCommentCount] = useState(reel.commentCount);
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        v.play().catch(() => {});
        onView();
      } else {
        v.pause();
      }
    }, { threshold: 0.7 });
    obs.observe(v);
    return () => obs.disconnect();
  }, [onView]);

  return (
    <section className="h-[calc(100vh-73px)] min-h-[520px] snap-start flex items-center justify-center bg-black">
      <div className="relative h-full w-full max-w-[680px] overflow-hidden bg-obsidian md:vy-chamfer">
        {reel.videoUrl ? (
          <video
            ref={ref}
            src={reel.videoUrl}
            poster={reel.thumbnailUrl ?? undefined}
            muted={muted}
            loop
            playsInline
            className="w-full h-full object-contain"
          />
        ) : (
          <div className="h-full flex items-center justify-center text-steel">Video unavailable</div>
        )}

        <div className="absolute inset-x-0 bottom-0 p-5 pb-8 bg-gradient-to-t from-black via-black/60 to-transparent">
          <Link href={`/profile/${reel.author.username}`} className="font-medium hover:text-crimson">
            {reel.author.displayName ?? reel.author.username}
          </Link>
          {reel.caption && <p className="text-sm mt-2 max-w-[80%]">{reel.caption}</p>}
        </div>

        <div className="absolute right-4 bottom-20 flex flex-col gap-3 z-20">
          <button aria-label={liked ? "Unlike" : "Like"} onClick={onLike} className={`icon-action ${liked ? "text-crimson" : ""}`}>
            <Heart fill={liked ? "currentColor" : "none"} />
            <span>{reel.reactionCount + (liked ? 1 : 0)}</span>
          </button>
          <button aria-label={commentsOpen ? "Close comments" : "Comments"} onClick={() => setCommentsOpen((v) => !v)} className="icon-action">
            <MessageCircle />
            <span>{commentCount}</span>
          </button>
          <button aria-label={saved ? "Saved" : "Save"} onClick={onSave} className={`icon-action ${saved ? "text-crimson" : ""}`}>
            <Bookmark fill={saved ? "currentColor" : "none"} />
          </button>
          <button aria-label={muted ? "Unmute" : "Mute"} onClick={() => setMuted(!muted)} className="icon-action">
            {muted ? <VolumeX /> : <Volume2 />}
          </button>
        </div>

        {commentsOpen && (
          <div className="absolute left-4 right-16 bottom-4 md:left-5 md:right-20 z-30">
            <div className="max-h-[42vh] overflow-y-auto bg-black/90 border border-white/10 p-3 backdrop-blur">
              <div className="flex justify-end">
                <button aria-label="Close comments" onClick={() => setCommentsOpen(false)} className="icon-action">
                  <X size={16} />
                </button>
              </div>
              <CommentsThread
                postId={reel.id}
                targetType="reel"
                onCountChange={(d) => setCommentCount((c) => Math.max(0, c + d))}
              />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
