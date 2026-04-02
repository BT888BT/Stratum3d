import crypto from "crypto";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Create a new admin session with a random token.
 * Stored in DB so sessions are individually revocable and survive restarts.
 */
export async function createAdminSession(ip: string): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  const supabase = createAdminClient();

  await supabase.from("admin_sessions").insert({
    token,
    ip_address: ip,
    // expires_at defaults to now() + 7 days in the DB
  });

  return token;
}

/**
 * Verify the admin session cookie against stored sessions.
 */
export async function isAdminAuthed(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get("stratum3d_admin")?.value;
  if (!token || token.length !== 64) return false;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("admin_sessions")
    .select("id")
    .eq("token", token)
    .gt("expires_at", new Date().toISOString())
    .single();

  if (error) {
    console.error("[admin-auth] Session check failed:", error.message);
    return false;
  }

  return !!data;
}

/**
 * Revoke a specific session by token.
 */
export async function revokeSession(token: string): Promise<void> {
  const supabase = createAdminClient();
  await supabase.from("admin_sessions").delete().eq("token", token);
}

/**
 * Revoke all admin sessions (e.g. on password change).
 */
export async function revokeAllSessions(): Promise<void> {
  const supabase = createAdminClient();
  await supabase.from("admin_sessions").delete().neq("id", "00000000-0000-0000-0000-000000000000");
}
