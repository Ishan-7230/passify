import { WorkspaceAuthForm } from "../../../components/auth/WorkspaceAuthForm";
import { getAuthPageState } from "../../../lib/auth/session";

export default async function OrganizationLoginPage() {
  const signedIn = await getAuthPageState("organization");

  return <WorkspaceAuthForm mode="organization" action="login" signedIn={signedIn} />;
}
