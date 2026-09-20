import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ user: null }, { status: 200 });

  const [profile] = await db
    .select()
    .from(schema.profiles)
    .where(eq(schema.profiles.userId, user.id))
    .limit(1);

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
    },
    profile: profile ?? null,
  });
}
