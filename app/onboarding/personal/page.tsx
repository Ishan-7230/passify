import { OnboardingForm } from "@/components/onboarding/OnboardingForm";
import { requireWorkspacePage } from "@/lib/auth/session";
import { getOnboardingData } from "@/lib/services/workspace.service";

export default async function PersonalOnboarding() {
  const { workspace } = await requireWorkspacePage("personal", true);
  const data = await getOnboardingData(workspace.id);
  return <OnboardingForm workspaceId={workspace.id} mode="personal" initialName={workspace.default_pass_name ?? ""} assetPath={workspace.avatar_path} assetUrl={data.assetUrl} />;
}
