"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getPublicEnv } from "@/lib/config/public";
import type { Database } from "./database.types";

export function createClient() {
  const env = getPublicEnv();
  // This client is for Auth only. Application tables deny browser access.
  return createBrowserClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
}
