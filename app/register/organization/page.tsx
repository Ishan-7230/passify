import { WorkspaceAuthForm } from "../../../components/auth/WorkspaceAuthForm";
import { getAuthPageState } from "../../../lib/auth/session";

export default async function OrganizationRegisterPage() {
  const signedIn = await getAuthPageState("organization");

  return <WorkspaceAuthForm mode="organization" action="register" signedIn={signedIn} />;
}
