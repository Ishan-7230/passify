import { WorkspaceAuthForm } from "../../../components/auth/WorkspaceAuthForm";
import { getAuthPageState } from "../../../lib/auth/session";

export default async function PersonalLoginPage() {
  const signedIn = await getAuthPageState("personal");

  return <WorkspaceAuthForm mode="personal" action="login" signedIn={signedIn} />;
}
