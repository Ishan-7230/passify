"use client";
import { useActionState } from "react";
import { logout } from "../../lib/auth/actions";
import type { Workspace } from "./workspace";

export function LogoutButton({ workspace }: { workspace: Workspace }) {
  const [state, action, pending] = useActionState(logout, undefined);
  return (
    <form action={action}>
      <input type="hidden" name="workspace" value={workspace} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-full border-2 border-slate-500/60 px-6 py-3 text-sm font-bold text-slate-200 font-pixel hover:border-white hover:text-white"
      >
        LOG OUT
      </button>
      {state?.error && <p role="alert" className="mt-2 text-sm text-rose-300">{state.error}</p>}
    </form>
  );
}
