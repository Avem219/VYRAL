import type { MetadataRoute } from "next";
export default function robots(): MetadataRoute.Robots { return { rules:{userAgent:"*",allow:["/","/profile/"] ,disallow:["/api/","/messages","/express","/settings","/saved","/notifications","/circles","/analytics","/create"]}, sitemap:"/sitemap.xml" }; }
