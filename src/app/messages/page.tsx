"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth-context";
import { getSocket } from "@/lib/socket-client";

type ConversationItem = {
  id: string;
  isGroup: boolean;
  isRequest: boolean;
  unread: boolean;
  lastMessage: { body: string | null; createdAt: string; senderId: string } | null;
  otherUser: { id: string; username: string; displayName?: string } | null;
};

export default function MessagesPage() {
  const { user, loading } = useAuth();
  const [items, setItems] = useState<ConversationItem[] | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    async function load() {
      const res = await fetch("/api/conversations");
      if (res.ok && !cancelled) setItems((await res.json()).items);
    }
    load();

    const socket = getSocket();
    socket.on("notification:new", (payload: { kind: string }) => {
      if (payload.kind === "message") load();
    });
    return () => {
      cancelled = true;
      socket.off("notification:new");
    };
  }, [user]);

  if (loading) return null;
  if (!user) {
    return <div className="h-screen flex items-center justify-center text-steel text-sm">Sign in to see messages.</div>;
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-8">
      <h1 className="text-lg font-semibold tracking-tight mb-6">Messages</h1>

      {items === null ? (
        <p className="text-steel text-sm">Loading…</p>
      ) : items.length === 0 ? (
        <div className="vy-panel vy-chamfer p-8 text-center">
          <p className="text-steel text-sm">
            No conversations yet. Start one from someone&apos;s profile.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((c) => (
            <li key={c.id}>
              <Link
                href={`/messages/${c.id}`}
                className={`vy-panel vy-chamfer p-4 flex items-center gap-3 hover:border-crimson transition-colors ${c.unread ? "border-l-2 border-l-crimson" : ""}`}
              >
                <div className="w-10 h-10 rounded-full bg-charcoal shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">
                    {c.otherUser?.displayName ?? c.otherUser?.username ?? "Conversation"}
                    {c.isRequest && <span className="ml-2 text-xs text-steel">Request</span>}
                  </div>
                  <div className="text-xs text-steel truncate">{c.lastMessage?.body ?? "No messages yet"}</div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
