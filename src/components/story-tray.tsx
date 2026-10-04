"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useAuth } from "./auth-context";
import { StoryViewer, type StoryTrayData } from "./story-viewer";
import { StoryComposer } from "./story-composer";

export function StoryTray({
  trays,
  loading,
  error,
  onRefresh,
}: {
  trays: StoryTrayData[] | null;
  loading: boolean;
  error: boolean;
  onRefresh: () => void;
}) {
  const { user } = useAuth();
  const [viewerTrayIndex, setViewerTrayIndex] = useState<number | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [localTrays, setLocalTrays] = useState<StoryTrayData[] | null>(null);

  const effectiveTrays = localTrays ?? trays;
  const myTray = effectiveTrays?.find((t) => t.authorId === user?.id);
  const otherTrays = effectiveTrays?.filter((t) => t.authorId !== user?.id) ?? [];

  function handleDeleted(storyId: string) {
    if (!effectiveTrays) return;
    const next = effectiveTrays
      .map((t) => ({ ...t, stories: t.stories.filter((s) => s.id !== storyId) }))
      .filter((t) => t.stories.length > 0);
    setLocalTrays(next);
  }

  if (loading) {
    return (
      <div className="flex gap-3 px-4 py-4 overflow-x-auto">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="w-14 h-14 rounded-full bg-graphite animate-pulse shrink-0" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 py-3 flex items-center gap-3 text-xs text-steel">
        <span>Couldn&apos;t load stories.</span>
        <button onClick={onRefresh} className="text-crimson hover:underline">
          Retry
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="flex gap-4 px-4 py-4 overflow-x-auto">
        <button
          onClick={() => (myTray ? setViewerTrayIndex(effectiveTrays!.indexOf(myTray)) : setComposerOpen(true))}
          className="flex flex-col items-center gap-1.5 shrink-0"
          aria-label={myTray ? "View your story" : "Add to your story"}
        >
          <div className="relative w-14 h-14">
            <div
              className="w-14 h-14 rounded-full p-[2px]"
              style={{ background: myTray?.hasUnseen ? "var(--vy-crimson)" : "var(--vy-charcoal)" }}
            >
              <div className="w-full h-full rounded-full bg-void flex items-center justify-center">
                {!myTray && <Plus size={20} className="text-steel" />}
              </div>
            </div>
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                setComposerOpen(true);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.stopPropagation();
                  setComposerOpen(true);
                }
              }}
              aria-label="Add a new story"
              className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-crimson flex items-center justify-center border-2 border-void cursor-pointer"
            >
              <Plus size={11} className="text-white" />
            </span>
          </div>
          <span className="text-[11px] text-steel">Your story</span>
        </button>

        {otherTrays.map((tray) => (
          <button
            key={tray.authorId}
            onClick={() => setViewerTrayIndex(effectiveTrays!.indexOf(tray))}
            className="flex flex-col items-center gap-1.5 shrink-0"
          >
            <div
              className="w-14 h-14 rounded-full p-[2px]"
              style={{ background: tray.hasUnseen ? "var(--vy-crimson)" : "var(--vy-charcoal)" }}
            >
              <div className="w-full h-full rounded-full bg-void p-[2px]">
                <div className="w-full h-full rounded-full" style={{ background: tray.author?.accentColor ?? "#6b6b74" }} />
              </div>
            </div>
            <span className="text-[11px] text-steel max-w-[56px] truncate">{tray.author?.username}</span>
          </button>
        ))}

        {otherTrays.length === 0 && !myTray && (
          <p className="text-xs text-steel self-center">No stories yet — follow or connect with people to see theirs here.</p>
        )}
      </div>

      {viewerTrayIndex !== null && effectiveTrays && (
        <StoryViewer
          trays={effectiveTrays}
          startTrayIndex={viewerTrayIndex}
          onClose={() => setViewerTrayIndex(null)}
          onDeleted={handleDeleted}
        />
      )}

      {composerOpen && (
        <StoryComposer
          onClose={() => setComposerOpen(false)}
          onCreated={() => {
            setComposerOpen(false);
            setLocalTrays(null);
            onRefresh();
          }}
        />
      )}
    </>
  );
}
