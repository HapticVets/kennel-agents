import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import {
  createAdminSessionToken,
  getAdminCredentials,
  getAdminSessionMaxAgeSeconds,
  getAdminSessionCookieName,
  isAdminIdentityAllowed
} from "@/lib/admin-auth";
import { getSupabaseConfig, isSupabaseAuthConfigured } from "@/lib/supabase-config";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    username?: string;
    password?: string;
  };

  let authenticatedUsername = body.username || "";
  let supabaseAccessToken: string | undefined;

  if (isSupabaseAuthConfigured()) {
    const config = getSupabaseConfig();
    const supabase = createClient(config.url, config.anonKey);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: body.username || "",
      password: body.password || ""
    });

    if (error || !data.user?.email) {
      return NextResponse.json(
        { error: "Invalid Supabase admin credentials." },
        { status: 401 }
      );
    }

    authenticatedUsername = data.user.email;

    if (!isAdminIdentityAllowed(authenticatedUsername)) {
      return NextResponse.json(
        { error: "This Supabase user is not authorized for kennel admin access." },
        { status: 403 }
      );
    }

    if (!data.session?.access_token) {
      return NextResponse.json(
        { error: "Supabase did not return a valid admin session." },
        { status: 401 }
      );
    }

    supabaseAccessToken = data.session.access_token;
  } else {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { error: "Supabase Auth must be configured for hosted admin access." },
        { status: 500 }
      );
    }

    const credentials = getAdminCredentials();

    if (
      body.username !== credentials.username ||
      body.password !== credentials.password
    ) {
      return NextResponse.json(
        { error: "Invalid admin credentials." },
        { status: 401 }
      );
    }
  }

  const response = NextResponse.json({ success: true });
  const sessionToken = await createAdminSessionToken(authenticatedUsername, supabaseAccessToken);

  response.cookies.set(getAdminSessionCookieName(), sessionToken, {
    httpOnly: true,
    maxAge: getAdminSessionMaxAgeSeconds(),
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/"
  });

  return response;
}
