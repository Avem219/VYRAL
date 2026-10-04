"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { X, Pause, Play, Trash2 } from "lucide-react";
import { useAuth } from "./auth-context";

export type StoryItem = {
  id: string;
  kind: string;
  body: string | null;
  mediaUrl: string | null;
  expiresAt: string;
  createdAt: string;
  viewedByMe: boolean;
  author: { id: string; username: string; displayName?: string; accentColor?: string } | null;
};

export type StoryTrayData = {
  authorId: string;
  author: { id: string; username: string; displayName?: string; accentColor?: string } | null;
  hasUnseen: boolean;
  stories: StoryItem[];
};

const STORY_DURATION_MS = 6000;

export function StoryViewer({
  trays,
  startTrayIndex,
  onClose,
  onDeleted,
}: {
  trays: StoryTrayData[];
  startTrayIndex: number;
  onClose: () => void;
  onDeleted: (storyId: string) => void;
}) {
  const { user } = useAuth();
  const [trayIndex, setTrayIndex] = useState(startTrayIndex);
  const [storyIndex, setStoryIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number>(0);
  const pausedAtRef = useRef<number>(0);

  const tray = trays[trayIndex];
  const story = tray?.stories[storyIndex];

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = () => setReducedMotion(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const goNext = useCallback(() => {
    if (!tray) return;
    if (storyIndex < tray.stories.length - 1) {
      setStoryIndex((i) => i + 1);
    } else if (trayIndex < trays.length - 1) {
      setTrayIndex((i) => i + 1);
      setStoryIndex(0);
    } else {
      onClose();
    }
  }, [tray, storyIndex, trayIndex, trays.length, onClose]);

  const goPrev = useCallback(() => {
    if (storyIndex > 0) {
      setStoryIndex((i) => i - 1);
    } else if (trayIndex > 0) {
      const prevTray = trays[trayIndex - 1];
      setTrayIndex((i) => i - 1);
      setStoryIndex(prevTray.stories.length - 1);
    }
  }, [storyIndex, trayIndex, trays]);

  // Record the view and reset progress whenever the active story changes.
  useEffect(() => {
    if (!story) return;
    setProgress(0);
    startRef.current = performance.now();
    fetch(`/api/stories/${story.id}/view`, { method: "POST" }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally keyed on story.id, not the story object, so this only re-fires on actual navigation
  }, [story?.id]);

  // Progress/auto-advance loop. If reduced motion is requested, skip the
  // animated bar but still auto-advance on a timer (announced via the
  // static "seen" state rather than a moving indicator).
  useEffect(() => {
    if (!story || paused) return;

    if (reducedMotion) {
      setProgress(1);
      const timeout = setTimeout(goNext, STORY_DURATION_MS);
      return () => clearTimeout(timeout);
    }

    let cancelled = false;
    function tick(now: number) {
      if (cancelled) return;
      const elapsed = now - startRef.current;
      const pct = Math.min(1, elapsed / STORY_DURATION_MS);
      setProgress(pct);
      if (pct >= 1) {
        goNext();
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally keyed on story.id, not the story object
  }, [story?.id, paused, goNext, reducedMotion]);

  function togglePause() {
    if (!paused) {
      pausedAtRef.current = performance.now();
      setPaused(true);
    } else {
      // Shift the start time forward by the paused duration so progress
      // resumes from where it left off instead of jumping.
      startRef.current += performance.now() - pausedAtRef.current;
      setPaused(false);
    }
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") goNext();
      else if (e.key === "ArrowLeft") goPrev();
      else if (e.key === " ") {
        e.preventDefault();
        togglePause();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goNext, goPrev, onClose]);

  async function handleDelete() {
    if (!story) return;
    if (!confirm("Delete this story? This can't be undone.")) return;
    await fetch(`/api/stories/${story.id}`, { method: "DELETE" });
    onDeleted(story.id);
    goNext();
  }

  if (!tray || !story) return null;
  const isOwn = user?.id === story.author?.id;

  return (
    <div
      className="fixed inset-0 bg-void z-50 flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-label={`Story from ${story.author?.displayName ?? story.author?.username}`}
    >
      <div className="flex gap-1 p-3 pt-4">
        {tray.stories.map((s, i) => (
          <div key={s.id} className="h-0.5 flex-1 bg-white/20 overflow-hidden rounded-full">
            <div
              className="h-full bg-white"
              style={{
                width: i < storyIndex ? "100%" : i === storyIndex ? `${progress * 100}%` : "0%",
                transition: reducedMotion ? "none" : undefined,
              }}
            />
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 px-4 pb-3">
        <div className="w-8 h-8 rounded-full shrink-0" style={{ background: story.author?.accentColor ?? "#e11d2e" }} />
        <div className="text-sm text-white font-medium">{story.author?.displayName ?? story.author?.username}</div>
        <div className="text-xs text-white/50">{timeAgo(story.createdAt)}</div>
        <div className="ml-auto flex items-center gap-3">
          <button onClick={togglePause} aria-label={paused ? "Resume" : "Pause"} className="text-white/80 hover:text-white">
            {paused ? <Play size={18} /> : <Pause size={18} />}
          </button>
          {isOwn && (
            <button onClick={handleDelete} aria-label="Delete story" className="text-white/80 hover:text-crimson">
              <Trash2 size={18} />
            </button>
          )}
          <button onClick={onClose} aria-label="Close" className="text-white/80 hover:text-white">
            <X size={20} />
          </button>
        </div>
      </div>

      <div className="relative flex-1 flex items-center justify-center overflow-hidden">
        <button
          onClick={goPrev}
          aria-label="Previous story"
          className="absolute left-0 top-0 bottom-0 w-1/3 z-10 cursor-default"
        />
        <button
          onClick={goNext}
          aria-label="Next story"
          className="absolute right-0 top-0 bottom-0 w-1/3 z-10 cursor-default"
        />

        {story.kind === "text" && (
          <div className="max-w-md px-8 text-center text-2xl font-medium text-white leading-relaxed">{story.body}</div>
        )}
        {story.kind === "photo" && story.mediaUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={story.mediaUrl} alt="" className="max-h-full max-w-full object-contain" />
        )}
        {story.kind === "video" && story.mediaUrl && (
          <video src={story.mediaUrl} autoPlay muted={false} className="max-h-full max-w-full object-contain" onEnded={goNext} />
        )}
        {story.body && story.kind !== "text" && (
          <p className="absolute bottom-6 left-4 right-4 text-white text-sm bg-black/40 px-3 py-2 rounded">{story.body}</p>
        )}
      </div>
    </div>
  );
}

function timeAgo(iso: string) {
  const seconds = Math.floor((Date.now() - new Date(iso + "Z").getTime()) / 1000);
  if (seconds < 3600) return `${Math.max(1, Math.floor(seconds / 60))}m`;
  return `${Math.floor(seconds / 3600)}h`;
}
