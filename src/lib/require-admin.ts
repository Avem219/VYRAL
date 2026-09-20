import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db, schema } from "@/db";

/**
 * Always re-reads the role from the database on every request — the role
 * lives on the users table, not in the session cookie or any client-
 * supplied header, so there's no client input that can escalate privilege.
 */
export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) {
    return { user: null, res: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };
  }
  if (user.role !== "admin" && user.role !== "moderator") {
    return { user: null, res: NextResponse.json({ error: "Not authorized" }, { status: 403 }) };
  }
  return { user, res: null };
}

export async function logAudit(actorId: string, action: string, targetType?: string, targetId?: string, metadata?: unknown) {
  await db.insert(schema.auditLog).values({
    actorId,
    action,
    targetType,
    targetId,
    metadata: metadata ? JSON.stringify(metadata) : null,
  });
}
