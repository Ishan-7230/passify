import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getPublicEnv } from "@/lib/config/public";
import type { Database } from "@/lib/supabase/database.types";

export async function proxy(request: NextRequest) {
  const env = getPublicEnv();
  let response = NextResponse.next({ request });
  const auth = createServerClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookieOptions: { sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookies, cacheHeaders) {
        cookies.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(cacheHeaders).forEach(([name, value]) => response.headers.set(name, value));
      },
    },
  });
  try { await auth.auth.getUser(); }
  catch { /* Services/pages still verify identity and fail closed if Auth is unavailable. */ }
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  if (request.cookies.has("passify_session")) response.cookies.delete("passify_session");
  return response;
}

export const config = {
  matcher: ["/dashboard/:path*", "/onboarding/:path*", "/login/:path*", "/register/:path*", "/auth/:path*", "/api/workspaces/:path*", "/api/onboarding/:path*", "/api/uploads/:path*", "/api/passes/:path*", "/api/groups/:path*", "/api/organizations/:path*", "/api/dashboard/:path*"],
};
