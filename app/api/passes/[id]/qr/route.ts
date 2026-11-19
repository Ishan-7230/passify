import { withApiErrors } from "@/lib/http/response";
import { passQr } from "@/lib/services/pass.service";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) { return withApiErrors(async () => {
  const bytes = await passQr((await context.params).id);
  return new Response(new Uint8Array(bytes), { headers: { "Content-Type": "image/png" } });
}); }
