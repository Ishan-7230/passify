import Link from "next/link";
import { verifyPass, type PassStatus } from "../../../lib/passes/verify";
import { TiltCard } from "../../../components/ui/TiltCard";

export const metadata = {
  title: "Pass Verification | Passify",
  description: "Public verification check for Passify digital and physical passes",
};

const STATUS_CONFIG: Record<
  PassStatus,
  {
    badgeText: string;
    glowColor: string;
    borderColor: string;
    textColor: string;
    icon: string;
    description: string;
  }
> = {
  Active: {
    badgeText: "ACTIVE & VERIFIED",
    glowColor: "rgba(57, 255, 20, 0.6)",
    borderColor: "#39ff14",
    textColor: "#39ff14",
    icon: "✓",
    description: "This pass has been verified as authentic, active, and valid in the Passify registry.",
  },
  Expired: {
    badgeText: "PASS EXPIRED",
    glowColor: "rgba(255, 230, 0, 0.6)",
    borderColor: "#ffe600",
    textColor: "#ffe600",
    icon: "⚠",
    description: "This pass has exceeded its validity period and is no longer authorized for entry.",
  },
  Revoked: {
    badgeText: "PASS REVOKED",
    glowColor: "rgba(255, 45, 120, 0.6)",
    borderColor: "#ff2d78",
    textColor: "#ff2d78",
    icon: "✕",
    description: "This pass was manually revoked by an administrator and is strictly invalid.",
  },
  Invalid: {
    badgeText: "INVALID / NOT FOUND",
    glowColor: "rgba(244, 63, 94, 0.6)",
    borderColor: "#f43f5e",
    textColor: "#f43f5e",
    icon: "!",
    description: "No legitimate pass record exists for this identifier. Access denied.",
  },
};

