// lib/apiAuth.ts
import type { NextRequest } from "next/server";

const CLIENT_API_KEY = process.env.CADENCE_CLIENT_API_KEY;

/**
 * Allow either:
 * - Logged-in browser (cadence_auth cookie)
 * - Client (iOS) with correct x-cadence-api-key header
 */
export function verifyRequestAuthorized(req: NextRequest): boolean {
  // Option 1: password-authenticated browser
  const authCookie = req.cookies.get("cadence_auth");
  if (authCookie?.value === "1") {
    return true;
  }

  // Option 2: API key from native client
  if (!CLIENT_API_KEY) {
    console.error("CADENCE_CLIENT_API_KEY is not set");
    return false;
  }

  const header = req.headers.get("x-cadence-api-key");
  return header === CLIENT_API_KEY;
}
