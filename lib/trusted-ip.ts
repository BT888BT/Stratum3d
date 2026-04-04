/**
 * Extract the client IP address using a trusted method.
 *
 * On Vercel, `x-forwarded-for` is set by their edge network and is trustworthy.
 * On other platforms, you may need to adjust to the platform-specific header.
 *
 * We also incorporate User-Agent as a secondary signal for rate-limit keying
 * so that attackers can't trivially rotate IPs alone.
 */

/**
 * Get the trusted client IP from request headers.
 * Vercel sets x-forwarded-for reliably; for other platforms adjust accordingly.
 */
export function getTrustedIp(request: Request): string {
  // Vercel-specific: x-real-ip is always the true client IP on Vercel
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  // Fallback to first x-forwarded-for entry (trusted on Vercel)
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }

  return "unknown";
}

/**
 * Build a composite rate-limit key from IP + User-Agent hash.
 * This makes it harder to bypass rate limits by rotating just one signal.
 */
export async function buildRateLimitKey(
  prefix: string,
  request: Request
): Promise<string> {
  const ip = getTrustedIp(request);
  const ua = request.headers.get("user-agent") || "none";

  // Create a short hash of user-agent to combine with IP
  const encoder = new TextEncoder();
  const data = encoder.encode(ua);
  const hashBuf = await crypto.subtle.digest("SHA-256", data);
  const hashArr = Array.from(new Uint8Array(hashBuf));
  const uaHash = hashArr.slice(0, 4).map(b => b.toString(16).padStart(2, "0")).join("");

  return `${prefix}:${ip}:${uaHash}`;
}
