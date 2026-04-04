import { createClient } from "@supabase/supabase-js";

/**
 * Read-only Supabase client using the anon key.
 * Use this for public-facing routes that only need narrow reads
 * (e.g. colours, gallery) so that a bug doesn't expose service-role access.
 *
 * NOTE: You must create RLS policies on the relevant tables to allow
 * anon SELECT access for this to work. See migration-public-read-policies.sql.
 */
export function createPublicReadClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}
