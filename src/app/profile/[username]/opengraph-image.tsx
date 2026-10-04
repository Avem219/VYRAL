import { ImageResponse } from "next/og";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";

export const runtime = "nodejs";
export const alt = "VYRAL profile";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const [user] = await db.select().from(schema.users).where(eq(schema.users.username, username.toLowerCase())).limit(1);
  const [profile] = user ? await db.select().from(schema.profiles).where(eq(schema.profiles.userId, user.id)).limit(1) : [];
  const name = profile?.displayName || user?.username || "VYRAL";
  return new ImageResponse(<div style={{ height: "100%", width: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: "72px", background: "#08090b", color: "white", fontFamily: "Arial" }}><div style={{ display: "flex", fontSize: 28, color: "#a4a8b2", letterSpacing: 6 }}>VYRAL</div><div style={{ display: "flex", marginTop: 36, fontSize: 68, fontWeight: 700 }}>{name}</div><div style={{ display: "flex", marginTop: 14, fontSize: 30, color: "#a4a8b2" }}>@{user?.username ?? username}</div><div style={{ display: "flex", marginTop: 34, fontSize: 26, color: "#e11d2e" }}>Your world. Connected.</div></div>, size);
}
