import "server-only";
import Papa from "papaparse";
import { z } from "zod";
import { requireWorkspace } from "@/lib/auth/permissions";
import { ApiError } from "@/lib/http/errors";
import { idempotencyKeySchema } from "@/lib/validation/common";
import { passFieldsSchema } from "@/lib/validation/pass";
import { dateToExpiry } from "@/lib/utils/pass";
import { newPassCredentials, payloadHash } from "@/lib/utils/identifiers";
import { rateLimit } from "./rate-limit.service";
import { databaseError } from "./database-error";

const optionsSchema = z.strictObject({ workspaceId: z.uuid(), templateId: z.string().min(1).max(80), groupId: z.uuid().optional(), idempotencyKey: idempotencyKeySchema, dryRun: z.boolean() });
const headers = ["name", "role", "external_id", "valid_until"];
export type RowError = { row: number; message: string };
export function parseCsv(text: string, timezone: string, templateId: string, groupId?: string) {
  const normalized = text.replace(/^\uFEFF/, "");
  const first = Papa.parse<string[]>(normalized, { preview: 1, skipEmptyLines: "greedy" });
  const names = first.data[0]?.map((name) => name.trim().toLowerCase()) ?? [];
  if (names.length !== 4 || new Set(names).size !== 4 || headers.some((name) => !names.includes(name))) throw new ApiError("INVALID_INPUT", "CSV headers must be name, role, external_id, valid_until with no duplicates.");
  const result = Papa.parse<Record<string, string>>(normalized, { header: true, skipEmptyLines: "greedy", transformHeader: (name) => name.trim().toLowerCase(), dynamicTyping: false });
  if (result.data.length < 1 || result.data.length > 500) throw new ApiError("INVALID_INPUT", "CSV must contain 1–500 data rows.");
  const rowErrors: RowError[] = result.errors.map((error) => ({ row: (error.row ?? 0) + 2, message: "Malformed CSV row." }));
  const seen = new Set<string>();
  const rows: z.infer<typeof passFieldsSchema>[] = [];
  const rowNumbers: number[] = [];
  result.data.forEach((row, index) => {
    try {
      const externalId = row.external_id?.trim();
      if (externalId && seen.has(externalId)) throw new ApiError("INVALID_INPUT", "Duplicate external ID in this file.");
      if (externalId) seen.add(externalId);
      const expiry = row.valid_until?.trim() ? dateToExpiry(row.valid_until.trim(), timezone) : null;
      if (expiry && Date.parse(expiry) <= Date.now()) throw new ApiError("INVALID_INPUT", "Validity date must be in the future.");
      const value = passFieldsSchema.parse({ templateId, holderName: row.name?.trim().replace(/\s+/g, " "), holderTitle: row.role?.trim().replace(/\s+/g, " "),
        ...(externalId ? { externalId } : {}), ...(groupId ? { groupId } : {}), expiresAt: expiry });
      rows.push(value);
      rowNumbers.push(index + 2);
    } catch (error) {
      rowErrors.push({ row: index + 2, message: error instanceof z.ZodError ? "Name/title must be 1–40 characters; external ID up to 20." : error instanceof ApiError ? error.message : "Invalid date. Use a real YYYY-MM-DD date." });
    }
  });
  return { rows, rowNumbers, totalRows: result.data.length, rowErrors };
}

export async function importCsv(input: unknown, file: File) {
  const options = optionsSchema.parse(input);
  const { user, workspace, db } = await requireWorkspace(options.workspaceId);
  if (workspace.workspace_type !== "organization" || !workspace.onboarding_completed) throw new ApiError("INVALID_INPUT", "Complete organization onboarding first.");
  await rateLimit("import", user.id, 10, 600);
  if (file.size > 512 * 1024) throw new ApiError("PAYLOAD_TOO_LARGE", "CSV must be at most 512 KiB.");
  const org = await db.from("organizations").select("timezone").eq("workspace_id", workspace.id).single();
  if (org.error) databaseError(org.error);
  const template = await db.from("templates").select("id").eq("id", options.templateId).eq("workspace_type", "organization").eq("is_active", true).maybeSingle();
  if (template.error) databaseError(template.error);
  if (!template.data) throw new ApiError("INVALID_INPUT", "Choose an active organization template.");
  if (options.groupId) {
    const group = await db.from("groups").select("id").eq("id", options.groupId).eq("workspace_id", workspace.id).maybeSingle();
    if (group.error) databaseError(group.error);
    if (!group.data) throw new ApiError("INVALID_INPUT", "Choose a group from this workspace.");
  }
  const text = await file.text();
  const hash = payloadHash({ text, templateId: options.templateId, groupId: options.groupId ?? null });
  const prior = await db.from("import_jobs").select("*").eq("workspace_id", workspace.id).eq("idempotency_key", options.idempotencyKey).maybeSingle();
  if (prior.error) databaseError(prior.error);
  if (prior.data && !options.dryRun) {
    if (prior.data.payload_hash !== hash) throw new ApiError("CONFLICT", "This import key was already used with different content.");
    return { importId: prior.data.id, totalRows: prior.data.total_rows, created: prior.data.created_count, failed: prior.data.failed_count, rowErrors: prior.data.errors };
  }
  const parsed = parseCsv(text, org.data.timezone, options.templateId, options.groupId);
  const externalIds = parsed.rows.flatMap((row) => row.externalId ? [row.externalId] : []);
  if (externalIds.length) {
    const existing = await db.from("passes").select("external_id").eq("workspace_id", workspace.id).in("external_id", externalIds);
    if (existing.error) databaseError(existing.error);
    const set = new Set(existing.data.map((row) => row.external_id));
    parsed.rows.forEach((row, index) => { if (row.externalId && set.has(row.externalId)) parsed.rowErrors.push({ row: parsed.rowNumbers[index], message: "External ID already exists in this workspace." }); });
  }
  if (options.dryRun || parsed.rowErrors.length) return { dryRun: options.dryRun, totalRows: parsed.totalRows, created: 0, failed: parsed.rowErrors.length ? parsed.totalRows : 0, rowErrors: parsed.rowErrors };
  for (let attempt = 0; attempt < 3; attempt++) {
    const rows = parsed.rows.map((input) => ({ input, ...newPassCredentials() }));
    const result = await db.rpc("import_passes", { p_actor_id: user.id, p_workspace_id: workspace.id, p_key: options.idempotencyKey, p_hash: hash, p_rows: rows });
    if (!result.error) return result.data;
    if (result.error.code === "23505" && /passes_(pass_number|verification_token)_key/.test(result.error.message) && attempt < 2) continue;
    await db.rpc("record_import_failure", { p_actor_id: user.id, p_workspace_id: workspace.id, p_key: options.idempotencyKey, p_hash: hash, p_total: parsed.totalRows });
    databaseError(result.error);
  }
  throw new ApiError("CONFLICT", "Import could not allocate identifiers. Please retry with a new import key.");
}
