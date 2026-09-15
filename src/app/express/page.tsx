"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth-context";

type ExpressItem = {
  id: string;
  senderId: string;
  recipientId: string;
  kind: string;
  body: string | null;
  createdAt: string;
  openedAt: string | null;
  expiresAt: string | null;
};

export default function ExpressPage() {
  return (
    <Suspense fallback={null}>
      <ExpressPageInner />
    </Suspense>
  );
}

function ExpressPageInner() {
  const { user } = useAuth();
  const params = useSearchParams();
  const [tab, setTab] = useState<"inbox" | "sent">("inbox");
  const [items, setItems] = useState<ExpressItem[] | null>(null);
  const [recipientId, setRecipientId] = useState(params.get("to") ?? "");
  const [body, setBody] = useState("");
  const [expiration, setExpiration] = useState<"24h" | "7d" | "30d" | "never">("never");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/express?folder=${tab}`);
    if (res.ok) setItems((await res.json()).items);
  }, [tab]);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  async function send() {
    setError(null);
    setSending(true);
    try {
      const res = await fetch("/api/express", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientId, kind: "text", body, expiration }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
        return;
      }
      setBody("");
      if (tab === "sent") load();
    } finally {
      setSending(false);
    }
  }

  if (!user) {
    return <div className="h-screen flex items-center justify-center text-steel text-sm">Sign in to use Express.</div>;
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-8">
      <h1 className="text-lg font-semibold tracking-tight mb-1">Express</h1>
      <p className="text-xs text-steel mb-6">
        Only you and the recipient can ever see an Express. It never appears in Feed, Explore, or Search.
      </p>

      <div className="vy-panel vy-chamfer p-4 mb-6">
        <h2 className="text-xs uppercase tracking-wide text-steel mb-3">New Express</h2>
        <input
          value={recipientId}
          onChange={(e) => setRecipientId(e.target.value)}
          placeholder="Recipient user ID"
          className="vy-input mb-3"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write something private…"
          rows={3}
          className="vy-input resize-none mb-3"
        />
        <div className="flex items-center justify-between">
          <select value={expiration} onChange={(e) => setExpiration(e.target.value as typeof expiration)} className="vy-input w-auto text-xs">
            <option value="24h">Expires in 24 hours</option>
            <option value="7d">Expires in 7 days</option>
            <option value="30d">Expires in 30 days</option>
            <option value="never">Never expires</option>
          </select>
          <button onClick={send} disabled={sending || !recipientId || !body.trim()} className="vy-btn-primary">
            {sending ? "Sending…" : "Send"}
          </button>
        </div>
        {error && <p className="text-sm text-crimson mt-2">{error}</p>}
      </div>

      <div className="flex gap-1 mb-4 border-b vy-hairline">
        {(["inbox", "sent"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-2 text-sm capitalize border-b-2 -mb-px ${
              tab === t ? "border-crimson text-offwhite" : "border-transparent text-steel"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {items === null ? (
        <p className="text-steel text-sm">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-steel text-sm">Nothing here.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.id} className="vy-panel vy-chamfer p-4">
              <p className="text-sm">{item.body}</p>
              <p className="text-xs text-steel mt-2">
                {new Date(item.createdAt + "Z").toLocaleString()}
                {item.expiresAt && ` · expires ${new Date(item.expiresAt).toLocaleDateString()}`}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
