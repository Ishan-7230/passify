import "server-only";
import { requireUser } from "./session";
import { createAdminClient } from "@/lib/supabase/admin";
import { uuidSchema } from "@/lib/validation/common";
import { ApiError } from "@/lib/http/errors";
import { databaseError } from "@/lib/services/database-error";

export async function requireWorkspace(workspaceId: string) {
  const user = await requireUser();
  const id = uuidSchema.parse(workspaceId);
  const db = createAdminClient();
  const { data: workspace, error } = await db.from("workspaces").select("*").eq("id", id).eq("owner_id", user.id).maybeSingle();
  if (error) databaseError(error);
  if (!workspace) throw new ApiError("NOT_FOUND", "Workspace not found.");
  return { user, workspace, db };
}
