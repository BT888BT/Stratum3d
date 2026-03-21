import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // /login is public — let it through
  if (pathname === "/login") {
    return NextResponse.next();
  }

  const sessionCookie = request.cookies.get("stratum3d_admin")?.value;
  const expected = process.env.ADMIN_PASSWORD;

  if (!expected) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (sessionCookie === expected) {
    return NextResponse.next();
  }

  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  matcher: ["/admin/:path*"]
};
