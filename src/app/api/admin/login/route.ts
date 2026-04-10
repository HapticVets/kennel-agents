import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import {
  createAdminSessionToken,
  getAdminCredentials,
  getAdminSessionMaxAgeSeconds,
  getAdminSessionCookieName
} from "@/lib/admin-auth";
import { getSupabaseConfig, isSupabaseAuthConfigured } from "@/lib/supabase-config";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    username?: string;
    password?: string;
  };

  let authenticatedUsername = body.username || "";

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
  } else {
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
  response.cookies.set(getAdminSessionCookieName(), await createAdminSessionToken(authenticatedUsername), {
    httpOnly: true,
    maxAge: getAdminSessionMaxAgeSeconds(),
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/"
  });

  return response;
}
