"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-context";

type SavedItem = {
  id: string;
  targetType: string;
  targetId: string;
  createdAt: string;
};

export default function SavedPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<SavedItem[] | null>(null);

  useEffect(() => {
    if (!user) return;
    fetch("/api/saved")
      .then((r) => r.json())
      .then((d) => setItems(d.items));
  }, [user]);

  if (!user) {
    return <div className="h-screen flex items-center justify-center text-steel text-sm">Sign in to see saved items.</div>;
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-8">
      <h1 className="text-lg font-semibold tracking-tight mb-2">Saved</h1>
      <p className="text-steel text-sm mb-6">Posts and reels you&apos;ve saved.</p>

      {items === null ? (
        <p className="text-steel text-sm">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-steel text-sm">Nothing saved yet — use the save action on a post or reel.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((i) => (
            <li key={i.id} className="vy-panel vy-chamfer p-3 text-sm">
              <span className="capitalize">{i.targetType}</span>{" "}
              <span className="text-steel text-xs">saved {new Date(i.createdAt + "Z").toLocaleDateString()}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
