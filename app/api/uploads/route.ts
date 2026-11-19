import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { assertMutationOrigin, readJson } from "@/lib/http/request";
import { readMultipart } from "@/lib/http/multipart";
import { ApiError } from "@/lib/http/errors";
import { success, withApiErrors } from "@/lib/http/response";
import { workspaceQuerySchema, assetPathSchema } from "@/lib/validation/workspace";
import { cleanupAbandonedUploads, signOwnedAsset, uploadImage } from "@/lib/services/storage.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  return withApiErrors(async () => {
    assertMutationOrigin(request);
    await requireUser();
    const form = await readMultipart(request);
    const allowed = new Set(["workspaceId", "purpose", "file"]);
    for (const key of form.keys()) if (!allowed.has(key) || form.getAll(key).length !== 1) throw new ApiError("INVALID_INPUT", "Invalid upload fields.");
    const file = form.get("file");
    if (!(file instanceof File)) throw new ApiError("INVALID_INPUT", "Choose an image to upload.");
    return success(await uploadImage({ workspaceId: form.get("workspaceId"), purpose: form.get("purpose") }, file), 201);
  });
}
export async function GET(request: Request) {
  return withApiErrors(async () => {
    await requireUser();
    const query = z.strictObject({ workspaceId: z.uuid(), path: assetPathSchema }).parse(Object.fromEntries(new URL(request.url).searchParams));
    return success(await signOwnedAsset(query.workspaceId, query.path));
  });
}
export async function DELETE(request: Request) {
  return withApiErrors(async () => {
    assertMutationOrigin(request);
    await requireUser();
    const body = await readJson(request, workspaceQuerySchema);
    return success(await cleanupAbandonedUploads(body.workspaceId));
  });
}
