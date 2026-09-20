import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, schema } from "@/db";
import { eq, or } from "drizzle-orm";
import { hashPassword, createSession, rateLimit } from "@/lib/auth";

const RegisterSchema = z.object({
  email: z.string().email().max(254),
  username: z
    .string()
    .min(3)
    .max(24)
    .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores"),
  password: z.string().min(8).max(72),
  displayName: z.string().min(1).max(60),
});

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const { allowed } = rateLimit(`register:${ip}`, 10, 60_000);
  if (!allowed) {
    return NextResponse.json({ error: "Too many attempts. Try again shortly." }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const parsed = RegisterSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const { email, username, password, displayName } = parsed.data;

  const existing = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(or(eq(schema.users.email, email.toLowerCase()), eq(schema.users.username, username.toLowerCase())))
    .limit(1);
  if (existing.length > 0) {
    return NextResponse.json({ error: "Email or username already in use" }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);

  const [user] = await db
    .insert(schema.users)
    .values({ email: email.toLowerCase(), username: username.toLowerCase(), passwordHash })
    .returning();

  await db.insert(schema.profiles).values({
    userId: user.id,
    displayName,
  });

  await db.insert(schema.expressPermissions).values({ userId: user.id });

  await createSession(user.id);

  return NextResponse.json({
    user: { id: user.id, email: user.email, username: user.username },
  });
}
