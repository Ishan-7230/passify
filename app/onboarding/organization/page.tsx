import { OnboardingForm } from "@/components/onboarding/OnboardingForm";
import { requireWorkspacePage } from "@/lib/auth/session";
import { getOnboardingData } from "@/lib/services/workspace.service";

export default async function OrganizationOnboarding() {
  const { workspace } = await requireWorkspacePage("organization", true);
  const data = await getOnboardingData(workspace.id);
  return <OnboardingForm workspaceId={workspace.id} mode="organization" initialName={data.organization?.name ?? ""} initialIndustry={data.organization?.industry ?? ""} assetPath={data.organization?.logo_path} assetUrl={data.assetUrl} />;
}
