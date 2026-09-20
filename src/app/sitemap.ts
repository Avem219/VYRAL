import type { MetadataRoute } from "next";
export default function sitemap(): MetadataRoute.Sitemap { const base=(process.env.NEXT_PUBLIC_APP_URL||"http://localhost:3000").replace(/\/$/,""); return ["/","/explore","/stories","/reels","/search","/login","/register"].map(path=>({url:`${base}${path}`,lastModified:new Date()})); }
