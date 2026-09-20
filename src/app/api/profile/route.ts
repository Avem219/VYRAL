import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/require-auth";

const SafeUrl = z.string().url().max(1000).refine((value) => {
  try {
    const protocol = new URL(value).protocol;
    return protocol === "https:" || protocol === "http:";
  } catch {
    return false;
  }
}, "URL must use http or https");

const Schema = z.object({
  displayName: z.string().min(1).max(60).optional(),
  bio: z.string().max(500).optional(),
  theme: z.enum(["minimal", "obsidian", "signal", "aerodynamic", "immersive"]).optional(),
  accentColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  discoverability: z.enum(["everyone", "connections", "discoverable", "nobody"]).optional(),
  proximityDiscoverable: z.boolean().optional(),
  layout: z.string().max(4000).optional(),
  profileMusicUrl: SafeUrl.nullable().optional(),
});

export async function PATCH(req: NextRequest) {
  const { user, res } = await requireUser();
  if (!user) return res;

  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });

  const [updated] = await db
    .update(schema.profiles)
    .set(parsed.data)
    .where(eq(schema.profiles.userId, user.id))
    .returning();

  return NextResponse.json({ profile: updated });
}
