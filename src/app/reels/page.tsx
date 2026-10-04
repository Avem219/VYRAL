"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth-context";
import { ReelCard, type ReelItem } from "@/components/reel-card";

export default function ReelsPage() {
  const { user, loading: authLoading } = useAuth();
  const [reels, setReels] = useState<ReelItem[] | null>(null);
  const [error, setError] = useState(false);
  const [muted, setMuted] = useState(true);

  const load = useCallback(async () => {
    setError(false);
    try {
      const res = await fetch("/api/reels");
      if (!res.ok) {
        setError(true);
        return;
      }
      setReels((await res.json()).items ?? []);
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  if (authLoading) return null;

  if (!user) {
    return (
      <div className="h-screen flex flex-col items-center justify-center text-center px-6">
        <p className="text-steel text-sm mb-4">Sign in to watch Reels.</p>
        <Link href="/login" className="vy-btn-primary">
          Sign in
        </Link>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen flex flex-col items-center justify-center text-center px-6">
        <p className="text-steel text-sm mb-4">Couldn&apos;t load Reels.</p>
        <button onClick={load} className="vy-btn-secondary">
          Retry
        </button>
      </div>
    );
  }

  if (reels === null) {
    return <div className="h-screen flex items-center justify-center text-steel text-sm">Loading…</div>;
  }

  if (reels.length === 0) {
    return (
      <div className="h-screen flex flex-col items-center justify-center text-center px-6">
        <p className="text-steel text-sm mb-4">
          No Reels yet — follow or connect with people, or be the first to post one.
        </p>
        <Link href="/create" className="vy-btn-primary">
          Create a Reel
        </Link>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-y-scroll snap-y snap-mandatory">
      {reels.map((reel) => (
        <ReelCard key={reel.id} reel={reel} muted={muted} onToggleMute={() => setMuted((m) => !m)} />
      ))}
    </div>
  );
}
