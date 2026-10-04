"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth-context";

type SearchResults = {
  users: { id: string; username: string; displayName: string; accentColor: string }[];
  posts: { id: string; body: string | null; author: { id: string; username: string } }[];
};

export default function SearchPage() {
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [searching, setSearching] = useState(false);

  const runSearch = useCallback(async (query: string) => {
    if (query.trim().length < 2) {
      setResults(null);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      if (res.ok) setResults(await res.json());
    } finally {
      setSearching(false);
    }
  }, []);

  function onChange(value: string) {
    setQ(value);
    runSearch(value);
  }

  if (!user) {
    return <div className="h-screen flex items-center justify-center text-steel text-sm">Sign in to search.</div>;
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-8">
      <h1 className="text-lg font-semibold tracking-tight mb-6">Search</h1>
      <input
        value={q}
        onChange={(e) => onChange(e.target.value)}
        className="vy-input mb-6"
        placeholder="Search people, posts…"
        autoFocus
      />

      {searching && <p className="text-steel text-sm">Searching…</p>}

      {results && (
        <>
          {results.users.length > 0 && (
            <div className="mb-6">
              <h2 className="text-xs uppercase tracking-wide text-steel mb-3">People</h2>
              <ul className="space-y-2">
                {results.users.map((u) => (
                  <li key={u.id}>
                    <Link href={`/profile/${u.username}`} className="vy-panel vy-chamfer p-3 flex items-center gap-3 hover:border-crimson transition-colors">
                      <div className="w-8 h-8 rounded-full shrink-0" style={{ background: u.accentColor }} />
                      <div>
                        <div className="text-sm font-medium">{u.displayName}</div>
                        <div className="text-xs text-steel">@{u.username}</div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {results.posts.length > 0 && (
            <div>
              <h2 className="text-xs uppercase tracking-wide text-steel mb-3">Posts</h2>
              <ul className="space-y-2">
                {results.posts.map((p) => (
                  <li key={p.id} className="vy-panel vy-chamfer p-3">
                    <p className="text-sm">{p.body}</p>
                    <Link href={`/profile/${p.author.username}`} className="text-xs text-steel hover:text-crimson transition-colors">
                      @{p.author.username}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {results.users.length === 0 && results.posts.length === 0 && !searching && (
            <p className="text-steel text-sm">No results for &quot;{q}&quot;.</p>
          )}
        </>
      )}
    </div>
  );
}
