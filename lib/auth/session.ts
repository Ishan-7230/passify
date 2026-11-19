import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { type Workspace, workspaceConfig } from "../../components/auth/workspace";

const SESSION_COOKIE = "passify_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export type Session = {
  userId: string;
  name: string;
  email: string;
  workspace: Workspace;
  expiresAt: number;
};

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET must be set in .env.local (at least 32 characters).");
  }
  return secret;
}

function sign(payload: string) {
  return createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

export async function createSession(data: Omit<Session, "expiresAt">) {
  const session: Session = { ...data, expiresAt: Date.now() + SESSION_MAX_AGE_SECONDS * 1000 };
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");

  (await cookies()).set(SESSION_COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function getSession(): Promise<Session | null> {
  const value = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!value) return null;

  const [payload, signature] = value.split(".");
  if (!payload || !signature) return null;

  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;

  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Session;
    return session.expiresAt > Date.now() ? session : null;
  } catch {
    return null;
  }
}

export async function deleteSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

/** Redirects to the workspace login page unless the visitor is signed in to that workspace. */
export async function requireSession(workspace: Workspace) {
  const session = await getSession();
  if (!session || session.workspace !== workspace) {
    redirect(workspaceConfig[workspace].loginPath);
  }
  return session;
}

export type ResetTokenPayload = {
  email: string;
  workspace: Workspace;
  expiresAt: number;
};

export function createResetToken(email: string, workspace: Workspace): string {
  const payload: ResetTokenPayload = {
    email,
    workspace,
    expiresAt: Date.now() + 1000 * 60 * 60, // 1 hour validity
  };
  const serialized = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = sign(serialized);
  return `${serialized}.${signature}`;
}

export function verifyResetToken(token: string): ResetTokenPayload | null {
  const [serialized, signature] = token.split(".");
  if (!serialized || !signature) return null;

  const expected = Buffer.from(sign(serialized));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;

  try {
    const payload = JSON.parse(Buffer.from(serialized, "base64url").toString("utf8")) as ResetTokenPayload;
    if (payload.expiresAt <= Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

