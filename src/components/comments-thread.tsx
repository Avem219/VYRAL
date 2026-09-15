"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Comment = {
  id: string;
  body: string;
  parentId: string | null;
  createdAt: string;
  author: { id: string; username: string } | null;
};

export function CommentsThread({ postId, targetType = "post", onCountChange }: { postId: string; targetType?: "post" | "reel"; onCountChange?: (delta: number) => void }) {
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    fetch(`/api/${targetType === "reel" ? "reels" : "posts"}/${postId}/comments`)
      .then((r) => r.json())
      .then((d) => setComments(d.items ?? []));
  }, [postId, targetType]);

  async function submit() {
    if (!draft.trim()) return;
    setPosting(true);
    try {
      const res = await fetch(`/api/${targetType === "reel" ? "reels" : "posts"}/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: draft }),
      });
      if (res.ok) {
        const { comment } = await res.json();
        setComments((prev) => [...(prev ?? []), comment]);
        setDraft("");
        onCountChange?.(1);
      }
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="mt-3 pt-3 border-t vy-hairline space-y-3">
      {comments === null ? (
        <p className="text-xs text-steel">Loading comments…</p>
      ) : comments.length === 0 ? (
        <p className="text-xs text-steel">No comments yet.</p>
      ) : (
        <ul className="space-y-2">
          {comments.map((c) => (
            <li key={c.id} className="text-xs">
              <Link href={`/profile/${c.author?.username}`} className="font-medium hover:text-crimson transition-colors">
                @{c.author?.username}
              </Link>{" "}
              <span className="text-offwhite/90">{c.body}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Add a comment…"
          className="vy-input text-xs py-1.5"
        />
        <button onClick={submit} disabled={posting || !draft.trim()} className="vy-btn-secondary text-xs px-3 shrink-0">
          Post
        </button>
      </div>
    </div>
  );
}
