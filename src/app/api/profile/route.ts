import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/require-auth";
import { getMediaUrl } from "@/lib/storage";

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
  avatarMediaId: z.string().uuid().optional(),
  profileMusicUrl: z.string().url().max(1000).nullable().optional(),
});

export async function PATCH(req: NextRequest) {
  const { user, res } = await requireUser();
  if (!user) return res;

  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });

  const { avatarMediaId, ...rest } = parsed.data;
  const updates: Partial<typeof schema.profiles.$inferInsert> = { ...rest };

  if (avatarMediaId) {
    const [media] = await db.select().from(schema.media).where(eq(schema.media.id, avatarMediaId)).limit(1);
    if (!media || media.ownerId !== user.id || media.kind !== "image") {
      return NextResponse.json({ error: "Photo not found, not yours, or not an image" }, { status: 403 });
    }
    updates.avatarUrl = await getMediaUrl(media);
  }

  const [updated] = await db.update(schema.profiles).set(updates).where(eq(schema.profiles.userId, user.id)).returning();

  return NextResponse.json({ profile: updated });
}
