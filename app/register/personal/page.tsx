import { WorkspaceAuthForm } from "../../../components/auth/WorkspaceAuthForm";
import { getAuthPageState } from "../../../lib/auth/session";

export default async function PersonalRegisterPage() {
  const signedIn = await getAuthPageState("personal");

  return <WorkspaceAuthForm mode="personal" action="register" signedIn={signedIn} />;
}
