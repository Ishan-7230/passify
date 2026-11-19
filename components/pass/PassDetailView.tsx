"use client";
import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { flushSync } from "react-dom";
import type { PassDetail } from "@/lib/validation/pass";
import { apiRequest } from "@/lib/http/client";
import { useHydrated } from "@/lib/utils/use-hydrated";
import { dateToExpiry, expiryToDate } from "@/lib/utils/pass";
import { passTemplates } from "./templates";
import { orgTemplates } from "./orgTemplates";
import { PersonalBadgePreview } from "./PersonalBadgePreview";
import { OrgBadgePreview } from "./OrgBadgePreview";

export function PassDetailView({ initialPass, groups }: { initialPass: PassDetail; groups: { id: string; name: string }[] }) {
  const ready = useHydrated();
  const [pass, setPass] = useState(initialPass); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState(false); const [reason, setReason] = useState(""); const card = useRef<HTMLDivElement>(null);
  const org = pass.workspace_type === "organization";
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return; setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    try {
      const date = String(form.get("date") ?? "");
      const previous = pass.expires_at ? expiryToDate(pass.expires_at, pass.timezone) : "";
      const changes: Record<string, unknown> = { holderName: form.get("name"), holderTitle: form.get("title"), groupId: form.get("group") || null };
      if (date !== previous) changes.expiresAt = date ? dateToExpiry(date, pass.timezone) : null;
      const file = form.get("photo");
      if (file instanceof File && file.size) {
        const upload = new FormData(); upload.set("file", file); upload.set("workspaceId", pass.workspace_id); upload.set("purpose", "photo");
        changes.photoPath = (await apiRequest<{ path: string }>("/api/uploads", { method: "POST", body: upload })).path;
      }
      setPass(await apiRequest<PassDetail>(`/api/passes/${pass.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(changes) }));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Update failed."); } finally { setBusy(false); }
  }
  async function revoke() {
    if (!confirmation || busy) return; setBusy(true); setError("");
    try { setPass(await apiRequest<PassDetail>(`/api/passes/${pass.id}/revoke`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason }) })); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Revocation failed."); } finally { setBusy(false); }
  }
  async function exportPass(format: "png" | "pdf" | "print") {
    if (busy) return; setBusy(true); setError("");
    try {
      const fresh = await apiRequest<PassDetail>(`/api/passes/${pass.id}`);
      flushSync(() => setPass(fresh));
      await document.fonts.ready;
      await Promise.all([...card.current!.querySelectorAll("img")].map(async (image) => { await image.decode(); if (!image.naturalWidth) throw new Error("An image did not load. Retry the export."); }));
      if (format === "print") { window.print(); return; }
      const { toPng } = await import("html-to-image");
      // Private endpoints already use no-store. Do not append cache-busting query
      // fields to their strict schemas, and never share cached photos across paths.
      const dataUrl = await toPng(card.current!, { pixelRatio: 3, includeQueryParams: true,
        fetchRequestInit: { cache: "no-store", credentials: "same-origin" }, style: { margin: "0" }, backgroundColor: "#ffffff" });
      if (format === "png") { const link = document.createElement("a"); link.download = `${fresh.pass_number}.png`; link.href = dataUrl; link.click(); }
      else { const { jsPDF } = await import("jspdf"); const width = org ? 86 : 90; const height = org ? 114.67 : 90;
        const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: [width, height] }); pdf.addImage(dataUrl, "PNG", 0, 0, width, height); pdf.save(`${fresh.pass_number}.pdf`); }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Export failed. Refresh and retry."); } finally { setBusy(false); }
  }
  const input = "mt-2 w-full rounded-lg border border-white/20 bg-slate-950 p-3";
  return <main className="min-h-screen p-6 text-white md:p-12" style={{ backgroundImage: "linear-gradient(#020817dd,#020817ee),url('/arcade-bg.jpg')", backgroundSize: "cover", backgroundAttachment: "fixed" }}><div className="mx-auto max-w-6xl">
    <Link href={`/dashboard/${pass.workspace_type}`} className="text-sm text-cyan-300">← Dashboard</Link><h1 className="mt-6 font-pixel text-3xl">YOUR ISSUED PASS</h1>
    <p className="my-4 font-mono text-sm">{pass.pass_number} · <strong className={pass.status === "active" ? "text-green-300" : "text-rose-300"}>{pass.status.toUpperCase()}</strong></p>
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-2"><section><div id="pass-print-target" ref={card} className={`mx-auto bg-white ${org ? "w-[360px] max-w-full" : "w-[500px] max-w-full"}`}>
      {org ? <OrgBadgePreview maxWidth={360} template={orgTemplates.find((item) => item.id === pass.template_id)!} data={{ name: pass.holder_name, role: pass.holder_title, organization: pass.organization_name ?? "", idNumber: pass.external_id ?? "", validUntil: pass.expires_at ? expiryToDate(pass.expires_at, pass.timezone) : "", photoUrl: pass.photoUrl ?? "", qrUrl: `/api/passes/${pass.id}/qr`, passNumber: pass.pass_number }} />
        : <PersonalBadgePreview template={passTemplates.find((item) => item.id === pass.template_id)!} name={pass.holder_name} title={pass.holder_title} photoUrl={pass.photoUrl} qrUrl={`/api/passes/${pass.id}/qr`} passNumber={pass.pass_number} />}
    </div><div className="my-6 flex flex-wrap justify-center gap-3">{(["png", "pdf", "print"] as const).map((format) => <button key={format} disabled={!ready || busy} onClick={() => exportPass(format)} className="rounded-xl border border-cyan-400/50 px-5 py-3 font-pixel text-xs">{format === "print" ? "PRINT" : `DOWNLOAD ${format.toUpperCase()}`}</button>)}</div>
      <a href={pass.verificationUrl} target="_blank" rel="noreferrer" className="block text-center text-sm text-cyan-300 underline">Open verification page</a><p className="mt-3 text-center text-xs text-slate-400">Downloads always verify the current database status. QR codes verify records, not identity.</p>
    </section><section className="space-y-6"><form onSubmit={save} className="rounded-3xl border border-white/20 bg-slate-900/70 p-6"><h2 className="mb-5 font-pixel">MANAGE PASS</h2><fieldset disabled={!ready || busy || pass.status === "revoked"} className="space-y-4" key={pass.updated_at}>
      <label className="block text-sm">Name<input name="name" defaultValue={pass.holder_name} required maxLength={40} className={input} /></label><label className="block text-sm">Title<input name="title" defaultValue={pass.holder_title} required maxLength={40} className={input} /></label>
      <label className="block text-sm">Valid through ({pass.timezone})<input type="date" name="date" defaultValue={pass.expires_at ? expiryToDate(pass.expires_at, pass.timezone) : ""} className={input} /></label>
      {org && <label className="block text-sm">Group<select name="group" defaultValue={pass.group_id ?? ""} className={input}><option value="">No group</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label>}
      <label className="block text-sm">Replace photo (optional)<input type="file" name="photo" accept="image/jpeg,image/png,image/webp" className={input} /></label><button className="rounded-xl bg-cyan-700 px-5 py-3" disabled={!ready || busy}>Save changes</button>
    </fieldset></form>
    {pass.status !== "revoked" && <section className="rounded-3xl border border-rose-500/40 bg-slate-900/70 p-6"><h2 className="font-pixel">REVOKE PASS</h2><label className="mt-4 block text-sm">Reason<textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} required className={input} /></label><label className="my-4 flex gap-3 text-sm"><input type="checkbox" checked={confirmation} onChange={(e) => setConfirmation(e.target.checked)} />I understand revocation is permanent.</label><button onClick={revoke} disabled={!ready || busy || !confirmation || !reason.trim()} className="rounded-xl bg-rose-700 px-5 py-3 disabled:opacity-40">Revoke permanently</button></section>}
    {error && <p role="alert" className="text-rose-300">{error}</p>}
    </section></div>
  </div></main>;
}
