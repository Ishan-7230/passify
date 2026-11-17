import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getServerEnv } from "@/lib/config/server";
import type { Database } from "./database.types";

/** Bypasses RLS. Call only from services after verified identity and ownership checks. */
export function createAdminClient() {
  const env = getServerEnv();
  return createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) },
  });
}
