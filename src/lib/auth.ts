// lib/auth.ts
//
// Session cookie for the dashboard.
//
// The previous scheme stored the literal string "1", so anyone could type
// `document.cookie = "cadence_auth=1"` and skip the password entirely. This
// signs an expiry with HMAC-SHA256 so a cookie can't be forged or extended.
//
// Uses Web Crypto so the same code runs in Edge middleware and in route handlers.

export const AUTH_COOKIE = "cadence_auth";
export const SESSION_DAYS = 30;

function secretMaterial(): string {
  // A dedicated secret is preferred, but fall back to the password so the app
  // keeps working without new env vars. Rotating the password then invalidates
  // existing sessions, which is the desirable behaviour anyway.
  const secret =
    process.env.CADENCE_AUTH_SECRET || process.env.CADENCE_DASHBOARD_PASSWORD;
  if (!secret) throw new Error("CADENCE_AUTH_SECRET or CADENCE_DASHBOARD_PASSWORD must be set");
  return secret;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sign(payload: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secretMaterial()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return bytesToBase64Url(new Uint8Array(sig));
}

/** Length-independent comparison, to avoid leaking match position via timing. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Mint a signed cookie value that expires SESSION_DAYS from now. */
export async function createSessionToken(): Promise<string> {
  const expiresAt = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  const payload = String(expiresAt);
  return `${payload}.${await sign(payload)}`;
}

/** True only for an unexpired token bearing a valid signature. */
export async function verifySessionToken(
  token: string | undefined | null
): Promise<boolean> {
  if (!token) return false;

  const sep = token.lastIndexOf(".");
  if (sep <= 0) return false;

  const payload = token.slice(0, sep);
  const signature = token.slice(sep + 1);

  const expiresAt = Number(payload);
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return false;

  try {
    return safeEqual(signature, await sign(payload));
  } catch {
    return false;
  }
}

/** Compare a submitted password against the configured one. */
export function checkPassword(submitted: unknown): boolean {
  const expected = process.env.CADENCE_DASHBOARD_PASSWORD;
  if (!expected || typeof submitted !== "string") return false;
  return safeEqual(submitted, expected);
}

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_DAYS * 24 * 60 * 60,
};
