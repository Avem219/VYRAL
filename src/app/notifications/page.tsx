"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-context";
import { Heart, UserPlus, MessageSquare, Mail, AtSign, Bell } from "lucide-react";

type Notif = {
  id: string;
  kind: string;
  actor: { id: string; username?: string } | null;
  readAt: string | null;
  createdAt: string;
};

const iconFor: Record<string, typeof Bell> = {
  follow: UserPlus,
  connection: UserPlus,
  like: Heart,
  comment: MessageSquare,
  mention: AtSign,
  message: MessageSquare,
  express: Mail,
};

export default function NotificationsPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<Notif[] | null>(null);

  useEffect(() => {
    if (!user) return;
    fetch("/api/notifications")
      .then((r) => r.json())
      .then((d) => setItems(d.items));
    fetch("/api/notifications", { method: "PATCH" });
  }, [user]);

  if (!user) {
    return <div className="h-screen flex items-center justify-center text-steel text-sm">Sign in to see notifications.</div>;
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-8">
      <h1 className="text-lg font-semibold tracking-tight mb-6">Notifications</h1>

      {items === null ? (
        <p className="text-steel text-sm">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-steel text-sm">You&apos;re all caught up.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((n) => {
            const Icon = iconFor[n.kind] ?? Bell;
            return (
              <li key={n.id} className={`vy-panel vy-chamfer p-4 flex items-center gap-3 ${!n.readAt ? "border-l-2 border-l-crimson" : ""}`}>
                <Icon size={16} className="text-steel shrink-0" />
                <p className="text-sm">
                  {n.actor?.username && <span className="font-medium">@{n.actor.username}</span>} {describe(n.kind)}
                </p>
                <span className="text-xs text-steel ml-auto shrink-0">{new Date(n.createdAt + "Z").toLocaleDateString()}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function describe(kind: string) {
  switch (kind) {
    case "follow":
      return "started following you";
    case "connection":
      return "sent you a connection request";
    case "like":
      return "liked your post";
    case "comment":
      return "commented on your post";
    case "mention":
      return "mentioned you";
    case "message":
      return "sent you a message";
    case "express":
      return "sent you an Express";
    default:
      return "";
  }
}
