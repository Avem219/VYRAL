"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/components/auth-context";

type Circle = { id: string; name: string; createdAt: string };

export default function CirclesPage() {
  const { user } = useAuth();
  const [circles, setCircles] = useState<Circle[] | null>(null);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [activeCircle, setActiveCircle] = useState<Circle | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/circles");
    if (res.ok) setCircles((await res.json()).items);
  }, []);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  async function createCircle() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/circles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName }),
      });
      if (res.ok) {
        setNewName("");
        await load();
      }
    } finally {
      setCreating(false);
    }
  }

  async function renameCircle(id: string, name: string) {
    await fetch(`/api/circles/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    await load();
  }

  async function deleteCircle(id: string) {
    if (!confirm("Delete this circle? Its audience selection will be removed from anything using it. This can't be undone.")) return;
    await fetch(`/api/circles/${id}`, { method: "DELETE" });
    setActiveCircle(null);
    await load();
  }

  if (!user) {
    return <div className="h-screen flex items-center justify-center text-steel text-sm">Sign in to manage Close Circles.</div>;
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-8">
      <h1 className="text-lg font-semibold tracking-tight mb-1">Close Circles</h1>
      <p className="text-steel text-sm mb-6">
        Private audience groups for Stories, posts, and Express. Circle membership is never visible to anyone but you.
      </p>

      <div className="vy-panel vy-chamfer p-4 mb-6 flex gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && createCircle()}
          placeholder="New circle name…"
          className="vy-input"
        />
        <button onClick={createCircle} disabled={creating || !newName.trim()} className="vy-btn-primary shrink-0">
          Create
        </button>
      </div>

      {circles === null ? (
        <p className="text-steel text-sm">Loading…</p>
      ) : circles.length === 0 ? (
        <p className="text-steel text-sm">No circles yet — create one above.</p>
      ) : (
        <ul className="space-y-2">
          {circles.map((c) => (
            <li key={c.id}>
              <button
                onClick={() => setActiveCircle(c)}
                className="w-full vy-panel vy-chamfer p-3 flex items-center justify-between text-left hover:border-crimson transition-colors"
              >
                <span className="text-sm font-medium">{c.name}</span>
                <span className="text-xs text-steel">Manage →</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {activeCircle && (
        <CircleDetail
          circle={activeCircle}
          onClose={() => setActiveCircle(null)}
          onRename={(name) => renameCircle(activeCircle.id, name)}
          onDelete={() => deleteCircle(activeCircle.id)}
        />
      )}
    </div>
  );
}

function CircleDetail({
  circle,
  onClose,
  onRename,
  onDelete,
}: {
  circle: Circle;
  onClose: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(circle.name);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ id: string; username: string; displayName: string }[]>([]);
  const [members, setMembers] = useState<{ id: string; username: string }[] | null>(null);

  useEffect(() => {
    fetch(`/api/circles/${circle.id}/members`)
      .then((r) => r.json())
      .then((d) => setMembers(d.members ?? []));
  }, [circle.id]);

  async function search(q: string) {
    setQuery(q);
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
    if (res.ok) setResults((await res.json()).users);
  }

  async function addMember(memberId: string, username: string) {
    const res = await fetch(`/api/circles/${circle.id}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId }),
    });
    if (res.ok) {
      setMembers((prev) => [...(prev ?? []), { id: memberId, username }]);
      setQuery("");
      setResults([]);
    }
  }

  async function removeMember(memberId: string) {
    await fetch(`/api/circles/${circle.id}/members`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId }),
    });
    setMembers((prev) => (prev ?? []).filter((m) => m.id !== memberId));
  }

  return (
    <div className="fixed inset-0 bg-void/90 flex items-center justify-center px-4 z-50">
      <div className="vy-panel vy-chamfer p-6 w-full max-w-sm">
        <div className="flex items-center justify-between mb-4">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => name.trim() && name !== circle.name && onRename(name)}
            className="vy-input text-sm font-medium"
          />
          <button onClick={onClose} className="ml-3 text-steel hover:text-offwhite text-sm shrink-0">
            Done
          </button>
        </div>

        <label className="block mb-2">
          <span className="block text-xs text-steel mb-1.5">Add member</span>
          <input value={query} onChange={(e) => search(e.target.value)} placeholder="Search username…" className="vy-input" />
        </label>
        {results.length > 0 && (
          <ul className="mb-4 space-y-1">
            {results.map((r) => (
              <li key={r.id}>
                <button
                  onClick={() => addMember(r.id, r.username)}
                  className="w-full text-left text-xs px-2 py-1.5 hover:bg-graphite transition-colors"
                >
                  @{r.username} — {r.displayName}
                </button>
              </li>
            ))}
          </ul>
        )}

        {members === null ? (
          <p className="text-xs text-steel mb-4">Loading members…</p>
        ) : members.length === 0 ? (
          <p className="text-xs text-steel mb-4">No members yet.</p>
        ) : (
          <div className="mb-4">
            <span className="block text-xs text-steel mb-1.5">Members</span>
            <ul className="space-y-1">
              {members.map((m) => (
                <li key={m.id} className="flex items-center justify-between text-xs px-2 py-1.5 bg-obsidian">
                  <span>@{m.username}</span>
                  <button onClick={() => removeMember(m.id)} className="text-steel hover:text-crimson">
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <button onClick={onDelete} className="text-xs text-crimson hover:underline">
          Delete this circle
        </button>
      </div>
    </div>
  );
}
