import "server-only";
import { z } from "zod";
import { requireWorkspace } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { ApiError } from "@/lib/http/errors";
import { groupCreateSchema, groupEditSchema, organizationEditSchema } from "@/lib/validation/management";
import { databaseError } from "./database-error";
import { rateLimit } from "./rate-limit.service";

export async function getOrganization(workspaceId: string) {
  const { workspace, db } = await requireWorkspace(workspaceId);
  if (workspace.workspace_type !== "organization") throw new ApiError("INVALID_INPUT", "An organization workspace is required.");
  const { data, error } = await db.from("organizations").select("*").eq("workspace_id", workspace.id).maybeSingle();
  if (error) databaseError(error);
  if (!data) throw new ApiError("NOT_FOUND", "Organization not found.");
  return data;
}
export async function updateOrganization(input: unknown) {
  const { workspaceId, ...fields } = organizationEditSchema.parse(input);
  const { user, db } = await requireWorkspace(workspaceId);
  await rateLimit("organization", user.id, 30, 600);
  const { data, error } = await db.rpc("update_organization", { p_actor_id: user.id, p_workspace_id: workspaceId, p_input: fields });
  if (error) databaseError(error);
  return data;
}
export async function listGroups(workspaceId: string) {
  const { workspace, db } = await requireWorkspace(workspaceId);
  const { data, error } = await db.from("groups").select("*").eq("workspace_id", workspace.id).order("name").limit(1000);
  if (error) databaseError(error);
  return data;
}
export async function createGroup(input: unknown) {
  const { workspaceId, ...fields } = groupCreateSchema.parse(input);
  const { user, db } = await requireWorkspace(workspaceId);
  await rateLimit("groups", user.id, 60, 600);
  const { data, error } = await db.rpc("save_group", { p_actor_id: user.id, p_workspace_id: workspaceId, p_group_id: null, p_input: fields });
  if (error) databaseError(error);
  return data;
}
export async function editGroup(id: string, input: unknown) {
  const user = await requireUser();
  const groupId = z.uuid().parse(id);
  const fields = groupEditSchema.parse(input);
  const db = createAdminClient();
  const owned = await db.from("workspaces").select("id").eq("owner_id", user.id);
  if (owned.error) databaseError(owned.error);
  const { data: group, error } = await db.from("groups").select("workspace_id").eq("id", groupId).in("workspace_id", owned.data.map((row) => row.id)).maybeSingle();
  if (error) databaseError(error);
  if (!group) throw new ApiError("NOT_FOUND", "Group not found.");
  await rateLimit("groups", user.id, 60, 600);
  const result = await db.rpc("save_group", { p_actor_id: user.id, p_workspace_id: group.workspace_id, p_group_id: groupId, p_input: fields });
  if (result.error) databaseError(result.error);
  return result.data;
}
export async function dashboardStats(workspaceId: string) {
  const { user, db } = await requireWorkspace(workspaceId);
  const { data, error } = await db.rpc("dashboard_stats", { p_actor_id: user.id, p_workspace_id: workspaceId });
  if (error) databaseError(error);
  return z.object({ total: z.number(), active: z.number(), expired: z.number(), revoked: z.number() }).parse(data);
}
