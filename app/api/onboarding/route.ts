import { requireUser } from "@/lib/auth/session";
import { assertMutationOrigin, readJson } from "@/lib/http/request";
import { success, withApiErrors } from "@/lib/http/response";
import { onboardingSchema } from "@/lib/validation/workspace";
import { completeOnboarding } from "@/lib/services/workspace.service";

export const runtime = "nodejs";
export async function PATCH(request: Request) {
  return withApiErrors(async () => {
    assertMutationOrigin(request);
    await requireUser();
    return success(await completeOnboarding(await readJson(request, onboardingSchema)));
  });
}
