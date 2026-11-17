"use client";
import { useRef, useState, type FormEvent } from "react";
import { apiRequest } from "@/lib/http/client";
import { useHydrated } from "@/lib/utils/use-hydrated";
import { orgTemplates } from "@/components/pass/orgTemplates";
import type { Database } from "@/lib/supabase/database.types";

type Group = Database["public"]["Tables"]["groups"]["Row"];
type Organization = Database["public"]["Tables"]["organizations"]["Row"];
type ImportResult = { importId?: string; totalRows: number; created: number; failed: number; rowErrors: { row?: number; message: string }[] };
const input = "mt-2 w-full rounded-xl border border-white/20 bg-slate-950 p-3 text-sm";
export function OrganizationTools({ workspaceId, groups, organization, onChanged }: { workspaceId: string; groups: Group[]; organization: Organization; onChanged: () => void }) {
  const ready = useHydrated();
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [message, setMessage] = useState("");
  const [file, setFile] = useState<File | null>(null); const [template, setTemplate] = useState("campus-id"); const [group, setGroup] = useState("");
  const [preview, setPreview] = useState<ImportResult | null>(null); const [result, setResult] = useState<ImportResult | null>(null); const key = useRef("");
  function resetImport() { setPreview(null); setResult(null); key.current = ""; }
  async function run(action: () => Promise<void>) { if (busy) return; setBusy(true); setError(""); setMessage(""); try { await action(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Request failed."); } finally { setBusy(false); } }
  function groupSave(event: FormEvent<HTMLFormElement>, id?: string) {
    event.preventDefault(); const form = event.currentTarget; const data = new FormData(form);
    void run(async () => {
      const body = { ...(!id ? { workspaceId } : {}), name: data.get("name"), groupType: data.get("type"), description: data.get("description"),
        startsAt: data.get("startsAt") ? new Date(String(data.get("startsAt"))).toISOString() : null, endsAt: data.get("endsAt") ? new Date(String(data.get("endsAt"))).toISOString() : null };
      await apiRequest(id ? `/api/groups/${id}` : "/api/groups", { method: id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!id) form.reset(); setMessage("Group saved."); onChanged();
    });
  }
  function orgSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget);
    void run(async () => {
      let logoPath: string | undefined; const logo = data.get("logo");
      if (logo instanceof File && logo.size) { const upload = new FormData(); upload.set("file", logo); upload.set("workspaceId", workspaceId); upload.set("purpose", "logo"); logoPath = (await apiRequest<{ path: string }>("/api/uploads", { method: "POST", body: upload })).path; }
      await apiRequest("/api/organizations", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workspaceId, name: data.get("name"), industry: data.get("industry"), description: data.get("description"), timezone: data.get("timezone"), ...(logoPath ? { logoPath } : {}) }) });
      setMessage("Organization saved. New passes use these settings."); onChanged();
    });
  }
  async function importFile(dryRun: boolean) {
    if (!file) { setError("Choose a CSV file."); return; }
    await run(async () => {
      if (!key.current) key.current = crypto.randomUUID();
      const form = new FormData(); form.set("file", file); form.set("workspaceId", workspaceId); form.set("templateId", template); if (group) form.set("groupId", group);
      form.set("idempotencyKey", key.current); form.set("dryRun", String(dryRun));
      const data = await apiRequest<ImportResult>("/api/passes/bulk", { method: "POST", body: form });
      if (dryRun) setPreview(data); else { setResult(data); onChanged(); }
    });
  }
  function groupFields(existing?: Group) {
    return <><label className="block">Group name<input name="name" defaultValue={existing?.name} maxLength={100} required className={input} /></label><label className="block">Type<select name="type" defaultValue={existing?.group_type ?? "event"} className={input}>{["event","department","membership","other"].map((value) => <option key={value}>{value}</option>)}</select></label><label className="block">Description<textarea name="description" defaultValue={existing?.description ?? ""} maxLength={2000} className={input} /></label><label className="block">Starts at (ISO date/time, optional)<input name="startsAt" defaultValue={existing?.starts_at ?? ""} placeholder="2027-01-01T09:00:00+05:30" className={input} /></label><label className="block">Ends at (ISO date/time, optional)<input name="endsAt" defaultValue={existing?.ends_at ?? ""} placeholder="2027-01-01T18:00:00+05:30" className={input} /></label></>;
  }
  return <section className="mt-10 text-sm"><fieldset disabled={!ready || busy} className="space-y-4">
    <details className="rounded-2xl border border-cyan-500/30 bg-slate-900/70 p-5"><summary className="cursor-pointer font-pixel">GROUPS</summary><div className="mt-5 grid gap-5 md:grid-cols-2"><form onSubmit={(event) => groupSave(event)} className="space-y-3"><h3>Create group</h3>{groupFields()}<button disabled={!ready || busy} className="rounded-lg bg-cyan-700 p-3">Create group</button></form><div className="space-y-3">{groups.map((item) => <details key={item.id} className="rounded-xl border border-white/10 p-4"><summary>{item.name} · {item.group_type}</summary><form className="mt-4 space-y-3" onSubmit={(event) => groupSave(event,item.id)}>{groupFields(item)}<button disabled={!ready || busy} className="rounded-lg bg-cyan-700 p-3">Save group</button></form></details>)}</div></div></details>
    <details className="rounded-2xl border border-cyan-500/30 bg-slate-900/70 p-5"><summary className="cursor-pointer font-pixel">CSV BULK ISSUANCE</summary><div className="mt-5 space-y-4"><p>Up to 500 rows / 512 KiB. Headers: <code>name,role,external_id,valid_until</code>. Dates use YYYY-MM-DD in {organization.timezone}. External IDs must be unique in this workspace.</p><label className="block">Template<select className={input} value={template} onChange={(e) => { setTemplate(e.target.value); resetImport(); }}>{orgTemplates.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="block">Group<select className={input} value={group} onChange={(e) => { setGroup(e.target.value); resetImport(); }}><option value="">No group</option>{groups.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="block">CSV file<input type="file" accept=".csv,text/csv" className={input} onChange={(e) => { setFile(e.target.files?.[0] ?? null); resetImport(); }} /></label><button disabled={!ready || busy || !file} onClick={() => importFile(true)} className="rounded-lg border border-cyan-400 px-4 py-3">Validate CSV</button>
      {preview && <div role="status"><p>{preview.totalRows} rows · {preview.rowErrors.length} validation errors</p>{preview.rowErrors.slice(0,50).map((item,i) => <p key={i} className="text-rose-300">Row {item.row}: {item.message}</p>)}{preview.rowErrors.length > 50 && <p>Showing the first 50 errors.</p>}<button disabled={!ready || busy || preview.rowErrors.length > 0 || Boolean(result)} onClick={() => importFile(false)} className="mt-4 rounded-lg bg-cyan-700 px-4 py-3">Confirm import of {preview.totalRows} passes</button></div>}
      {result && <p role="status">Created {result.created} of {result.totalRows} passes. {result.failed ? "Import failed; no partial batch was issued." : "Import complete."}</p>}
    </div></details>
    <details className="rounded-2xl border border-cyan-500/30 bg-slate-900/70 p-5"><summary className="cursor-pointer font-pixel">ORGANIZATION SETTINGS</summary><form onSubmit={orgSave} className="mt-5 space-y-4"><label className="block">Organization name<input name="name" defaultValue={organization.name} required maxLength={100} className={input} /></label><label className="block">Industry<select name="industry" defaultValue={organization.industry ?? "other"} className={input}><option value="tech">Technology</option><option value="edu">Education</option><option value="event">Event Management</option><option value="other">Other</option></select></label><label className="block">Timezone<input name="timezone" defaultValue={organization.timezone} required className={input} /></label><label className="block">Description<textarea name="description" defaultValue={organization.description ?? ""} maxLength={2000} className={input} /></label><label className="block">Replace logo<input name="logo" type="file" accept="image/jpeg,image/png,image/webp" className={input} /></label><button disabled={!ready || busy} className="rounded-lg bg-cyan-700 p-3">Save organization</button></form></details>
    <button disabled={!ready || busy} onClick={() => run(async () => { const data = await apiRequest<{ removed: number }>("/api/uploads", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workspaceId }) }); setMessage(`Removed ${data.removed} abandoned uploads older than 24 hours.`); })} className="text-xs text-slate-400 underline">Clean abandoned uploads</button>
    {error && <p role="alert" className="text-rose-300">{error}</p>}{message && <p role="status" className="text-cyan-200">{message}</p>}
  </fieldset></section>;
}
