import "server-only";
import QRCode from "qrcode";
import { requireUser } from "@/lib/auth/session";
import { requireWorkspace } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerEnv } from "@/lib/config/server";
import { ApiError } from "@/lib/http/errors";
import { uuidSchema, idempotencyKeySchema } from "@/lib/validation/common";
import { passCreateSchema, passEditSchema, passListSchema, passListResultSchema, passRecordSchema, type PassDetail } from "@/lib/validation/pass";
import { getPassStatus } from "@/lib/utils/pass";
import { newPassCredentials, payloadHash } from "@/lib/utils/identifiers";
import { rateLimit } from "./rate-limit.service";
import { databaseError } from "./database-error";

export async function requirePass(passId: string) {
  const user = await requireUser();
  const id = uuidSchema.parse(passId);
  const db = createAdminClient();
  const owned = await db.from("workspaces").select("id").eq("owner_id", user.id);
  if (owned.error) databaseError(owned.error);
  if (!owned.data.length) throw new ApiError("NOT_FOUND", "Pass not found.");
  const { data, error } = await db.from("passes").select("*").eq("id", id).in("workspace_id", owned.data.map((workspace) => workspace.id)).maybeSingle();
  if (error) databaseError(error);
  if (!data) throw new ApiError("NOT_FOUND", "Pass not found.");
  return { user, db, pass: passRecordSchema.parse(data) };
}

export async function getPass(passId: string): Promise<PassDetail> {
  const { db, pass } = await requirePass(passId);
  const org = await db.from("organizations").select("timezone").eq("workspace_id", pass.workspace_id).maybeSingle();
  if (org.error) databaseError(org.error);
  const { verification_token, ...safe } = pass;
  return { ...safe, status: getPassStatus(pass), verificationUrl: `${getServerEnv().APP_URL}/verify/${verification_token}`,
    photoUrl: pass.photo_path ? `/api/uploads/content?workspaceId=${pass.workspace_id}&path=${encodeURIComponent(pass.photo_path)}` : null,
    timezone: org.data?.timezone ?? "Asia/Kolkata" };
}

export async function createPass(input: unknown, key: string | null) {
  const body = passCreateSchema.parse(input);
  const idempotencyKey = idempotencyKeySchema.parse(key);
  const { user, workspace, db } = await requireWorkspace(body.workspaceId);
  await rateLimit("issue", user.id, 60, 600);
  const { workspaceId, ...fields } = body;
  for (let attempt = 0; attempt < 3; attempt++) {
    const credentials = newPassCredentials();
    const { data, error } = await db.rpc("issue_pass", { p_actor_id: user.id, p_workspace_id: workspaceId,
      p_input: fields, p_pass_number: credentials.passNumber, p_token: credentials.token,
      p_idempotency_key: idempotencyKey, p_payload_hash: payloadHash(fields) });
    if (!error) {
      const pass = passRecordSchema.parse(data);
      return { id: pass.id, passNumber: pass.pass_number, holderName: pass.holder_name, status: getPassStatus(pass),
        workspaceType: workspace.workspace_type, verificationUrl: `${getServerEnv().APP_URL}/verify/${pass.verification_token}` };
    }
    if (error.code === "23505" && /passes_(pass_number|verification_token)_key/.test(error.message) && attempt < 2) continue;
    databaseError(error);
  }
  throw new ApiError("CONFLICT", "Could not allocate a pass number. Please retry.");
}

export async function listPasses(input: unknown) {
  const { workspaceId, ...filters } = passListSchema.parse(input);
  const { user, db } = await requireWorkspace(workspaceId);
  const { data, error } = await db.rpc("list_passes", { p_actor_id: user.id, p_workspace_id: workspaceId, p_filters: filters });
  if (error) databaseError(error);
  return passListResultSchema.parse(data);
}
export async function editPass(passId: string, input: unknown) {
  const fields = passEditSchema.parse(input);
  const { user, pass, db } = await requirePass(passId);
  await rateLimit("edit", user.id, 60, 600);
  const { error } = await db.rpc("edit_pass", { p_actor_id: user.id, p_pass_id: pass.id, p_input: fields });
  if (error) databaseError(error);
  return getPass(pass.id);
}
export async function revokePass(passId: string, reason: string) {
  const { user, pass, db } = await requirePass(passId);
  await rateLimit("revoke", user.id, 60, 600);
  const { error } = await db.rpc("revoke_pass", { p_actor_id: user.id, p_pass_id: pass.id, p_reason: reason });
  if (error) databaseError(error);
  return getPass(pass.id);
}
export async function passQr(passId: string) {
  const { pass } = await requirePass(passId);
  return QRCode.toBuffer(`${getServerEnv().APP_URL}/verify/${pass.verification_token}`, { type: "png", width: 512, margin: 4, errorCorrectionLevel: "M", color: { dark: "#000000", light: "#ffffff" } });
}
