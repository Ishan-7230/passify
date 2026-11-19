"use client";
import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordReset, updatePassword } from "@/lib/auth/actions";
import { workspaceConfig, type Workspace } from "./workspace";

export function PasswordForm({ mode, update = false }: { mode: Workspace; update?: boolean }) {
  const [state, action, pending] = useActionState(update ? updatePassword : requestPasswordReset, undefined);
  const config = workspaceConfig[mode];
  return <main className="scanlines min-h-screen flex items-center justify-center p-6 text-white" style={{ backgroundImage: "linear-gradient(#020817cc,#020817ee),url('/arcade-bg.jpg')", backgroundSize: "cover" }}>
    <section className="w-full max-w-md rounded-3xl border-2 bg-slate-950/80 p-8" style={{ borderColor: config.accent }}>
      <h1 className="font-pixel text-2xl font-bold">{update ? "SET NEW PASSWORD" : "RESET PASSWORD"}</h1>
      <p className="my-4 text-sm text-slate-300">{update ? "Choose a new password. You will sign in again after saving." : "We will send you a link to recover your account."}</p>
      <form action={action} className="space-y-5">
        <input type="hidden" name="workspace" value={mode} />
        {update ? <>{["password", "confirmPassword"].map((name) => <label key={name} className="block text-sm">{name === "password" ? "New password" : "Confirm password"}<input name={name} type="password" autoComplete="new-password" required minLength={8} maxLength={128} className="mt-2 w-full rounded-xl border border-white/20 bg-slate-900 px-4 py-3" /></label>)}</>
          : <label className="block text-sm">Email address<input name="email" type="email" autoComplete="email" required maxLength={254} className="mt-2 w-full rounded-xl border border-white/20 bg-slate-900 px-4 py-3" /></label>}
        <button disabled={pending} className="btn-neon w-full rounded-xl px-4 py-3 font-pixel text-sm font-bold" style={{ background: config.gradient }}>{pending ? "PLEASE WAIT..." : update ? "SAVE PASSWORD" : "SEND RECOVERY LINK"}</button>
        {state?.error && <p role="alert" className="text-sm text-rose-300">{state.error}</p>}
        {state?.message && <p role="status" className="text-sm text-cyan-200">{state.message}</p>}
      </form>
      <Link href={config.loginPath} className="mt-6 block text-sm text-slate-300 underline">Back to login</Link>
    </section>
  </main>;
}
