import type { MetadataRoute } from "next";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
  const [users, posts, reels] = await Promise.all([
    db.select({ username: schema.users.username, updatedAt: schema.users.updatedAt }).from(schema.users).limit(5000),
    db.select({ id: schema.posts.id, updatedAt: schema.posts.updatedAt, audience: schema.posts.audience }).from(schema.posts).where(eq(schema.posts.audience, "everyone")).limit(5000),
    db.select({ id: schema.reels.id, updatedAt: schema.reels.updatedAt, audience: schema.reels.audience }).from(schema.reels).where(eq(schema.reels.audience, "everyone")).limit(5000),
  ]);
  return [
    "/", "/explore", "/reels", "/search", "/login", "/register",
    ...users.map((u) => ({ url: `${base}/profile/${u.username}`, lastModified: u.updatedAt ? new Date(u.updatedAt) : new Date() })),
    ...posts.map((p) => ({ url: `${base}/post/${p.id}`, lastModified: p.updatedAt ? new Date(p.updatedAt) : new Date() })),
    ...reels.map((r) => ({ url: `${base}/reel/${r.id}`, lastModified: r.updatedAt ? new Date(r.updatedAt) : new Date() })),
  ].map((item) => typeof item === "string" ? ({ url: `${base}${item}`, lastModified: new Date() }) : item);
}
