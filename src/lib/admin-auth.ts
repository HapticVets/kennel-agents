const sessionCookieName = "kennel_admin_session";
const sessionDurationMs = 1000 * 60 * 60 * 12;

type AdminSessionPayload = {
  identity: string;
  issuedAt: number;
  supabaseAccessToken?: string;
};

function getSessionSecret(): string {
  const secret = process.env.ADMIN_SESSION_SECRET;

  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("ADMIN_SESSION_SECRET is required in production.");
  }

  return secret || "local-dev-session-secret-change-me";
}

export function getAdminCredentials() {
  return {
    username: process.env.ADMIN_USERNAME || "admin",
    password: process.env.ADMIN_PASSWORD || "change-me"
  };
}

function getAllowedAdminEmails(): string[] {
  return (process.env.ADMIN_ALLOWED_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminIdentityAllowed(identity: string): boolean {
  const allowedEmails = getAllowedAdminEmails();

  if (allowedEmails.length === 0) {
    // Local development keeps the simple fallback usable. Hosted production
    // should always set ADMIN_ALLOWED_EMAILS to the owner/partner emails.
    return process.env.NODE_ENV !== "production";
  }

  return allowedEmails.includes(identity.trim().toLowerCase());
}

function bytesToHex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function safeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;

  let diff = 0;

  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return diff === 0;
}

function encodePayload(payload: AdminSessionPayload): string {
  return btoa(JSON.stringify(payload));
}

function decodePayload(value: string): AdminSessionPayload | null {
  try {
    const parsed = JSON.parse(atob(value)) as AdminSessionPayload;

    if (!parsed.identity || !parsed.issuedAt) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

async function createSignature(value: string): Promise<string> {
  // Use Web Crypto instead of Node's crypto module so auth works in Vercel middleware.
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

export async function createAdminSessionToken(
  username: string,
  supabaseAccessToken?: string
): Promise<string> {
  const payload = encodePayload({
    identity: username,
    issuedAt: Date.now(),
    supabaseAccessToken
  });

  return `${payload}.${await createSignature(payload)}`;
}

async function verifySupabaseAccessToken(accessToken: string | undefined): Promise<string | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!accessToken || !supabaseUrl || !anonKey) {
    return null;
  }

  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        apikey: anonKey,
        authorization: `Bearer ${accessToken}`
      }
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as { email?: string };
    return data.email ?? null;
  } catch {
    return null;
  }
}

export async function verifyAdminSessionToken(
  token: string | undefined,
  options: { requireSupabaseSession?: boolean } = {}
): Promise<boolean> {
  if (!token || !token.includes(".")) {
    return false;
  }

  const lastSeparator = token.lastIndexOf(".");
  const payload = token.slice(0, lastSeparator);
  const signature = token.slice(lastSeparator + 1);
  const sessionPayload = decodePayload(payload);

  if (
    !sessionPayload ||
    !isAdminIdentityAllowed(sessionPayload.identity) ||
    !Number.isFinite(sessionPayload.issuedAt) ||
    Date.now() - sessionPayload.issuedAt > sessionDurationMs
  ) {
    return false;
  }

  try {
    const expectedSignature = await createSignature(payload);
    if (!safeEqual(signature, expectedSignature)) {
      return false;
    }

    if (!options.requireSupabaseSession) {
      return true;
    }

    const supabaseEmail = await verifySupabaseAccessToken(
      sessionPayload.supabaseAccessToken
    );

    return Boolean(
      supabaseEmail &&
        supabaseEmail.toLowerCase() === sessionPayload.identity.toLowerCase() &&
        isAdminIdentityAllowed(supabaseEmail)
    );
  } catch {
    return false;
  }
}

export function getAdminSessionCookieName(): string {
  return sessionCookieName;
}

export function getAdminSessionMaxAgeSeconds(): number {
  return sessionDurationMs / 1000;
}
