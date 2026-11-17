import "server-only";
import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ApiError } from "@/lib/http/errors";
import { databaseError } from "@/lib/services/database-error";
import { type Workspace, workspaceConfig } from "@/components/auth/workspace";

/** Always ask Auth for the current user. Never authorize from session cookies or metadata. */
export async function getVerifiedUser(): Promise<User | null> {
  try {
    const auth = await createClient({ readOnly: true });
    const { data, error } = await auth.auth.getUser();
    if (error) {
      if (error.name === "AuthSessionMissingError" || error.status === 401 || error.status === 403 || error.status === 400) return null;
      throw new ApiError("UNAVAILABLE", "Authentication is temporarily unavailable.");
    }
    return data.user?.email_confirmed_at ? data.user : null;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError("UNAVAILABLE", "Authentication is temporarily unavailable.");
  }
}

export async function requireUser() {
  const user = await getVerifiedUser();
  if (!user) throw new ApiError("UNAUTHENTICATED", "Please sign in with a confirmed account.");
  return user;
}

/** Provisioning happens on POST/login/callback, never during a page GET. */
export async function requireWorkspacePage(type: Workspace, onboarding = false) {
  const user = await getVerifiedUser();
  if (!user) redirect(workspaceConfig[type].loginPath);
  const { data: workspace, error } = await createAdminClient().from("workspaces").select("*").eq("owner_id", user.id).eq("workspace_type", type).maybeSingle();
  if (error) databaseError(error);
  if (!workspace) redirect(workspaceConfig[type].loginPath);
  if (!onboarding && !workspace.onboarding_completed) redirect(workspaceConfig[type].onboardingPath);
  return { user, workspace };
}

export async function requireSession(type: Workspace) { return requireWorkspacePage(type); }

export async function getAuthPageState(type: Workspace) {
  const user = await getVerifiedUser();
  if (!user) return false;
  const { data, error } = await createAdminClient().from("workspaces").select("onboarding_completed")
    .eq("owner_id", user.id).eq("workspace_type", type).maybeSingle();
  if (error) databaseError(error);
  if (data) redirect(data.onboarding_completed ? workspaceConfig[type].dashboardPath : workspaceConfig[type].onboardingPath);
  return true;
}
