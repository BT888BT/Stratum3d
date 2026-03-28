import crypto from "crypto";
import { cookies } from "next/headers";

/**
 * Must match the token generated in the login route.
 */
function generateSessionToken(password: string): string {
  return crypto
    .createHmac("sha256", password)
    .update("stratum3d-admin-session")
    .digest("hex");
}

/**
 * Check if the current request has a valid admin session.
 * Compares the cookie against a HMAC of the password — the raw
 * password is never stored in the cookie.
 */
export async function isAdminAuthed(): Promise<boolean> {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return false;

  const cookieStore = await cookies();
  const token = cookieStore.get("stratum3d_admin")?.value;
  if (!token) return false;

  const expected = generateSessionToken(password);

  // Constant-time comparison to prevent timing attacks
  if (token.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));
}
