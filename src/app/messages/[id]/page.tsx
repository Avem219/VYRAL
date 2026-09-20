"use client";

import { useEffect, useRef, useState } from "react";
import { Palette, Send } from "lucide-react";
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
  const [chatTheme, setChatTheme] = useState("carbon");
  const [showThemes, setShowThemes] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const saved = window.localStorage.getItem(`vyral-chat-theme:${id}`);
    if (saved) setChatTheme(saved);
  }, [id]);

  function chooseTheme(theme: string) {
    setChatTheme(theme);
    window.localStorage.setItem(`vyral-chat-theme:${id}`, theme);
    setShowThemes(false);
  }

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

  const themeClass = { carbon: "chat-carbon", crimson: "chat-crimson", glass: "chat-glass", aurora: "chat-aurora" }[chatTheme] ?? "chat-carbon";

  return (
    <div className={`h-screen flex flex-col max-w-3xl mx-auto ${themeClass}`}>
      <header className="vy-topbar sticky top-0 z-20 px-4 py-3 flex items-center justify-between">
        <div><p className="eyebrow">Encrypted conversation</p><h1 className="text-sm font-semibold mt-1">VYRAL Chat</h1></div>
        <div className="relative">
          <button onClick={() => setShowThemes((v) => !v)} className="icon-action" aria-label="Chat themes"><Palette size={18} /></button>
          {showThemes && <div className="absolute right-0 top-12 z-30 vy-glass p-2 w-40 space-y-1">{[["carbon","Carbon"],["crimson","Crimson"],["glass","Glass"],["aurora","Aurora"]].map(([value,label]) => <button key={value} onClick={() => chooseTheme(value)} className={`w-full text-left px-3 py-2 text-xs hover:bg-white/5 ${chatTheme===value?"text-crimson":"text-offwhite"}`}>{label}</button>)}</div>}
        </div>
      </header>
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

      <div className="border-t border-white/5 p-3 flex gap-2 vy-topbar">
        <input
          value={draft}
          onChange={(e) => handleDraftChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Message…"
          className="vy-input"
        />
        <button onClick={send} disabled={!draft.trim()} className="vy-btn-primary shrink-0 inline-flex items-center gap-2">
          <Send size={15} /> Send
        </button>
      </div>
    </div>
  );
}
