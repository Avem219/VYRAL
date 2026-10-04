import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
  return {
    rules: [{ userAgent: "*", allow: ["/", "/profile/", "/post/", "/reel/"], disallow: ["/api/", "/messages", "/express", "/settings", "/saved", "/notifications", "/circles", "/analytics", "/create"] }],
    sitemap: `${base}/sitemap.xml`,
  };
}
