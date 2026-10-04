"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Heart, MessageSquare, Bookmark, Volume2, VolumeX, Play } from "lucide-react";
import { CommentsThread } from "./comments-thread";

export type ReelItem = {
  id: string;
  videoUrl: string | null;
  thumbnailUrl: string | null;
  caption: string | null;
  createdAt: string;
  reactionCount: number;
  commentCount: number;
  saveCount: number;
  likedByMe: boolean;
  savedByMe: boolean;
  author: { id: string; username: string; displayName?: string; accentColor?: string } | null;
  music?: { id: string; title: string; artist: string; provider: string; externalUrl: string } | null;
};

export function ReelCard({ reel, muted, onToggleMute }: { reel: ReelItem; muted: boolean; onToggleMute: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [liked, setLiked] = useState(reel.likedByMe);
  const [likeCount, setLikeCount] = useState(reel.reactionCount);
  const [saved, setSaved] = useState(reel.savedByMe);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentCount, setCommentCount] = useState(reel.commentCount);
  const [hasError, setHasError] = useState(false);
  const [hasViewed, setHasViewed] = useState(false);

  // Only the reel actually scrolled into view plays — every other video in
  // the list stays paused, so we're never decoding/streaming more than one
  // video at a time.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && entry.intersectionRatio > 0.6) {
          videoRef.current?.play().then(() => setPlaying(true)).catch(() => {});
          if (!hasViewed) {
            setHasViewed(true);
            fetch(`/api/reels/${reel.id}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "view" }),
            }).catch(() => {});
          }
        } else {
          videoRef.current?.pause();
          setPlaying(false);
        }
      },
      { threshold: [0, 0.6, 1] }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [reel.id, hasViewed]);

  function togglePlay() {
    if (!videoRef.current) return;
    if (playing) {
      videoRef.current.pause();
      setPlaying(false);
    } else {
      videoRef.current.play().then(() => setPlaying(true)).catch(() => {});
    }
  }

  async function toggleLike() {
    const next = !liked;
    setLiked(next);
    setLikeCount((c) => c + (next ? 1 : -1));
    await fetch(`/api/reels/${reel.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: next ? "like" : "unlike" }),
    });
  }

  async function toggleSave() {
    const next = !saved;
    setSaved(next);
    await fetch("/api/saved", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetType: "reel", targetId: reel.id }),
    });
  }

  async function share() {
    const url = `${window.location.origin}/reel/${reel.id}`;
    if (navigator.share) {
      await navigator.share({ url }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(url);
    }
  }

  return (
    <div ref={containerRef} className="relative h-[calc(100vh-4rem)] md:h-[80vh] w-full snap-start bg-obsidian flex items-center justify-center">
      {reel.videoUrl && !hasError ? (
        <video
          ref={videoRef}
          src={reel.videoUrl}
          poster={reel.thumbnailUrl ?? undefined}
          loop
          muted={muted}
          playsInline
          onClick={togglePlay}
          onError={() => setHasError(true)}
          className="max-h-full max-w-full object-contain cursor-pointer"
        />
      ) : (
        <div className="text-steel text-sm flex flex-col items-center gap-2">
          <p>{hasError ? "This video couldn't be loaded." : "No video available."}</p>
        </div>
      )}

      {!playing && !hasError && (
        <button
          onClick={togglePlay}
          aria-label="Play"
          className="absolute inset-0 flex items-center justify-center bg-black/20"
        >
          <Play size={48} className="text-white/90" fill="white" />
        </button>
      )}

      <div className="absolute bottom-0 left-0 right-16 p-4 bg-gradient-to-t from-black/70 to-transparent">
        <Link href={`/profile/${reel.author?.username}`} className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-full" style={{ background: reel.author?.accentColor ?? "#6b6b74" }} />
          <span className="text-sm text-white font-medium">@{reel.author?.username}</span>
        </Link>
        {reel.caption && <p className="text-sm text-white/90">{reel.caption}</p>}
        {reel.music && <a href={reel.music.externalUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex max-w-full items-center gap-2 text-xs text-white/80 hover:text-white"><span>♫</span><span className="truncate">{reel.music.title} · {reel.music.artist}</span></a>}
      </div>

      <div className="absolute right-3 bottom-6 flex flex-col items-center gap-5">
        <button onClick={toggleLike} aria-label={liked ? "Unlike" : "Like"} className="flex flex-col items-center gap-1 text-white">
          <Heart size={26} fill={liked ? "currentColor" : "none"} className={liked ? "text-crimson" : ""} />
          <span className="text-xs">{likeCount}</span>
        </button>
        <button onClick={() => setCommentsOpen(true)} aria-label="Comments" className="flex flex-col items-center gap-1 text-white">
          <MessageSquare size={24} />
          <span className="text-xs">{commentCount}</span>
        </button>
        <button onClick={toggleSave} aria-label={saved ? "Unsave" : "Save"} className="flex flex-col items-center gap-1 text-white">
          <Bookmark size={24} fill={saved ? "currentColor" : "none"} className={saved ? "text-crimson" : ""} />
        </button>
        <button onClick={onToggleMute} aria-label={muted ? "Unmute" : "Mute"} className="text-white">
          {muted ? <VolumeX size={22} /> : <Volume2 size={22} />}
        </button>
        <button onClick={share} aria-label="Share" className="text-white text-xs border border-white/40 rounded-full w-8 h-8 flex items-center justify-center">
          ↗
        </button>
      </div>

      {commentsOpen && (
        <div className="absolute inset-x-0 bottom-0 max-h-[70%] overflow-y-auto bg-void border-t vy-hairline p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium">Comments</h3>
            <button onClick={() => setCommentsOpen(false)} className="text-steel hover:text-offwhite text-sm">
              Close
            </button>
          </div>
          <CommentsThread
            postId={reel.id}
            endpoint={`/api/reels/${reel.id}/comments`}
            onCountChange={(delta) => setCommentCount((c) => c + delta)}
          />
        </div>
      )}
    </div>
  );
}
