import { withApiErrors, success } from "@/lib/http/response";
import { verifyPass } from "@/lib/services/verification.service";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  const response = await withApiErrors(async () => {
    const result = await verifyPass((await context.params).token);
    return success(result, result.status === "not_found" ? 404 : 200);
  });
  response.headers.set("X-Robots-Tag", "noindex"); response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
