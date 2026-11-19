import { assertMutationOrigin, readJson } from "@/lib/http/request";
import { success, withApiErrors } from "@/lib/http/response";
import { requireUser } from "@/lib/auth/session";
import { getOrganization, updateOrganization } from "@/lib/services/organization.service";
import { organizationEditSchema } from "@/lib/validation/management";
import { workspaceQuerySchema } from "@/lib/validation/workspace";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) { return withApiErrors(async () => success(await getOrganization(workspaceQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams)).workspaceId))); }
export async function PATCH(request: Request) { return withApiErrors(async () => { assertMutationOrigin(request); await requireUser(); return success(await updateOrganization(await readJson(request, organizationEditSchema))); }); }
