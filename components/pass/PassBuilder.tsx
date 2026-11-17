"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { passTemplates } from "./templates";
import { orgTemplates } from "./orgTemplates";
import { PersonalBadgePreview } from "./PersonalBadgePreview";
import { OrgBadgePreview } from "./OrgBadgePreview";
import { apiRequest } from "@/lib/http/client";
import { dateToExpiry } from "@/lib/utils/pass";
import { useHydrated } from "@/lib/utils/use-hydrated";
import { workspaceConfig, type Workspace } from "@/components/auth/workspace";

export type BuilderProps = { workspaceId: string; mode: Workspace; templateId: string | null; defaultName: string; organizationName?: string; timezone: string; groups: { id: string; name: string }[] };
const inputClass = "mt-2 w-full rounded-xl border border-white/20 bg-black/40 px-4 py-3 text-white outline-none focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/30";
export function PassBuilder({ workspaceId, mode, templateId, defaultName, organizationName, timezone, groups }: BuilderProps) {
  const router = useRouter();
  const ready = useHydrated();
  const [name, setName] = useState(defaultName); const [title, setTitle] = useState("");
  const [externalId, setExternalId] = useState(""); const [date, setDate] = useState(""); const [groupId, setGroupId] = useState("");
  const [photo, setPhoto] = useState<File | null>(null); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const lock = useRef(false); const uploaded = useRef<{ file: File; path: string } | null>(null); const receipt = useRef({ body: "", key: "" });
  const photoUrl = useMemo(() => photo ? URL.createObjectURL(photo) : "", [photo]);
  useEffect(() => () => { if (photoUrl) URL.revokeObjectURL(photoUrl); }, [photoUrl]);
  const org = mode === "organization";
  const personalTemplate = passTemplates.find((item) => item.id === templateId) ?? passTemplates[0];
  const orgTemplate = orgTemplates.find((item) => item.id === templateId) ?? orgTemplates[0];
  const selectedId = org ? orgTemplate.id : personalTemplate.id;
  async function issue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (lock.current) return; lock.current = true; setBusy(true); setError("");
    try {
      let path: string | undefined;
      if (!org && !photo) throw new Error("Choose a photo for your personal pass.");
      if (photo) {
        if (uploaded.current?.file === photo) path = uploaded.current.path;
        else { const form = new FormData(); form.set("file", photo); form.set("workspaceId", workspaceId); form.set("purpose", "photo");
          path = (await apiRequest<{ path: string }>("/api/uploads", { method: "POST", body: form })).path; uploaded.current = { file: photo, path }; }
      }
      const body = JSON.stringify({ workspaceId, templateId: selectedId, holderName: name.trim(), holderTitle: title.trim(), ...(externalId.trim() ? { externalId: externalId.trim() } : {}), ...(groupId ? { groupId } : {}), ...(path ? { photoPath: path } : {}), expiresAt: date ? dateToExpiry(date, timezone) : null });
      if (receipt.current.body !== body) receipt.current = { body, key: crypto.randomUUID() };
      const result = await apiRequest<{ id: string }>("/api/passes", { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": receipt.current.key }, body });
      router.push(`/dashboard/${mode}/passes/${result.id}`); router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Issuance failed. Please retry."); }
    finally { lock.current = false; setBusy(false); }
  }
  return <main className="scanlines relative min-h-screen overflow-x-hidden px-6 py-10 text-white md:px-12" style={{ backgroundImage: "linear-gradient(#020817dd,#020817ee),url('/arcade-bg.jpg')", backgroundSize: "cover", backgroundAttachment: "fixed" }}><div className="mx-auto max-w-6xl">
    <Link href={`/dashboard/${mode}/templates`} className="font-pixel text-xs text-slate-300">← Back to templates</Link>
    <div className="mt-7 grid gap-8 lg:grid-cols-2"><section><p className="font-pixel text-sm" style={{ color: workspaceConfig[mode].accent }}>Step 2 of 3 · Personalize your pass</p><h1 className="mt-3 font-pixel text-3xl font-bold">ADD YOUR DETAILS</h1>
      <form onSubmit={issue} className="mt-8 space-y-5 rounded-3xl border border-white/15 bg-slate-950/70 p-6"><fieldset disabled={!ready || busy} className="space-y-5">
        <label className="block font-pixel text-sm">Name<input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} maxLength={40} required /></label>
        <label className="block font-pixel text-sm">{org ? "Role / Title" : "Title"}<input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={40} required /></label>
        {org && <label className="block text-sm">Organization<input className={inputClass} value={organizationName ?? ""} readOnly /></label>}
        <label className="block text-sm">External ID (optional)<input className={inputClass} value={externalId} onChange={(e) => setExternalId(e.target.value)} maxLength={20} /></label>
        <label className="block text-sm">Valid through (optional)<input type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} /></label><p className="text-xs text-slate-400">Valid through the selected day in {timezone}. Blank means no expiry.</p>
        {org && <label className="block text-sm">Group<select className={inputClass} value={groupId} onChange={(e) => setGroupId(e.target.value)}><option value="">No group</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label>}
        <label className="block text-sm">Photo{org ? " (optional)" : ""}<input type="file" accept="image/jpeg,image/png,image/webp" required={!org} className={inputClass} onChange={(event) => {
          const file = event.target.files?.[0]; if (!file) return;
          if (file.size > 4 * 1024 * 1024 || !["image/jpeg","image/png","image/webp"].includes(file.type)) { setError("Choose a JPEG, PNG or WebP image up to 4 MiB."); event.target.value = ""; setPhoto(null); return; }
          setError(""); setPhoto(file);
        }} /></label><p className="text-xs text-slate-400">JPEG, PNG or WebP · Maximum 4 MiB</p>
        <button disabled={busy} className="btn-neon w-full rounded-xl px-5 py-4 font-pixel text-sm font-bold" style={{ background: workspaceConfig[mode].gradient }}>{busy ? "ISSUING..." : "GENERATE PASS"}</button>
      </fieldset>{error && <p role="alert" className="text-sm text-rose-300">{error}</p>}</form>
    </section><section className="lg:sticky lg:top-8 lg:self-start"><h2 className="mb-4 font-pixel text-sm">LIVE PREVIEW</h2>
      {org ? <OrgBadgePreview template={orgTemplate} maxWidth={360} data={{ name, role: title, organization: organizationName, idNumber: externalId, validUntil: date, photoUrl }} /> : <PersonalBadgePreview template={personalTemplate} name={name} title={title} photoUrl={photoUrl} />}
      <p className="mt-4 text-center text-xs text-slate-400">Your permanent pass number and QR code appear after issuance.</p>
    </section></div>
  </div></main>;
}
