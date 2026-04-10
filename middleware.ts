import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import {
  getAdminSessionCookieName,
  verifyAdminSessionToken
} from "@/lib/admin-auth";
import { IS_HOSTED_MODE } from "@/lib/config";

function isProtectedPath(pathname: string): boolean {
  if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
    return true;
  }

  if (!pathname.startsWith("/api/")) {
    return false;
  }

  // Keep public inventory reads and local-dev image reads open; every other
  // dashboard API is an admin action and should require the admin session.
  return (
    pathname !== "/api/admin/login" &&
    pathname !== "/api/admin/logout" &&
    !pathname.startsWith("/api/public/") &&
    !pathname.startsWith("/api/puppy-images/")
  );
}

export async function middleware(request: NextRequest) {
  if (!isProtectedPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get(getAdminSessionCookieName())?.value;

  if (await verifyAdminSessionToken(token, { requireSupabaseSession: IS_HOSTED_MODE })) {
    return NextResponse.next();
  }

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const loginUrl = new URL("/admin/login", request.url);
  loginUrl.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/admin", "/admin/:path*", "/api/:path*"]
};
