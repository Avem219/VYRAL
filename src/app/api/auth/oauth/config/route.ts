import { NextResponse } from "next/server";
import { isGoogleOAuthConfigured } from "@/lib/oauth-google";

export async function GET() {
  return NextResponse.json({ google: isGoogleOAuthConfigured() });
}
