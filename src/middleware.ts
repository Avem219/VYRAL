import { NextRequest, NextResponse } from "next/server";
import { checkCsrf } from "@/lib/csrf";

export function middleware(req: NextRequest) {
  const csrfRejection = checkCsrf(req);
  if (csrfRejection) return csrfRejection;
  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};
