"use server";

import { redirect } from "next/navigation";
import { type Workspace, workspaceConfig } from "../../components/auth/workspace";
import { createResetToken, createSession, deleteSession, verifyResetToken } from "./session";
import { authenticateUser, createUser, findUserByEmail, updateUserPassword } from "./users";

export type AuthFormState = { error: string; email: string; name: string } | undefined;

export type ResetRequestState =
  | {
      error?: string;
      success?: string;
      resetUrl?: string;
    }
  | undefined;

export type ResetPasswordState =
  | {
      error?: string;
      success?: string;
    }
  | undefined;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

function parseWorkspace(value: FormDataEntryValue | null): Workspace {
  if (value === "personal" || value === "organization") return value;
  throw new Error("Invalid workspace");
}

function readFields(formData: FormData) {
  return {
    workspace: parseWorkspace(formData.get("workspace")),
    name: String(formData.get("name") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    password: String(formData.get("password") ?? ""),
  };
}

export async function login(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const { workspace, email, password } = readFields(formData);

  if (!EMAIL_PATTERN.test(email) || !password) {
    return { error: "Enter your email and password.", email, name: "" };
  }

  const user = await authenticateUser(email, password, workspace);
  if (!user) {
    return { error: "Email or password is incorrect.", email, name: "" };
  }

  await createSession({ userId: user.id, name: user.name, email: user.email, workspace });
  redirect(workspaceConfig[workspace].dashboardPath);
}

export async function register(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const { workspace, name, email, password } = readFields(formData);

  if (!name) return { error: "Enter a display name.", email, name };
  if (!EMAIL_PATTERN.test(email)) return { error: "Enter a valid email address.", email, name };
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`, email, name };
  }

  const user = await createUser({ name, email, password, workspace });
  if (!user) {
    return { error: "An account already exists for this email.", email, name };
  }

  await createSession({ userId: user.id, name: user.name, email: user.email, workspace });
  redirect(workspaceConfig[workspace].onboardingPath);
}

export async function logout(formData: FormData) {
  const workspace = parseWorkspace(formData.get("workspace"));
  await deleteSession();
  redirect(workspaceConfig[workspace].loginPath);
}

export async function requestPasswordReset(
  _prev: ResetRequestState,
  formData: FormData
): Promise<ResetRequestState> {
  const workspace = parseWorkspace(formData.get("workspace"));
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (!EMAIL_PATTERN.test(email)) {
    return { error: "Please enter a valid email address." };
  }

  const user = await findUserByEmail(email, workspace);
  if (!user) {
    // Return generic success or specific message for developer ease
    return {
      error: "No account found with this email in the selected workspace.",
    };
  }

  const token = createResetToken(email, workspace);
  const resetUrl = `/reset-password?token=${encodeURIComponent(token)}`;

  return {
    success: "Password reset link generated. Follow the link to set a new password.",
    resetUrl,
  };
}

export async function resetPassword(
  _prev: ResetPasswordState,
  formData: FormData
): Promise<ResetPasswordState> {
  const token = String(formData.get("token") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!token) {
    return { error: "Reset token is missing or malformed." };
  }

  const payload = verifyResetToken(token);
  if (!payload) {
    return { error: "This reset link is invalid or has expired. Please request a new one." };
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    return { error: `New password must be at least ${MIN_PASSWORD_LENGTH} characters.` };
  }

  if (password !== confirmPassword) {
    return { error: "Passwords do not match." };
  }

  const updated = await updateUserPassword(payload.email, payload.workspace, password);
  if (!updated) {
    return { error: "Could not update password. Please try again." };
  }

  redirect(`${workspaceConfig[payload.workspace].loginPath}?reset=success`);
}
