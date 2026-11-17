import { requireWorkspacePage } from "@/lib/auth/session";
import { listPasses } from "@/lib/services/pass.service";
import { dashboardStats, listGroups, getOrganization } from "@/lib/services/organization.service";
import { WorkspaceDashboard } from "@/components/dashboard/WorkspaceDashboard";
export default async function DashboardPage() {
  const { workspace } = await requireWorkspacePage("personal");
  const [list, stats, groups, organization] = await Promise.all([
    listPasses({ workspaceId: workspace.id }), dashboardStats(workspace.id),
    workspace.workspace_type === "organization" ? listGroups(workspace.id) : Promise.resolve([]),
    workspace.workspace_type === "organization" ? getOrganization(workspace.id) : Promise.resolve(null),
  ]);
  return <WorkspaceDashboard mode="personal" workspaceId={workspace.id} initialList={list} initialStats={stats} initialGroups={groups} initialOrganization={organization} />;
}
