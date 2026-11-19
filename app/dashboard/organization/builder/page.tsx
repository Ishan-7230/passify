import { OrganizationPassBuilder } from "@/components/pass/OrganizationPassBuilder";
import { requireWorkspacePage } from "@/lib/auth/session";
import { getOrganization, listGroups } from "@/lib/services/organization.service";
export default async function OrganizationBuilderPage({ searchParams }: { searchParams: Promise<{ template?: string }> }) {
  const { workspace } = await requireWorkspacePage("organization");
  const org = workspace.workspace_type === "organization" ? await getOrganization(workspace.id) : null;
  const groups = org ? await listGroups(workspace.id) : [];
  return <OrganizationPassBuilder workspaceId={workspace.id} templateId={(await searchParams).template ?? null}
    defaultName={workspace.default_pass_name ?? ""} organizationName={org?.name} timezone={org?.timezone ?? "Asia/Kolkata"} groups={groups} />;
}
