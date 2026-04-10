import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import {
  createAdminSessionToken,
  getAdminCredentials,
  getAdminSessionCookieName,
  getAdminSessionMaxAgeSeconds,
  isSupabaseAdminUserAllowed,
  requireHostedSupabaseAdminAuth
} from "@/lib/admin-auth";
import { IS_HOSTED_MODE } from "@/lib/config";
import { getSupabaseConfig, isSupabaseAuthConfigured } from "@/lib/supabase-config";

type LoginRequestBody = {
  email?: string;
  username?: string;
  password?: string;
};

export async function POST(request: Request) {
  const body = (await request.json()) as LoginRequestBody;
  const identity = String(body.email || body.username || "").trim();
  const password = String(body.password || "");

  if (!identity || !password) {
    return NextResponse.json(
      { error: "Email and password are required." },
      { status: 400 }
    );
  }

  if (IS_HOSTED_MODE) {
    try {
      requireHostedSupabaseAdminAuth();
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Hosted admin auth is not configured."
        },
        { status: 500 }
      );
    }
  }

  let authenticatedIdentity = identity;
  let authUid: string | undefined;
  let supabaseAccessToken: string | undefined;

  if (isSupabaseAuthConfigured()) {
    const config = getSupabaseConfig();
    const supabase = createClient(config.url, config.anonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const { data, error } = await supabase.auth.signInWithPassword({
      email: identity,
      password
    });

    if (error || !data.user?.id || !data.user.email || !data.session?.access_token) {
      return NextResponse.json(
        { error: "Invalid Supabase admin credentials." },
        { status: 401 }
      );
    }

    const isAllowedAdmin = await isSupabaseAdminUserAllowed(data.user.id);

    if (!isAllowedAdmin) {
      return NextResponse.json(
        { error: "This authenticated user is not listed in kennel_admins." },
        { status: 403 }
      );
    }

    authenticatedIdentity = data.user.email;
    authUid = data.user.id;
    supabaseAccessToken = data.session.access_token;
  } else {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { error: "Supabase Auth must be configured for hosted admin access." },
        { status: 500 }
      );
    }

    const credentials = getAdminCredentials();

    if (identity !== credentials.username || password !== credentials.password) {
      return NextResponse.json(
        { error: "Invalid admin credentials." },
        { status: 401 }
      );
    }
  }

  const sessionToken = await createAdminSessionToken(authenticatedIdentity, {
    authUid,
    supabaseAccessToken
  });

  const response = NextResponse.json({ success: true });
  response.cookies.set(getAdminSessionCookieName(), sessionToken, {
    httpOnly: true,
    maxAge: getAdminSessionMaxAgeSeconds(),
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/"
  });

  return response;
}
