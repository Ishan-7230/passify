import { z } from "zod";
import { withApiErrors } from "@/lib/http/response";
import { readOwnedAsset } from "@/lib/services/storage.service";
import { assetPathSchema } from "@/lib/validation/workspace";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) { return withApiErrors(async () => {
  const query = z.strictObject({ workspaceId: z.uuid(), path: assetPathSchema }).parse(Object.fromEntries(new URL(request.url).searchParams));
  const blob = await readOwnedAsset(query.workspaceId, query.path);
  return new Response(await blob.arrayBuffer(), { headers: { "Content-Type": "image/webp", "Content-Disposition": "inline" } });
}); }
