import { success, withApiErrors } from "@/lib/http/response";
import { dashboardStats } from "@/lib/services/organization.service";
import { workspaceQuerySchema } from "@/lib/validation/workspace";
export const dynamic = "force-dynamic";
export async function GET(request: Request) { return withApiErrors(async () => success(await dashboardStats(workspaceQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams)).workspaceId))); }
