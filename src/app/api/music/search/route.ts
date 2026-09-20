import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/require-auth";
import { rateLimit } from "@/lib/auth";
import { musicConfigured, searchMusic } from "@/lib/music";

const Schema = z.object({ q: z.string().trim().min(1).max(100) });
export async function GET(req: NextRequest) {
  const { user, res } = await requireUser(); if (!user) return res;
  if (!rateLimit(`music:${user.id}`, 30, 60_000).allowed) return NextResponse.json({ error: "Too many music searches" }, { status: 429 });
  if (!musicConfigured()) return NextResponse.json({ configured: false, items: [] });
  const parsed = Schema.safeParse({ q: req.nextUrl.searchParams.get("q") ?? "" });
  if (!parsed.success) return NextResponse.json({ error: "Enter a music search" }, { status: 400 });
  try { return NextResponse.json({ configured: true, items: await searchMusic(parsed.data.q) }); }
  catch { return NextResponse.json({ error: "Music provider unavailable" }, { status: 502 }); }
}
