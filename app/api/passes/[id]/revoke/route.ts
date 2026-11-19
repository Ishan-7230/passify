import { assertMutationOrigin, readJson } from "@/lib/http/request";
import { success, withApiErrors } from "@/lib/http/response";
import { requireUser } from "@/lib/auth/session";
import { revokePass } from "@/lib/services/pass.service";
import { revokeSchema } from "@/lib/validation/pass";
export const runtime = "nodejs";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) { return withApiErrors(async () => {
  assertMutationOrigin(request); await requireUser();
  return success(await revokePass((await context.params).id, (await readJson(request, revokeSchema)).reason));
}); }
