import { notFound } from "next/navigation";
import { z } from "zod";
import { ApiError } from "@/lib/http/errors";
import { requireWorkspacePage } from "@/lib/auth/session";
import { getPass } from "@/lib/services/pass.service";
import { listGroups } from "@/lib/services/organization.service";
import { workspaceTypeSchema } from "@/lib/validation/common";
import { PassDetailView } from "@/components/pass/PassDetailView";
export default async function PassPage({ params }: { params: Promise<{ mode: string; id: string }> }) {
  const { mode, id } = await params; const parsed = workspaceTypeSchema.safeParse(mode); if (!parsed.success) notFound();
  const { workspace } = await requireWorkspacePage(parsed.data);
  if (!z.uuid().safeParse(id).success) notFound();
  const pass = await getPass(id).catch((error: unknown) => {
    if (error instanceof ApiError && error.code === "NOT_FOUND") notFound();
    throw error;
  });
  if (pass.workspace_id !== workspace.id) notFound();
  return <PassDetailView initialPass={pass} groups={parsed.data === "organization" ? await listGroups(workspace.id) : []} />;
}
