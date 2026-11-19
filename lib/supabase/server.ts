import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getPublicEnv } from "@/lib/config/public";
import type { Database } from "./database.types";

/** Per-request Auth client. Server Components rely on proxy for cookie refresh. */
export async function createClient({ readOnly = false }: { readOnly?: boolean } = {}) {
  const env = getPublicEnv();
  const cookieStore = await cookies();
  return createServerClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookieOptions: { sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" },
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        if (readOnly) return;
        for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
      },
    },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) },
  });
}
