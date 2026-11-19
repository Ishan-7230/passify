import { assertMutationOrigin, readJson } from "@/lib/http/request";
import { success, withApiErrors } from "@/lib/http/response";
import { requireUser } from "@/lib/auth/session";
import { editGroup } from "@/lib/services/organization.service";
import { groupEditSchema } from "@/lib/validation/management";
export const runtime = "nodejs";
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) { return withApiErrors(async () => { assertMutationOrigin(request); await requireUser(); return success(await editGroup((await context.params).id, await readJson(request, groupEditSchema))); }); }
