import "server-only";
import { createClient } from "@supabase/supabase-js";

/** Service-role client. Server-only; bypasses RLS — use sparingly and check roles first. */
export function createAdminClient() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error("SUPABASE_SECRET_KEY is not set");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
