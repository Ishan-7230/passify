"use client";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { TiltCard } from "@/components/ui/TiltCard";
import { workspaceConfig, type Workspace } from "@/components/auth/workspace";
import { apiRequest } from "@/lib/http/client";
import { useHydrated } from "@/lib/utils/use-hydrated";

type Props = { workspaceId: string; mode: Workspace; initialName: string; initialIndustry?: string; assetPath?: string | null; assetUrl?: string | null };
const inputClass = "w-full rounded-xl border-2 bg-slate-900/50 px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 transition-all font-sans";

export function OnboardingForm({ workspaceId, mode, initialName, initialIndustry = "", assetPath, assetUrl }: Props) {
  const router = useRouter();
  const ready = useHydrated();
  const config = workspaceConfig[mode];
  const organization = mode === "organization";
  const [name, setName] = useState(initialName);
  const [industry, setIndustry] = useState(initialIndustry);
  const [file, setFile] = useState<File | null>(null);
  const [uploadedPath, setUploadedPath] = useState(assetPath);
  const [loading, setLoading] = useState(false);
  const inFlight = useRef(false);
  const [error, setError] = useState("");
  const preview = useMemo(() => file ? URL.createObjectURL(file) : assetUrl, [file, assetUrl]);
  useEffect(() => () => { if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview); }, [preview]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    setLoading(true); setError("");
    try {
      let path = uploadedPath;
      if (file && !path) {
        const data = new FormData(); data.set("workspaceId", workspaceId); data.set("purpose", organization ? "logo" : "avatar"); data.set("file", file);
        path = (await apiRequest<{ path: string }>("/api/uploads", { method: "POST", body: data })).path;
        setUploadedPath(path); // Retry the save without uploading the same file again.
      }
      const body = organization ? { workspaceId, name, industry, ...(path ? { logoPath: path } : {}) }
        : { workspaceId, defaultPassName: name, ...(path ? { avatarPath: path } : {}) };
      await apiRequest("/api/onboarding", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      router.push(config.dashboardPath); router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Save failed. Please retry."); }
    finally { inFlight.current = false; setLoading(false); }
  }

  return <main className="scanlines relative min-h-screen px-6 py-12 text-white overflow-hidden flex items-center justify-center" style={{ backgroundImage: "url('/arcade-bg.jpg')", backgroundSize: "cover", backgroundPosition: "center", backgroundAttachment: "fixed" }}>
    <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(to bottom, rgba(2,8,23,0.7), rgba(2,8,23,0.5), rgba(2,8,23,0.8))" }} />
    <div className="relative z-10 w-full max-w-lg"><TiltCard glowColor={`${config.accent}80`} className="rounded-3xl border-2 p-8 backdrop-blur-md" style={{ borderColor: `${config.accent}80`, background: `linear-gradient(135deg, ${config.accent}18 0%, rgba(2,8,23,0.8) 60%, ${config.accent}18 100%)` }}>
      <div className="text-center mb-8"><h1 className="text-3xl font-bold font-pixel" style={{ textShadow: `0 0 10px #fff, 0 0 20px ${config.accent}` }}>{organization ? "SETUP ORGANIZATION" : "COMPLETE PROFILE"}</h1><p className="mt-2 text-slate-300 font-pixel text-sm uppercase tracking-widest">{organization ? "Organization Setup" : "Complete your profile"}</p></div>
      <form onSubmit={save} className="space-y-5">
        <fieldset disabled={!ready || loading} className="space-y-5">
          <label className="block space-y-2"><span className="block text-sm font-bold font-pixel">{organization ? "Organization Name" : "Default Pass Name"}</span><input value={name} onChange={(e) => setName(e.target.value)} required maxLength={organization ? 100 : 40} className={inputClass} style={{ borderColor: `${config.accent}50` }} placeholder={organization ? "e.g. Acme Corp" : "e.g. John Doe"} /></label>
          {organization && <label className="block space-y-2"><span className="block text-sm font-bold font-pixel">Industry / Category</span><select required value={industry} onChange={(e) => setIndustry(e.target.value)} className={inputClass} style={{ borderColor: `${config.accent}50` }}><option value="">Select industry...</option><option value="tech">Technology</option><option value="edu">Education</option><option value="event">Event Management</option><option value="other">Other</option></select></label>}
          <label className="block space-y-2"><span className="block text-sm font-bold font-pixel">{organization ? "Organization Logo (Optional)" : "Avatar / Photo (Optional)"}</span>
            <input type="file" accept="image/jpeg,image/png,image/webp" className="block w-full rounded-xl border-2 border-dashed p-4 text-sm" style={{ borderColor: `${config.accent}50` }} onChange={(event) => {
              const selected = event.target.files?.[0];
              if (!selected) return;
              setError("");
              if (selected.size > 4 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(selected.type)) { setError("Choose a JPEG, PNG or WebP image up to 4 MiB."); event.target.value = ""; return; }
              setFile(selected); setUploadedPath(null);
            }} />
          </label>
          <p className="text-xs text-slate-400">JPEG, PNG or WebP · Maximum 4 MiB</p>
          {preview && <Image unoptimized src={preview} alt={organization ? "Organization logo preview" : "Avatar preview"} width={120} height={120} className="rounded-xl object-contain" />}
          <button type="submit" disabled={loading} className="btn-neon w-full rounded-xl px-6 py-4 text-sm font-bold text-white font-pixel mt-4" style={{ background: config.gradient, boxShadow: `0 0 20px ${config.accent}66`, opacity: loading ? 0.7 : 1 }}>{loading ? "SAVING..." : "ENTER DASHBOARD →"}</button>
        </fieldset>
        {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
      </form>
    </TiltCard></div>
  </main>;
}
