import { NextResponse } from "next/server";
import { createAdminSessionToken } from "@/lib/admin-auth";
import { getSupabaseConfig } from "@/lib/supabase-config";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password } = body;

    const config = getSupabaseConfig();
    if (!config.url || !config.anonKey) {
      return NextResponse.json(
        { error: "Supabase is not configured for hosted mode." },
        { status: 500 }
      );
    }

    // Sign in via Supabase Auth
    const authResp = await fetch(`${config.url}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        apikey: config.anonKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ email, password })
    });

    const authData = await authResp.json();
    if (!authResp.ok || !authData.access_token) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }

    // Check if email exists in kennel_admins
    const adminCheck = await fetch(
      `${config.url}/rest/v1/kennel_admins?select=email&email=eq.${email}&is_active=eq.true`,
      {
        headers: {
          apikey: config.serviceRoleKey,
          authorization: `Bearer ${config.serviceRoleKey}`
        },
        cache: "no-store"
      }
    );
    const admins = await adminCheck.json();
    if (!admins || admins.length === 0) {
      return NextResponse.json({ error: "User is not authorized as admin." }, { status: 403 });
    }

    // Create admin session cookie
    const token = await createAdminSessionToken(email);
    const res = NextResponse.json({ ok: true });
    res.cookies.set({
      name: "kennel_admin_session",
      value: token,
      httpOnly: true,
      path: "/",
      maxAge: 60 * 60 * 12 // 12 hours
    });
    return res;
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Unknown error" }, { status: 500 });
  }
}