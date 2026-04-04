import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Persistent rate limiter backed by Supabase.
 * Works across multiple serverless instances on Vercel.
 *
 * #11: Uses a single atomic SQL RPC function to prevent race conditions
 * under concurrent requests. Falls back to the old read-then-write
 * approach if the RPC doesn't exist yet (pre-migration).
 */
export async function checkRateLimit(
  key: string,
  maxAttempts: number,
  windowMs: number
): Promise<{ allowed: boolean; remaining: number }> {
  const supabase = createAdminClient();
  const windowSeconds = Math.ceil(windowMs / 1000);

  // Try atomic RPC first
  const { data, error } = await supabase.rpc("check_rate_limit_atomic", {
    p_key: key,
    p_max_attempts: maxAttempts,
    p_window_seconds: windowSeconds,
  });

  if (!error && data !== null && data !== undefined) {
    // RPC returns the new count after increment
    const newCount = typeof data === "number" ? data : parseInt(data, 10);
    if (newCount > maxAttempts) {
      return { allowed: false, remaining: 0 };
    }
    return { allowed: true, remaining: maxAttempts - newCount };
  }

  // Fallback: non-atomic approach (for pre-migration compatibility)
  console.warn("[rate-limit] Atomic RPC unavailable, using fallback. Run the migration to fix.");
  const now = new Date();
  const windowEnd = new Date(now.getTime() + windowMs);

  const { data: existing } = await supabase
    .from("rate_limits")
    .select("count, window_end")
    .eq("key", key)
    .single();

  if (!existing || new Date(existing.window_end) < now) {
    await supabase
      .from("rate_limits")
      .upsert({ key, count: 1, window_end: windowEnd.toISOString() }, { onConflict: "key" });
    return { allowed: true, remaining: maxAttempts - 1 };
  }

  const newCount = existing.count + 1;
  await supabase
    .from("rate_limits")
    .update({ count: newCount })
    .eq("key", key);

  if (newCount > maxAttempts) {
    return { allowed: false, remaining: 0 };
  }

  return { allowed: true, remaining: maxAttempts - newCount };
}

export async function clearRateLimit(key: string): Promise<void> {
  const supabase = createAdminClient();
  await supabase.from("rate_limits").delete().eq("key", key);
}
