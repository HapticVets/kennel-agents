const sessionCookieName = "kennel_admin_session";
const sessionDurationMs = 1000 * 60 * 60 * 12;

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

export async function createAdminSessionToken(username: string): Promise<string> {
  const payload = `${username}:${Date.now()}`;
  return `${payload}.${await createSignature(payload)}`;
}

export async function verifyAdminSessionToken(token: string | undefined): Promise<boolean> {
  if (!token || !token.includes(".")) {
    return false;
  }

  const lastSeparator = token.lastIndexOf(".");
  const payload = token.slice(0, lastSeparator);
  const signature = token.slice(lastSeparator + 1);
  const payloadSeparator = payload.lastIndexOf(":");
  const issuedAt = Number(payload.slice(payloadSeparator + 1));

  if (!Number.isFinite(issuedAt) || Date.now() - issuedAt > sessionDurationMs) {
    return false;
  }

  try {
    const expectedSignature = await createSignature(payload);
    return safeEqual(signature, expectedSignature);
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
