import { requireUser } from "@/lib/auth/session";
import { assertMutationOrigin } from "@/lib/http/request";
import { readMultipart } from "@/lib/http/multipart";
import { ApiError } from "@/lib/http/errors";
import { success, withApiErrors } from "@/lib/http/response";
import { importCsv } from "@/lib/services/csv.service";
export const runtime = "nodejs";
export async function POST(request: Request) { return withApiErrors(async () => {
  assertMutationOrigin(request); await requireUser();
  const form = await readMultipart(request, 512 * 1024 + 16 * 1024);
  const allowed = new Set(["file","workspaceId","templateId","groupId","idempotencyKey","dryRun"]);
  for (const key of form.keys()) if (!allowed.has(key) || form.getAll(key).length !== 1) throw new ApiError("INVALID_INPUT", "Invalid import fields.");
  const file = form.get("file");
  if (!(file instanceof File) || !["true","false"].includes(String(form.get("dryRun")))) throw new ApiError("INVALID_INPUT", "CSV file and dryRun flag required.");
  return success(await importCsv({ workspaceId: form.get("workspaceId"), templateId: form.get("templateId"), idempotencyKey: form.get("idempotencyKey"),
    dryRun: form.get("dryRun") === "true", ...(form.get("groupId") ? { groupId: form.get("groupId") } : {}) }, file));
}); }
