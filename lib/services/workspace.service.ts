import "server-only";
import { requireUser } from "@/lib/auth/session";
import { requireWorkspace } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { workspaceTypeSchema } from "@/lib/validation/common";
import { onboardingSchema, organizationOnboardingSchema, personalOnboardingSchema, workspaceRecordSchema } from "@/lib/validation/workspace";
import { databaseError } from "./database-error";
import { rateLimit } from "./rate-limit.service";
import { signOwnedAsset } from "./storage.service";

export async function provisionWorkspace(type: unknown) {
  const user = await requireUser();
  const workspaceType = workspaceTypeSchema.parse(type);
  // Metadata supplies only a bounded display name, never identity or permissions.
  const name = typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name.trim().slice(0, 100) : "Passify user";
  const { data, error } = await createAdminClient().rpc("provision_workspace", {
    p_actor_id: user.id, p_workspace_type: workspaceType, p_full_name: name || "Passify user",
  });
  if (error) databaseError(error);
  return workspaceRecordSchema.parse(data);
}

export async function listWorkspaces() {
  const user = await requireUser();
  const { data, error } = await createAdminClient().from("workspaces").select("*").eq("owner_id", user.id).order("created_at");
  if (error) databaseError(error);
  return data;
}

export async function completeOnboarding(input: unknown) {
  const body = onboardingSchema.parse(input);
  const { user, workspace, db } = await requireWorkspace(body.workspaceId);
  await rateLimit("onboarding", user.id, 30, 600);
  const parsed = workspace.workspace_type === "personal" ? personalOnboardingSchema.parse(body) : organizationOnboardingSchema.parse(body);
  const { workspaceId, ...fields } = parsed;
  const { data, error } = await db.rpc("complete_onboarding", { p_actor_id: user.id, p_workspace_id: workspaceId, p_input: fields });
  if (error) databaseError(error);
  return workspaceRecordSchema.parse(data);
}

export async function getOnboardingData(workspaceId: string) {
  const { workspace, db } = await requireWorkspace(workspaceId);
  const { data: organization, error } = await db.from("organizations").select("name,industry,logo_path").eq("workspace_id", workspace.id).maybeSingle();
  if (error) databaseError(error);
  const path = workspace.workspace_type === "personal" ? workspace.avatar_path : organization?.logo_path;
  const asset = path ? await signOwnedAsset(workspace.id, path) : null;
  return { workspace, organization, assetUrl: asset?.url ?? null };
}
