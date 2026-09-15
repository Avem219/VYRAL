"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/auth-context";

type ProfileData = {
  user: { id: string; username: string };
  profile: {
    displayName: string;
    bio: string | null;
    accentColor: string;
    theme: string;
  } | null;
  interests: string[];
  socialLinks: { id: string; platform: string; url: string }[];
  isSelf: boolean;
  isConnected: boolean;
  followerCount: number;
};

export default function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [data, setData] = useState<ProfileData | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [following, setFollowing] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/users/${username}`);
    if (res.status === 404) {
      setNotFound(true);
      return;
    }
    const d = await res.json();
    setData(d);
  }, [username]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleFollow() {
    if (!data) return;
    const res = await fetch("/api/social/follow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetUserId: data.user.id }),
    });
    if (res.ok) {
      const d = await res.json();
      setFollowing(d.following);
    }
  }

  async function requestConnection() {
    if (!data) return;
    await fetch("/api/social/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "request", targetUserId: data.user.id }),
    });
  }

  async function message() {
    if (!data) return;
    const res = await fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetUserId: data.user.id }),
    });
    if (res.ok) {
      const d = await res.json();
      router.push(`/messages/${d.conversation.id}`);
    }
  }

  if (notFound) {
    return (
      <div className="h-screen flex items-center justify-center text-steel text-sm">
        This profile isn&apos;t available.
      </div>
    );
  }
  if (!data) return null;

  const accent = data.profile?.accentColor ?? "#e11d2e";

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="vy-panel vy-chamfer p-8 mb-6">
        <div className="flex items-start gap-5">
          <div className="w-20 h-20 rounded-full shrink-0" style={{ background: accent }} />
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold tracking-tight">{data.profile?.displayName ?? data.user.username}</h1>
            <p className="text-steel text-sm">@{data.user.username}</p>
            {data.profile?.bio && <p className="text-sm mt-3 leading-relaxed">{data.profile.bio}</p>}
            <p className="text-xs text-steel mt-3">{data.followerCount} followers</p>
          </div>
        </div>

        {!data.isSelf && user && (
          <div className="flex gap-2 mt-6">
            <button onClick={toggleFollow} className="vy-btn-secondary">
              {following ? "Following" : "Follow"}
            </button>
            <button onClick={requestConnection} className="vy-btn-secondary">
              Connect
            </button>
            <button onClick={message} className="vy-btn-secondary">
              Message
            </button>
            <Link href={`/express?to=${data.user.id}`} className="vy-btn-primary">
              Express
            </Link>
          </div>
        )}
        {data.isSelf && (
          <Link href="/settings" className="inline-block mt-6 vy-btn-secondary">
            Edit profile
          </Link>
        )}
      </div>

      {data.interests.length > 0 && (
        <div className="vy-panel vy-chamfer p-6 mb-6">
          <h2 className="text-xs uppercase tracking-wide text-steel mb-3">Interests</h2>
          <div className="flex flex-wrap gap-2">
            {data.interests.map((i) => (
              <span key={i} className="text-xs px-2.5 py-1 bg-obsidian border border-charcoal">
                {i}
              </span>
            ))}
          </div>
        </div>
      )}

      {data.socialLinks.length > 0 && (
        <div className="vy-panel vy-chamfer p-6">
          <h2 className="text-xs uppercase tracking-wide text-steel mb-3">Elsewhere</h2>
          <ul className="space-y-2">
            {data.socialLinks.map((l) => (
              <li key={l.id}>
                <a href={l.url} target="_blank" rel="noreferrer" className="text-sm hover:text-crimson transition-colors">
                  {l.platform}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
