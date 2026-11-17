import type { Metadata } from "next";
import { verifyPass } from "@/lib/services/verification.service";
import { ApiError } from "@/lib/http/errors";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Verify pass | Passify", robots: { index: false, follow: false }, referrer: "no-referrer" };
export default async function VerifyPage({ params }: { params: Promise<{ token: string }> }) {
  let result: Awaited<ReturnType<typeof verifyPass>> | null = null;
  let message = "Verification is temporarily unavailable. Please retry shortly.";
  try { result = await verifyPass((await params).token); }
  catch (error) { if (error instanceof ApiError && error.code === "RATE_LIMITED") message = "Too many checks. Please wait a minute and try again."; }
  const color = result?.status === "active" ? "#39ff14" : "#ff2d78";
  return <main className="min-h-screen flex items-center justify-center p-6 text-white" style={{ backgroundImage: "linear-gradient(#020817dd,#020817ee),url('/arcade-bg.jpg')", backgroundSize: "cover" }}><section className="w-full max-w-lg rounded-3xl border-2 bg-slate-950/90 p-8" style={{ borderColor: color }}>
    <p className="font-pixel text-sm text-cyan-300">PASSIFY VERIFICATION</p>
    <h1 className="my-6 font-pixel text-3xl uppercase" style={{ color }}>{result ? result.status.replace("_", " ") : "Unavailable"}</h1>
    {!result ? <p role="alert">{message}</p> : result.status === "not_found" ? <p>This pass was not found. Check the original QR code.</p> : <dl className="space-y-4">
      <div><dt className="text-slate-400">Pass number</dt><dd>{result.passNumber}</dd></div><div><dt className="text-slate-400">Issuer</dt><dd>{result.organization}</dd></div>
      <div><dt className="text-slate-400">Issued</dt><dd>{new Date(result.issuedAt!).toISOString().slice(0, 10)}</dd></div><div><dt className="text-slate-400">Expires (UTC)</dt><dd>{result.expiresAt ? new Date(result.expiresAt).toISOString() : "No expiration"}</dd></div>
    </dl>}
    <p className="mt-8 text-xs text-slate-400">This checks the pass record. It does not verify the identity of the person presenting it.</p>
  </section></main>;
}
