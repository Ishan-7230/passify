"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useActionState } from "react";
import { resetPassword } from "../../lib/auth/actions";
import { TiltCard } from "../../components/ui/TiltCard";

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [state, formAction, isPending] = useActionState(resetPassword, undefined);

  if (!token) {
    return (
      <div className="relative z-10 w-full max-w-md">
        <TiltCard
          glowColor="rgba(255,45,120,0.8)"
          className="rounded-3xl border-2 border-pink-500/80 p-8 text-center backdrop-blur-md"
          style={{ background: "rgba(2,8,23,0.85)" }}
        >
          <h1 className="font-pixel text-2xl font-bold text-rose-300">INVALID RESET LINK</h1>
          <p className="mt-3 text-xs text-slate-300">
            No recovery token was provided. Please request a new password recovery link.
          </p>
          <div className="mt-6">
            <Link
              href="/forgot-password"
              className="btn-neon inline-block rounded-xl px-6 py-3 font-pixel text-xs font-bold text-white"
              style={{ background: "linear-gradient(90deg, #ff2d78, #bf00ff)" }}
            >
              REQUEST NEW LINK →
            </Link>
          </div>
        </TiltCard>
      </div>
    );
  }

  return (
    <div className="relative z-10 w-full max-w-md">
      <TiltCard
        glowColor="rgba(0,245,255,0.8)"
        className="rounded-3xl border-2 border-cyan-400/60 p-8 backdrop-blur-md"
        style={{
          background: "linear-gradient(135deg, rgba(0,245,255,0.1) 0%, rgba(2,8,23,0.85) 65%)",
        }}
      >
        <div className="mb-6 text-center">
          <p className="font-pixel text-xs font-bold uppercase tracking-[0.3em] text-cyan-400">
            Account Recovery
          </p>
          <h1 className="mt-3 font-pixel text-3xl font-bold">SET NEW PASSWORD</h1>
          <p className="mt-2 font-pixel text-xs uppercase tracking-widest text-slate-300">
            Choose a new secure password for your account
          </p>
        </div>

        <form action={formAction} className="space-y-5">
          <input type="hidden" name="token" value={token} />

          <div className="space-y-2">
            <label htmlFor="new-password" className="block font-pixel text-xs font-bold text-slate-200">
              New Password (min 8 chars)
            </label>
            <input
              id="new-password"
              name="password"
              type="password"
              required
              minLength={8}
              placeholder="••••••••"
              className="w-full rounded-xl border-2 border-cyan-500/50 bg-slate-900/50 px-4 py-3 font-sans text-white outline-none focus:border-cyan-300"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="confirm-password" className="block font-pixel text-xs font-bold text-slate-200">
              Confirm New Password
            </label>
            <input
              id="confirm-password"
              name="confirmPassword"
              type="password"
              required
              minLength={8}
              placeholder="••••••••"
              className="w-full rounded-xl border-2 border-cyan-500/50 bg-slate-900/50 px-4 py-3 font-sans text-white outline-none focus:border-cyan-300"
            />
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="btn-neon w-full rounded-xl px-6 py-4 font-pixel text-xs font-bold text-white transition disabled:opacity-50"
            style={{ background: "linear-gradient(90deg, #00f5ff, #0066ff)" }}
          >
            {isPending ? "UPDATING PASSWORD..." : "UPDATE PASSWORD →"}
          </button>

          {state?.error && (
            <p className="rounded-xl border border-rose-500/30 bg-rose-950/40 p-3 text-center text-xs text-rose-300" role="alert">
              {state.error}
            </p>
          )}
        </form>

        <div className="mt-6 text-center">
          <Link href="/get-started" className="font-pixel text-xs text-slate-400 hover:text-white">
            Cancel and return home
          </Link>
        </div>
      </TiltCard>
    </div>
  );
}

export default function ResetPasswordPage() {
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
      <Suspense fallback={<div className="font-pixel text-sm text-slate-400">Loading form...</div>}>
        <ResetPasswordContent />
      </Suspense>
    </main>
  );
}
