import Link from "next/link";
import { workspaceTypeSchema } from "@/lib/validation/common";

export default async function AuthErrorPage({ searchParams }: { searchParams: Promise<{ workspace?: string }> }) {
  const parsed = workspaceTypeSchema.safeParse((await searchParams).workspace);
  const mode = parsed.success ? parsed.data : "personal";
  return <main className="min-h-screen flex items-center justify-center bg-slate-950 p-6 text-white"><section className="max-w-lg rounded-3xl border border-pink-500/50 p-8">
    <h1 className="font-pixel text-2xl">LINK COULD NOT BE COMPLETED</h1>
    <p className="my-5 text-slate-300">The link may have expired, been used, or been opened in another browser. If your email is confirmed, sign in to continue. Otherwise register again to request a fresh confirmation, or request password recovery.</p>
    <div className="flex flex-wrap gap-4 text-cyan-300"><Link href={`/login/${mode}`}>Sign in</Link><Link href={`/register/${mode}`}>Register</Link><Link href={`/auth/forgot-password?workspace=${mode}`}>Recover account</Link></div>
  </section></main>;
}
