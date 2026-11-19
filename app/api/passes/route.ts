import { assertMutationOrigin, readJson } from "@/lib/http/request";
import { success, withApiErrors } from "@/lib/http/response";
import { requireUser } from "@/lib/auth/session";
import { createPass, listPasses } from "@/lib/services/pass.service";
import { passCreateSchema } from "@/lib/validation/pass";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) { return withApiErrors(async () => success(await listPasses(Object.fromEntries(new URL(request.url).searchParams)))); }
export async function POST(request: Request) { return withApiErrors(async () => {
  assertMutationOrigin(request); await requireUser();
  return success(await createPass(await readJson(request, passCreateSchema), request.headers.get("idempotency-key")), 201);
}); }
