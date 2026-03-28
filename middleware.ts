import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import crypto from "crypto";

function generateSessionToken(password: string): string {
  return crypto
    .createHmac("sha256", password)
    .update("stratum3d-admin-session")
    .digest("hex");
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Admin login page and login API are public
  if (pathname === "/login" || pathname === "/admin/login" || pathname === "/api/admin/login") {
    return NextResponse.next();
  }

  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const sessionCookie = request.cookies.get("stratum3d_admin")?.value;
  const expectedToken = generateSessionToken(expected);

  if (sessionCookie === expectedToken) {
    return NextResponse.next();
  }

  // API routes get a 401 JSON response, pages get redirected
  if (pathname.startsWith("/api/admin")) {
    return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  }

  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"]
};
