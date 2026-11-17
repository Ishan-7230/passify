import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServerEnv } from "@/lib/config/server";
import { workspaceTypeSchema } from "@/lib/validation/common";
import { provisionWorkspace } from "@/lib/services/workspace.service";
import { authDestination } from "@/lib/auth/redirects";
import { requireUser } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = workspaceTypeSchema.safeParse(url.searchParams.get("workspace"));
  const type = parsed.success ? parsed.data : "personal";
  let destination = `/auth/error?workspace=${type}`;
  try {
    const code = url.searchParams.get("code");
    const flow = url.searchParams.get("flow");
    if (!parsed.success || !code || code.length > 2048 || !["signup", "recovery"].includes(flow ?? "")) throw new Error("Invalid callback");
    const auth = await createClient();
    const { error } = await auth.auth.exchangeCodeForSession(code);
    if (error) throw new Error("Invalid or expired code");
    await requireUser();
    if (flow === "recovery") destination = `/auth/update-password?workspace=${type}`;
    else {
      const workspace = await provisionWorkspace(type);
      destination = authDestination(type, workspace.onboarding_completed);
    }
  } catch { /* Never reflect/log callback codes, provider errors or caller redirects. */ }
  const response = NextResponse.redirect(new URL(destination, getServerEnv().APP_URL), 303);
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("X-Robots-Tag", "noindex");
  return response;
}
