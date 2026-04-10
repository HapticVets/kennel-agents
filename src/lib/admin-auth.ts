import { getSupabaseConfig, isSupabaseAuthConfigured } from "@/lib/supabase-config";

const sessionCookieName = "kennel_admin_session";
const sessionDurationMs = 1000 * 60 * 60 * 12;

type AdminSessionPayload = {
  identity: string;
  authUid?: string;
  supabaseAccessToken?: string;
  issuedAt: number;
};

type VerifyAdminSessionOptions = {
  requireSupabaseSession?: boolean;
};

function getSessionSecret(): string {
  const secret = process.env.ADMIN_SESSION_SECRET;

  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("ADMIN_SESSION_SECRET is required in production.");
  }

  return secret || "local-dev-session-secret-change-me";
}

function serializePayload(payload: AdminSessionPayload): string {
  return encodeURIComponent(JSON.stringify(payload));
}

function deserializePayload(value: string): AdminSessionPayload | null {
  try {
    const parsed = JSON.parse(decodeURIComponent(value)) as AdminSessionPayload;

    if (!parsed.identity || !parsed.issuedAt) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function bytesToHex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function safeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) {
    return false;
  }

  let diff = 0;

  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return diff === 0;
}

async function createSignature(value: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(getSessionSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));

  return bytesToHex(signature);
}

function hasHostedSupabaseAdminConfig(): boolean {
  const config = getSupabaseConfig();
  return Boolean(config.url && config.anonKey && config.serviceRoleKey);
}

async function fetchSupabaseUser(
  accessToken: string
): Promise<{ id: string; email: string } | null> {
  const config = getSupabaseConfig();

  if (!config.url || !config.anonKey) {
    return null;
  }

  try {
    const response = await fetch(`${config.url}/auth/v1/user`, {
      headers: {
        apikey: config.anonKey,
        authorization: `Bearer ${accessToken}`
      },
      cache: "no-store"
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as { id?: string; email?: string };

    if (!data.id || !data.email) {
      return null;
    }

    return {
      id: data.id,
      email: data.email
    };
  } catch {
    return null;
  }
}

export async function isSupabaseAdminUserAllowed(authUid: string): Promise<boolean> {
  const config = getSupabaseConfig();

  if (!config.url || !config.serviceRoleKey) {
    return false;
  }

  const query = new URLSearchParams({
    select: "auth_uid",
    auth_uid: `eq.${authUid}`,
    is_active: "eq.true",
    limit: "1"
  });

  try {
    const response = await fetch(
      `${config.url}/rest/v1/kennel_admins?${query.toString()}`,
      {
        headers: {
          apikey: config.serviceRoleKey,
          authorization: `Bearer ${config.serviceRoleKey}`
        },
        cache: "no-store"
      }
    );

    if (!response.ok) {
      return false;
    }

    const data = (await response.json()) as Array<{ auth_uid?: string }>;
    return data.length > 0;
  } catch {
    return false;
  }
}

async function verifyHostedAdminSession(
  payload: AdminSessionPayload
): Promise<boolean> {
  if (
    !payload.supabaseAccessToken ||
    !payload.authUid ||
    !hasHostedSupabaseAdminConfig()
  ) {
    return false;
  }

  const user = await fetchSupabaseUser(payload.supabaseAccessToken);

  if (!user) {
    return false;
  }

  if (
    user.id !== payload.authUid ||
    user.email.toLowerCase() !== payload.identity.toLowerCase()
  ) {
    return false;
  }

  return isSupabaseAdminUserAllowed(user.id);
}

export async function createAdminSessionToken(
  identity: string,
  options?: {
    authUid?: string;
    supabaseAccessToken?: string;
  }
): Promise<string> {
  const payload = serializePayload({
    identity,
    authUid: options?.authUid,
    supabaseAccessToken: options?.supabaseAccessToken,
    issuedAt: Date.now()
  });

  return `${payload}.${await createSignature(payload)}`;
}

export async function verifyAdminSessionToken(
  token: string | undefined,
  options: VerifyAdminSessionOptions = {}
): Promise<boolean> {
  if (!token || !token.includes(".")) {
    return false;
  }

  const lastSeparator = token.lastIndexOf(".");
  const payloadValue = token.slice(0, lastSeparator);
  const signature = token.slice(lastSeparator + 1);
  const payload = deserializePayload(payloadValue);

  if (!payload) {
    return false;
  }

  if (!Number.isFinite(payload.issuedAt) || Date.now() - payload.issuedAt > sessionDurationMs) {
    return false;
  }

  try {
    const expectedSignature = await createSignature(payloadValue);

    if (!safeEqual(signature, expectedSignature)) {
      return false;
    }

    if (!options.requireSupabaseSession) {
      return true;
    }

    return verifyHostedAdminSession(payload);
  } catch {
    return false;
  }
}

export function getAdminCredentials() {
  return {
    username: process.env.ADMIN_USERNAME || "admin",
    password: process.env.ADMIN_PASSWORD || "change-me"
  };
}

export function getAdminSessionCookieName(): string {
  return sessionCookieName;
}

export function getAdminSessionMaxAgeSeconds(): number {
  return sessionDurationMs / 1000;
}

export function requireHostedSupabaseAdminAuth(): void {
  if (process.env.NODE_ENV !== "production") {
    return;
  }

  if (!isSupabaseAuthConfigured() || !hasHostedSupabaseAdminConfig()) {
    throw new Error(
      "Hosted admin auth requires NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY."
    );
  }
}
