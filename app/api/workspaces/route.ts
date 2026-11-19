import { requireUser } from "@/lib/auth/session";
import { assertMutationOrigin, readJson } from "@/lib/http/request";
import { success, withApiErrors } from "@/lib/http/response";
import { workspaceCreateSchema } from "@/lib/validation/workspace";
import { listWorkspaces, provisionWorkspace } from "@/lib/services/workspace.service";
import { rateLimit } from "@/lib/services/rate-limit.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() { return withApiErrors(async () => success(await listWorkspaces())); }
export async function POST(request: Request) {
  return withApiErrors(async () => {
    assertMutationOrigin(request);
    const user = await requireUser();
    await rateLimit("workspace", user.id, 20, 600);
    const body = await readJson(request, workspaceCreateSchema);
    return success(await provisionWorkspace(body.workspaceType));
  });
}
