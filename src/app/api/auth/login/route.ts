import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { verifyPassword, createSession, rateLimit } from "@/lib/auth";

const LoginSchema = z.object({
  identifier: z.string().min(1).max(254), // email or username
  password: z.string().min(1).max(72),
});

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const { allowed } = rateLimit(`login:${ip}`, 20, 60_000);
  if (!allowed) {
    return NextResponse.json({ error: "Too many attempts. Try again shortly." }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const parsed = LoginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const { identifier, password } = parsed.data;
  const lowered = identifier.toLowerCase();

  const rows = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, lowered))
    .limit(1);
  const user =
    rows[0] ??
    (await db.select().from(schema.users).where(eq(schema.users.username, lowered)).limit(1))[0];

  // Constant-shape response whether the account exists or not, to avoid
  // leaking which identifiers are registered.
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return NextResponse.json({ error: "Incorrect email/username or password" }, { status: 401 });
  }
  if (user.suspendedAt) {
    return NextResponse.json({ error: "This account has been suspended." }, { status: 403 });
  }

  await createSession(user.id);

  return NextResponse.json({
    user: { id: user.id, email: user.email, username: user.username },
  });
}
