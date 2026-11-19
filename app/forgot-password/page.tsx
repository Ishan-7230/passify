"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useActionState, useState } from "react";
import { requestPasswordReset } from "../../lib/auth/actions";
import { TiltCard } from "../../components/ui/TiltCard";
import type { Workspace } from "../../components/auth/workspace";

function ForgotPasswordContent() {
  const searchParams = useSearchParams();
  const initialWorkspace = (searchParams.get("workspace") as Workspace) || "personal";
  const [workspace, setWorkspace] = useState<Workspace>(
    initialWorkspace === "organization" ? "organization" : "personal"
  );

  const [state, formAction, isPending] = useActionState(requestPasswordReset, undefined);

  const accentColor = workspace === "organization" ? "#00f5ff" : "#ff2d78";

  return (
    <div className="relative z-10 w-full max-w-md">
      <Link
        href={workspace === "organization" ? "/login/organization" : "/login/personal"}
        className="mb-6 inline-block font-pixel text-sm font-bold text-slate-300 transition hover:text-white"
      >
        ← Back to login
      </Link>

      <TiltCard
        glowColor={`${accentColor}80`}
        className="rounded-3xl border-2 p-8 backdrop-blur-md"
        style={{
          borderColor: `${accentColor}80`,
          background: `linear-gradient(135deg, ${accentColor}18 0%, rgba(2,8,23,0.85) 65%)`,
        }}
      >
        <div className="mb-6 text-center">
          <p
            className="font-pixel text-xs font-bold uppercase tracking-[0.3em]"
            style={{ color: accentColor }}
          >
            Security Recovery
          </p>
          <h1 className="mt-3 font-pixel text-3xl font-bold">RESET PASSWORD</h1>
          <p className="mt-2 font-pixel text-xs uppercase tracking-widest text-slate-300">
            Enter your account email to receive a recovery link
          </p>
        </div>

        <form action={formAction} className="space-y-5">
          <div className="space-y-2">
            <label className="block font-pixel text-xs font-bold text-slate-200">
              Workspace Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setWorkspace("personal")}
                className={`rounded-xl border px-3 py-2 font-pixel text-xs font-bold transition ${
                  workspace === "personal"
                    ? "border-pink-500 bg-pink-500/20 text-white"
                    : "border-white/20 bg-slate-900/40 text-slate-400 hover:text-white"
                }`}
              >
                Personal
              </button>
              <button
                type="button"
                onClick={() => setWorkspace("organization")}
                className={`rounded-xl border px-3 py-2 font-pixel text-xs font-bold transition ${
                  workspace === "organization"
                    ? "border-cyan-400 bg-cyan-400/20 text-white"
                    : "border-white/20 bg-slate-900/40 text-slate-400 hover:text-white"
                }`}
              >
                Organization
              </button>
            </div>
            <input type="hidden" name="workspace" value={workspace} />
          </div>

          <div className="space-y-2">
            <label htmlFor="reset-email" className="block font-pixel text-xs font-bold text-slate-200">
              Account Email
            </label>
            <input
              id="reset-email"
              name="email"
              type="email"
              required
              placeholder="user@example.com"
              className="w-full rounded-xl border-2 bg-slate-900/50 px-4 py-3 font-sans text-white outline-none focus:border-white"
              style={{ borderColor: `${accentColor}50` }}
            />
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="btn-neon w-full rounded-xl px-6 py-4 font-pixel text-xs font-bold text-white transition disabled:opacity-50"
            style={{
              background:
                workspace === "organization"
                  ? "linear-gradient(90deg, #00f5ff, #0066ff)"
                  : "linear-gradient(90deg, #ff2d78, #bf00ff)",
            }}
          >
            {isPending ? "GENERATING RECOVERY LINK..." : "SEND RECOVERY LINK →"}
          </button>

          {state?.error && (
            <p className="rounded-xl border border-rose-500/30 bg-rose-950/40 p-3 text-center text-xs text-rose-300" role="alert">
              {state.error}
            </p>
          )}

          {state?.success && (
            <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/40 p-4 text-center">
              <p className="font-pixel text-xs font-bold text-emerald-300">{state.success}</p>
              {state.resetUrl && (
                <div className="mt-3">
                  <Link
                    href={state.resetUrl}
                    className="inline-block rounded-lg bg-emerald-500 px-4 py-2 font-pixel text-xs font-bold text-slate-950 transition hover:bg-emerald-400"
                  >
                    CONTINUE TO PASSWORD RESET →
                  </Link>
                </div>
              )}
            </div>
          )}
        </form>
      </TiltCard>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <main
      className="scanlines relative flex min-h-screen items-center justify-center overflow-hidden px-6 py-12 text-white"
      style={{
        backgroundImage: "url('/arcade-bg.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
      }}
    >
      <div className="pointer-events-none absolute inset-0 bg-slate-950/70" />
      <Suspense fallback={<div className="font-pixel text-sm text-slate-400">Loading recovery...</div>}>
        <ForgotPasswordContent />
      </Suspense>
    </main>
  );
}
