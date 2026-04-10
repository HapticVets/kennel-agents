import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import {
  getAdminSessionCookieName,
  verifyAdminSessionToken
} from "@/lib/admin-auth";
import { IS_HOSTED_MODE } from "@/lib/config";

function isProtectedPath(pathname: string): boolean {
  // Protect all /admin paths except /admin/login
  if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
    return true;
  }

  // Protect all non-public API endpoints
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
  console.log("[Middleware] Path requested:", request.nextUrl.pathname);

  if (!isProtectedPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get(getAdminSessionCookieName())?.value;

  const sessionValid = await verifyAdminSessionToken(token, {
    requireSupabaseSession: true // always check in production
  });

  if (sessionValid) {
    return NextResponse.next();
  }

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  // Redirect to login with `next` param for post-login redirect
  const loginUrl = new URL("/admin/login", request.url);
  loginUrl.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

// Ensure middleware runs on /admin pages and API paths
export const config = {
  matcher: ["/admin", "/admin/:path*", "/api/:path*"]
};