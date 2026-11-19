"use client";
import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { workspaceConfig, type Workspace } from "@/components/auth/workspace";
import { apiRequest } from "@/lib/http/client";
import { useHydrated } from "@/lib/utils/use-hydrated";
import type { PassListResult } from "@/lib/validation/pass";
import type { Database } from "@/lib/supabase/database.types";
import { OrganizationTools } from "./OrganizationTools";

type Stats = { total: number; active: number; expired: number; revoked: number };
type Group = Database["public"]["Tables"]["groups"]["Row"];
type Organization = Database["public"]["Tables"]["organizations"]["Row"];
export function WorkspaceDashboard({ mode, workspaceId, initialList, initialStats, initialGroups, initialOrganization }: { mode: Workspace; workspaceId: string; initialList: PassListResult; initialStats: Stats; initialGroups: Group[]; initialOrganization: Organization | null }) {
  const ready = useHydrated();
  const config = workspaceConfig[mode]; const [list, setList] = useState(initialList); const [stats,setStats] = useState(initialStats); const [groups,setGroups] = useState(initialGroups); const [organization,setOrganization] = useState(initialOrganization);
  const [search,setSearch] = useState(""); const [status,setStatus] = useState("all"); const [group,setGroup] = useState(""); const [busy,setBusy] = useState(false); const [error,setError] = useState(""); const sequence = useRef(0);
  async function reload(page = list.page) {
    const request = ++sequence.current; setBusy(true); setError("");
    try {
      const query = new URLSearchParams({ workspaceId, page: String(page), limit: "20", search, status }); if (group) query.set("groupId",group);
      const [passes, counts, updatedGroups, updatedOrganization] = await Promise.all([
        apiRequest<PassListResult>(`/api/passes?${query}`), apiRequest<Stats>(`/api/dashboard/stats?workspaceId=${workspaceId}`),
        mode === "organization" ? apiRequest<Group[]>(`/api/groups?workspaceId=${workspaceId}`) : Promise.resolve([]),
        mode === "organization" ? apiRequest<Organization>(`/api/organizations?workspaceId=${workspaceId}`) : Promise.resolve(null),
      ]);
      if (sequence.current === request) { setList(passes); setStats(counts); setGroups(updatedGroups); setOrganization(updatedOrganization); }
    } catch (cause) { if (sequence.current === request) setError(cause instanceof Error ? cause.message : "Could not load passes."); }
    finally { if (sequence.current === request) setBusy(false); }
  }
  function filter(event: FormEvent) { event.preventDefault(); void reload(1); }
  return <main className="scanlines min-h-screen p-6 text-white md:p-12" style={{ backgroundImage: "linear-gradient(#020817dd,#020817ee),url('/arcade-bg.jpg')", backgroundSize: "cover", backgroundAttachment: "fixed" }}><div className="mx-auto max-w-6xl">
    <header className="mb-10 flex flex-wrap items-start justify-between gap-6"><div><h1 className="font-pixel text-3xl font-bold md:text-4xl" style={{ textShadow: `0 0 20px ${config.accent}` }}>{mode.toUpperCase()} DASHBOARD</h1><p className="mt-3 text-sm text-slate-300">{organization?.name ?? "Manage your personal passes"}</p></div><div className="flex flex-wrap gap-3"><Link href={`/dashboard/${mode}/templates`} className="btn-neon rounded-full px-6 py-3 font-pixel text-sm" style={{ background: config.gradient }}>+ {mode === "personal" ? "CREATE NEW PASS" : "ISSUE PASSES"}</Link><LogoutButton workspace={mode} /></div></header>
    <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">{Object.entries(stats).map(([name,count]) => <div key={name} className="rounded-2xl border border-white/15 bg-slate-900/70 p-5"><p className="font-pixel text-xs uppercase text-slate-300">{name}</p><p className="mt-3 text-3xl font-bold" style={{ color: config.accent }}>{count}</p></div>)}</div>
    <section className="rounded-3xl border border-white/15 bg-slate-900/70 p-5"><form onSubmit={filter} className="mb-5 flex flex-wrap gap-3"><input aria-label="Search passes" value={search} maxLength={100} onChange={(e) => setSearch(e.target.value)} placeholder="Name, external ID or pass number" className="min-w-0 flex-1 rounded-xl border border-white/20 bg-slate-950 p-3" /><select aria-label="Status filter" value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-xl bg-slate-950 p-3">{["all","active","expired","revoked"].map((value) => <option key={value}>{value}</option>)}</select>{mode === "organization" && <select aria-label="Group filter" value={group} onChange={(e) => setGroup(e.target.value)} className="rounded-xl bg-slate-950 p-3"><option value="">All groups</option>{groups.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>}<button disabled={!ready || busy} className="rounded-xl border border-cyan-400/50 px-5 py-3">{busy ? "Loading..." : "Search"}</button></form>
      {error && <p role="alert" className="mb-4 text-rose-300">{error}</p>}
      {!list.items.length ? <p className="py-12 text-center text-slate-300">No passes match these filters. Create your first pass or adjust your search.</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="text-slate-400"><th className="p-3">Holder</th><th className="p-3">Pass number</th><th className="p-3">Status</th><th className="p-3">Manage</th></tr></thead><tbody>{list.items.map((pass) => <tr key={pass.id} className="border-t border-white/10"><td className="p-3"><strong>{pass.holder_name}</strong><p className="text-xs text-slate-400">{pass.holder_title}</p></td><td className="p-3 font-mono text-xs">{pass.pass_number}</td><td className={`p-3 ${pass.status === "active" ? "text-green-300" : "text-rose-300"}`}>{pass.status}</td><td className="p-3"><Link href={`/dashboard/${mode}/passes/${pass.id}`} className="text-cyan-300 underline">View / export</Link></td></tr>)}</tbody></table></div>}
      <div className="mt-5 flex items-center justify-between gap-3 text-sm"><button disabled={!ready || busy || list.page === 1} onClick={() => reload(list.page-1)} className="rounded-lg border border-white/20 p-2 disabled:opacity-30">Previous</button><span>{list.total} results · Page {list.page} of {Math.max(1,Math.ceil(list.total/list.limit))}</span><button disabled={!ready || busy || list.page*list.limit >= list.total} onClick={() => reload(list.page+1)} className="rounded-lg border border-white/20 p-2 disabled:opacity-30">Next</button></div>
    </section>
    {mode === "organization" && organization && <OrganizationTools workspaceId={workspaceId} groups={groups} organization={organization} onChanged={() => { void reload(); }} />}
    {mode === "personal" && <Link href="/onboarding/personal" className="mt-6 inline-block text-sm text-slate-300 underline">Edit personal profile</Link>}
  </div></main>;
}
