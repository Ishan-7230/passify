import { workspaceConfig, type Workspace } from "@/components/auth/workspace";

export function authDestination(workspace: Workspace, onboardingCompleted: boolean) {
  return onboardingCompleted ? workspaceConfig[workspace].dashboardPath : workspaceConfig[workspace].onboardingPath;
}

/** Fixed destinations only; no caller-supplied redirect URL is accepted. */
export function callbackUrl(appUrl: string, workspace: Workspace, flow: "signup" | "recovery") {
  const url = new URL("/auth/callback", appUrl);
  url.searchParams.set("workspace", workspace);
  url.searchParams.set("flow", flow);
  return url.toString();
}
