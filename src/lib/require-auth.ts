import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

/** Returns the current user, or a 401 NextResponse to return early. */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    return { user: null, res: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };
  }
  return { user, res: null };
}
