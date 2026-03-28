import { NextResponse } from "next/server";
import crypto from "crypto";

// Simple in-memory rate limit for login attempts (per IP)
const attempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || now > entry.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  entry.count++;
  return entry.count <= MAX_ATTEMPTS;
}

/**
 * Generate a session token from the password.
 * This is deterministic so the middleware can verify it without a database,
 * but the actual password is never stored in the cookie.
 */
export function generateSessionToken(password: string): string {
  return crypto
    .createHmac("sha256", password)
    .update("stratum3d-admin-session")
    .digest("hex");
}

export async function POST(request: Request) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: "Too many login attempts. Try again in 15 minutes." },
        { status: 429 }
      );
    }

    const { password } = await request.json();

    if (!process.env.ADMIN_PASSWORD) {
      return NextResponse.json(
        { error: "ADMIN_PASSWORD is not configured." },
        { status: 500 }
      );
    }

    if (!password || password !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json(
        { error: "Invalid password." },
        { status: 401 }
      );
    }

    // Clear rate limit on successful login
    attempts.delete(ip);

    const sessionToken = generateSessionToken(process.env.ADMIN_PASSWORD);

    const response = NextResponse.json({ success: true });

    response.cookies.set("stratum3d_admin", sessionToken, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch {
    return NextResponse.json({ error: "Login failed." }, { status: 500 });
  }
}
