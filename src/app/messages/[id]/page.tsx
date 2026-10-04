"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@/components/auth-context";
import { getSocket } from "@/lib/socket-client";

type Message = {
  id: string;
  conversationId: string;
  senderId: string;
  kind: string;
  body: string | null;
  createdAt: string;
};

export default function ConversationPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [draft, setDraft] = useState("");
  const [peerTyping, setPeerTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    fetch(`/api/conversations/${id}/messages`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setMessages(d.items ?? []);
      });

    const socket = getSocket();
    socket.emit("conversation:join", id);
    fetch(`/api/conversations/${id}/read`, { method: "POST" });

    function onMessage(msg: Message) {
      if (msg.conversationId !== id) return;
      setMessages((prev) => (prev ? [...prev, msg] : [msg]));
      if (msg.senderId !== user!.id) {
        fetch(`/api/conversations/${id}/read`, { method: "POST" });
      }
    }
    function onTyping(t: { conversationId: string; userId: string; typing: boolean }) {
      if (t.conversationId !== id || t.userId === user!.id) return;
      setPeerTyping(t.typing);
    }

    socket.on("message:new", onMessage);
    socket.on("typing:update", onTyping);

    return () => {
      cancelled = true;
      socket.emit("conversation:leave", id);
      socket.off("message:new", onMessage);
      socket.off("typing:update", onTyping);
    };
  }, [id, user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleDraftChange(value: string) {
    setDraft(value);
    const socket = getSocket();
    socket.emit("typing:start", id);
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => socket.emit("typing:stop", id), 1500);
  }

  function send() {
    if (!draft.trim()) return;
    const socket = getSocket();
    socket.emit("message:send", { conversationId: id, body: draft }, (ack: { ok: boolean }) => {
      if (ack.ok) setDraft("");
    });
    socket.emit("typing:stop", id);
  }

  if (!user) return null;

  return (
    <div className="h-screen flex flex-col max-w-xl mx-auto">
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-2">
        {messages === null ? (
          <p className="text-steel text-sm">Loading…</p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`flex ${m.senderId === user.id ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[75%] px-3 py-2 text-sm vy-chamfer-sm ${
                  m.senderId === user.id ? "bg-crimson text-white" : "vy-panel"
                }`}
              >
                {m.body}
              </div>
            </div>
          ))
        )}
        {peerTyping && <p className="text-xs text-steel">typing…</p>}
        <div ref={bottomRef} />
      </div>

      <div className="border-t vy-hairline p-3 flex gap-2">
        <input
          value={draft}
          onChange={(e) => handleDraftChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Message…"
          className="vy-input"
        />
        <button onClick={send} disabled={!draft.trim()} className="vy-btn-primary shrink-0">
          Send
        </button>
      </div>
    </div>
  );
}
