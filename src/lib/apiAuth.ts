// lib/apiAuth.ts
import type { NextRequest } from "next/server";

const CLIENT_API_KEY = process.env.CADENCE_CLIENT_API_KEY;

export function verifyClientApiKey(req: NextRequest): boolean {
  if (!CLIENT_API_KEY) {
    console.error("CADENCE_CLIENT_API_KEY is not set");
    return false;
  }
  const header = req.headers.get("x-cadence-api-key");
  return header === CLIENT_API_KEY;
}
