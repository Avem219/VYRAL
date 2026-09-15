import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/require-auth";
import { and, eq } from "drizzle-orm";

const Schema = z.object({
  id: z.string().min(1).max(200),
  title: z.string().min(1).max(200),
  artist: z.string().min(1).max(200),
  album: z.string().max(200).optional(),
  artworkUrl: z.string().url().max(2000).nullable().optional(),
  provider: z.literal("spotify"),
  externalUrl: z.string().url().max(1000).refine((u) => new URL(u).hostname === "open.spotify.com", "Track must be a Spotify URL"),
});

export async function POST(req: NextRequest) {
  const { user, res } = await requireUser();
  if (!user) return res;
  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid track" }, { status: 400 });

  const input = parsed.data;
  const [existing] = await db.select().from(schema.tracks)
    .where(and(eq(schema.tracks.provider, input.provider), eq(schema.tracks.externalUrl, input.externalUrl)))
    .limit(1);
  if (existing) return NextResponse.json({ track: existing });

  const [track] = await db.insert(schema.tracks).values({
    title: input.title,
    artist: input.artist,
    provider: input.provider,
    externalUrl: input.externalUrl,
  }).returning();
  return NextResponse.json({ track }, { status: 201 });
}
