// src/middleware.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Debug log — shows in terminal (dev) or Vercel logs (prod)
  console.log("[middleware] pathname:", pathname);

  const isProtected =
    pathname.startsWith("/dashboard") || pathname.startsWith("/day");

  if (!isProtected) {
    return NextResponse.next();
  }

  const authCookie = req.cookies.get("cadence_auth");
  console.log("[middleware] cadence_auth:", authCookie?.value);

  if (authCookie?.value === "1") {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", req.url);
  loginUrl.searchParams.set("from", pathname);
  console.log("[middleware] redirecting to", loginUrl.toString());
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/dashboard/:path*", "/day/:path*"],
};
