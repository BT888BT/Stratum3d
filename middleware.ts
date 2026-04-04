import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Validate admin session token against the database.
 * This runs in Edge middleware so we create a lightweight client.
 */
async function isValidAdminSession(token: string): Promise<boolean> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );

    const { data, error } = await supabase
      .from("admin_sessions")
      .select("id")
      .eq("token", token)
      .gt("expires_at", new Date().toISOString())
      .single();

    return !error && !!data;
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Admin login is public
  if (pathname === "/login" || pathname === "/admin/login" || pathname === "/api/admin/login") {
    return NextResponse.next();
  }

  // ── CSRF check on admin API mutations ─────────────────────
  if (pathname.startsWith("/api/admin") && request.method !== "GET") {
    const origin = request.headers.get("origin");
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    if (siteUrl && origin) {
      const normalizedOrigin = origin.replace(/\/+$/, "").toLowerCase();
      const normalizedSite = siteUrl.replace(/\/+$/, "").toLowerCase();
      const allowedOrigins = [
        normalizedSite,
        normalizedSite.replace("://www.", "://"),
        normalizedSite.replace("://", "://www."),
      ];
      if (!allowedOrigins.includes(normalizedOrigin)) {
        return NextResponse.json({ error: "CSRF: origin mismatch." }, { status: 403 });
      }
    }
  }

  // ── Session cookie check — now DB-backed (#1) ────────────
  const sessionCookie = request.cookies.get("stratum3d_admin")?.value;

  // Cookie must be a 64-char hex string (quick format pre-check)
  const hasValidFormat = !!sessionCookie && /^[a-f0-9]{64}$/.test(sessionCookie);

  if (hasValidFormat) {
    // #1: Actually verify the token exists in the DB and hasn't expired
    const isValid = await isValidAdminSession(sessionCookie);
    if (isValid) {
      return NextResponse.next();
    }
  }

  // API routes get 401, pages get redirect
  if (pathname.startsWith("/api/admin")) {
    return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  }

  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"]
};
