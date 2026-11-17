import { PasswordForm } from "@/components/auth/PasswordForm";
import { workspaceTypeSchema } from "@/lib/validation/common";

export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ workspace?: string }> }) {
  const parsed = workspaceTypeSchema.safeParse((await searchParams).workspace);
  return <PasswordForm mode={parsed.success ? parsed.data : "personal"} />;
}
