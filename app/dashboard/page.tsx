import { redirect } from "next/navigation";
import { getSession } from "../../lib/auth/session";

export default async function DashboardRootPage() {
  const session = await getSession();
  if (!session) {
    redirect("/get-started");
  }

  if (session.workspace === "organization") {
    redirect("/dashboard/organization");
  }

  redirect("/dashboard/personal");
}
