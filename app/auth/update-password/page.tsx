import { redirect } from "next/navigation";
import { PasswordForm } from "@/components/auth/PasswordForm";
import { getVerifiedUser } from "@/lib/auth/session";
import { workspaceTypeSchema } from "@/lib/validation/common";

export default async function UpdatePasswordPage({ searchParams }: { searchParams: Promise<{ workspace?: string }> }) {
  const parsed = workspaceTypeSchema.safeParse((await searchParams).workspace);
  const mode = parsed.success ? parsed.data : "personal";
  if (!await getVerifiedUser()) redirect(`/auth/forgot-password?workspace=${mode}`);
  return <PasswordForm mode={mode} update />;
}
