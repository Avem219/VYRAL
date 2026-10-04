import type { Metadata } from "next";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import ProfileClient from "./profile-client";

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }): Promise<Metadata> {
  const { username } = await params;
  const [user] = await db.select().from(schema.users).where(eq(schema.users.username, username.toLowerCase())).limit(1);
  if (!user) return { title: "Profile unavailable · VYRAL" };
  const [profile] = await db.select().from(schema.profiles).where(eq(schema.profiles.userId, user.id)).limit(1);
  const title = `${profile?.displayName || user.username} (@${user.username}) · VYRAL`;
  const description = profile?.bio?.slice(0, 160) || `Discover @${user.username} on VYRAL.`;
  const image = profile?.avatarUrl || undefined;
  return { title, description, alternates: { canonical: `/profile/${user.username}` }, openGraph: { title, description, type: "profile", url: `/profile/${user.username}`, ...(image ? { images: [image] } : {}) }, twitter: { card: image ? "summary_large_image" : "summary", title, description, ...(image ? { images: [image] } : {}) } };
}

export default function ProfilePage() {
  return <ProfileClient />;
}
