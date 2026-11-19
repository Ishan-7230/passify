import { assertMutationOrigin, readJson } from "@/lib/http/request";
import { success, withApiErrors } from "@/lib/http/response";
import { requireUser } from "@/lib/auth/session";
import { getPass, editPass } from "@/lib/services/pass.service";
import { passEditSchema } from "@/lib/validation/pass";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) { return withApiErrors(async () => success(await getPass((await context.params).id))); }
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) { return withApiErrors(async () => {
  assertMutationOrigin(request); await requireUser();
  return success(await editPass((await context.params).id, await readJson(request, passEditSchema)));
}); }
