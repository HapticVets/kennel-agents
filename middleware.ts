import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { getAdminSessionCookieName, verifyAdminSessionToken } from "@/lib/admin-auth";
import { IS_HOSTED_MODE } from "@/lib/config";

function isProtectedPath(pathname: string): boolean {
  // Only protect admin dashboard pages, except login
  if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
    return true;
  }

  // Protect all non-public API routes
  if (pathname.startsWith("/api/")) {
    return !(
      pathname === "/api/admin/login" ||
      pathname === "/api/admin/logout" ||
      pathname.startsWith("/api/public/") ||
      pathname.startsWith("/api/puppy-images/")
    );
  }

  return false;
}

export async function middleware(request: NextRequest) {
  if (!isProtectedPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get(getAdminSessionCookieName())?.value;

  const isValid = await verifyAdminSessionToken(token, { requireSupabaseSession: IS_HOSTED_MODE });

  if (isValid) {
    return NextResponse.next();
  }

  // For protected API calls
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // For protected admin pages: redirect to login
  const loginUrl = new URL("/admin/login", request.url);
  loginUrl.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/admin/:path*", "/api/:path*"],
};