export default async function VerifyPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const result = verifyPass(token);
  const config = STATUS_CONFIG[result.status];

  return (
    <main
      className="scanlines relative flex min-h-screen flex-col items-center justify-center overflow-x-hidden px-4 py-12 text-white sm:px-6"
      style={{
        backgroundImage: "url('/arcade-bg.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
      }}
    >
      <div className="pointer-events-none absolute inset-0 bg-slate-950/85" />

      <div className="relative z-10 w-full max-w-xl">
        {/* Navigation back */}
        <div className="mb-6 flex items-center justify-between">
          <Link
            href="/"
            className="font-pixel text-xs uppercase tracking-widest text-slate-400 transition hover:text-white"
          >
            ← Passify Home
          </Link>
          <span className="font-pixel text-[10px] uppercase tracking-widest text-cyan-400">
            Official Verification Portal
          </span>
        </div>

        {/* Verification Card */}
        <TiltCard
          glowColor={config.glowColor}
          className="rounded-3xl border-2 p-6 backdrop-blur-md sm:p-8"
          style={{
            borderColor: config.borderColor,
            background: "linear-gradient(135deg, rgba(2, 8, 23, 0.95) 0%, rgba(15, 23, 42, 0.9) 100%)",
          }}
        >
          {/* Header Status Badge */}
          <div className="text-center">
            <div
              className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border-2 font-pixel text-2xl font-bold shadow-lg"
              style={{
                borderColor: config.borderColor,
                color: config.textColor,
                boxShadow: `0 0 25px ${config.glowColor}`,
                background: "rgba(0, 0, 0, 0.5)",
              }}
            >
              {config.icon}
            </div>

            <div
              className="mt-4 font-pixel text-lg font-bold tracking-widest sm:text-2xl"
              style={{
                color: config.textColor,
                textShadow: `0 0 15px ${config.textColor}`,
              }}
            >
              {config.badgeText}
            </div>

            <p className="mx-auto mt-2 max-w-md text-xs text-slate-300">
              {config.description}
            </p>
          </div>

          {/* Details Table */}
          <div className="mt-8 space-y-3 rounded-2xl border border-white/10 bg-black/50 p-5 font-sans">
            <div className="flex items-center justify-between border-b border-white/10 pb-2.5 text-xs">
              <span className="font-pixel text-[11px] text-slate-400 uppercase tracking-wider">Pass ID</span>
              <span className="font-mono font-bold text-cyan-300">{result.id}</span>
            </div>

            <div className="flex items-center justify-between border-b border-white/10 pb-2.5 text-xs">
              <span className="font-pixel text-[11px] text-slate-400 uppercase tracking-wider">Holder Name</span>
              <span className="font-bold text-white">{result.name}</span>
            </div>

            <div className="flex items-center justify-between border-b border-white/10 pb-2.5 text-xs">
              <span className="font-pixel text-[11px] text-slate-400 uppercase tracking-wider">Role / Title</span>
              <span className="text-slate-200">{result.role}</span>
            </div>

            <div className="flex items-center justify-between border-b border-white/10 pb-2.5 text-xs">
              <span className="font-pixel text-[11px] text-slate-400 uppercase tracking-wider">Organization</span>
              <span className="font-bold text-cyan-200">{result.organization}</span>
            </div>

            <div className="flex items-center justify-between border-b border-white/10 pb-2.5 text-xs">
              <span className="font-pixel text-[11px] text-slate-400 uppercase tracking-wider">Workspace</span>
              <span className="font-pixel text-[10px] uppercase text-pink-300">
                {result.workspace}
              </span>
            </div>

            <div className="flex items-center justify-between border-b border-white/10 pb-2.5 text-xs">
              <span className="font-pixel text-[11px] text-slate-400 uppercase tracking-wider">Issue Date</span>
              <span className="text-slate-300">{result.issuedAt}</span>
            </div>

            {result.validUntil && (
              <div className="flex items-center justify-between border-b border-white/10 pb-2.5 text-xs">
                <span className="font-pixel text-[11px] text-slate-400 uppercase tracking-wider">Valid Until</span>
                <span
                  className={result.status === "Expired" ? "font-bold text-rose-400" : "text-slate-300"}
                >
                  {result.validUntil}
                </span>
              </div>
            )}

            {result.revokedReason && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-950/40 p-3 text-xs text-rose-300">
                <span className="font-pixel text-[10px] font-bold uppercase tracking-wider">Revocation Notice:</span>
                <p className="mt-1">{result.revokedReason}</p>
              </div>
            )}

            <div className="flex items-center justify-between pt-1 text-[11px] text-slate-400">
              <span className="font-pixel text-[10px] uppercase">Verified At</span>
              <span className="font-mono text-[10px] text-slate-300">{result.verificationTimestamp}</span>
            </div>
          </div>

          {/* Verification Assurance Footer */}
          <div className="mt-6 flex flex-col items-center gap-2 border-t border-white/10 pt-4 text-center">
            <div className="flex items-center gap-2 font-pixel text-[10px] tracking-widest text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#39ff14]" />
              CRYPTOGRAPHIC VERIFICATION ACTIVE
            </div>
            <p className="text-[11px] text-slate-400">
              Pass authenticity guaranteed through Passify cryptographic digital badge protocols.
            </p>
          </div>

          {/* Interactive Demo Switcher */}
          <div className="mt-6 rounded-2xl border border-cyan-500/20 bg-slate-900/50 p-4">
            <p className="font-pixel text-[10px] uppercase tracking-wider text-cyan-400">
              Test Status Scenarios (Demo Passes):
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Link
                href="/verify/A-01"
                className="rounded-lg border border-emerald-500/40 bg-emerald-950/30 px-2.5 py-1 text-[11px] font-pixel text-emerald-300 transition hover:bg-emerald-950/60"
              >
                A-01 (Active)
              </Link>
              <Link
                href="/verify/A-02"
                className="rounded-lg border border-emerald-500/40 bg-emerald-950/30 px-2.5 py-1 text-[11px] font-pixel text-emerald-300 transition hover:bg-emerald-950/60"
              >
                A-02 (Visitor Active)
              </Link>
              <Link
                href="/verify/A-03"
                className="rounded-lg border border-yellow-500/40 bg-yellow-950/30 px-2.5 py-1 text-[11px] font-pixel text-yellow-300 transition hover:bg-yellow-950/60"
              >
                A-03 (Expired)
              </Link>
              <Link
                href="/verify/A-04"
                className="rounded-lg border border-rose-500/40 bg-rose-950/30 px-2.5 py-1 text-[11px] font-pixel text-rose-300 transition hover:bg-rose-950/60"
              >
                A-04 (Revoked)
              </Link>
            </div>
          </div>
        </TiltCard>
      </div>
    </main>
  );
}
