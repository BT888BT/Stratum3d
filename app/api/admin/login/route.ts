import crypto from "crypto";
import { NextResponse } from "next/server";
import { createAdminSession } from "@/lib/admin-auth";
import { checkRateLimit, clearRateLimit } from "@/lib/rate-limit";
import { getTrustedIp, buildRateLimitKey } from "@/lib/trusted-ip";

export async function POST(request: Request) {
  try {
    const ip = getTrustedIp(request);
    const rateLimitKey = await buildRateLimitKey("login", request);

    // Persistent rate limit: 5 attempts per IP+UA per 15 minutes
    const { allowed } = await checkRateLimit(rateLimitKey, 5, 15 * 60 * 1000);
    if (!allowed) {
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

    // #3: Constant-time comparison to prevent timing attacks
    const inputBuf = Buffer.from(password || "");
    const expectedBuf = Buffer.from(process.env.ADMIN_PASSWORD);

    const isCorrect =
      inputBuf.length === expectedBuf.length &&
      crypto.timingSafeEqual(inputBuf, expectedBuf);

    if (!isCorrect) {
      console.warn(`[admin-login] Failed login attempt from ${ip}`);
      return NextResponse.json(
        { error: "Invalid password." },
        { status: 401 }
      );
    }

    // Success — clear rate limit and create session
    await clearRateLimit(rateLimitKey);
    const token = await createAdminSession(ip);

    console.log(`[admin-login] Successful login from ${ip}`);

    const response = NextResponse.json({ success: true });

    response.cookies.set("stratum3d_admin", token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch (err) {
    console.error("[login]", err);
    return NextResponse.json({ error: "Login failed." }, { status: 500 });
  }
}
