import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDatabase } from "../../scripts/test-database.mjs";
import { newPassCredentials, payloadHash } from "@/lib/utils/identifiers";

const alice = "10000000-0000-4000-8000-000000000021";
const bob = "10000000-0000-4000-8000-000000000022";
let db: PGlite; let workspace: string; let foreign: string;
type Pass = { id: string; verification_token: string; holder_name: string; organization_name: string; revoked_at: string | null };
const fields = { templateId: "corporate-navy", holderName: "Alex", holderTitle: "Engineer" };
async function rpc<T>(sql: string, args: unknown[]) { return (await db.query<{ value: T }>(`select public.${sql} as value`, args)).rows[0].value; }
async function issue(input = fields, key = crypto.randomUUID(), actor = alice, ws = workspace) {
  const credentials = newPassCredentials();
  return rpc<Pass>("issue_pass($1,$2,$3::jsonb,$4,$5,$6,$7)", [actor, ws, JSON.stringify(input), credentials.passNumber, credentials.token, key, payloadHash(input)]);
}
async function isolated(run: () => Promise<void>) { await db.exec("begin"); try { await run(); } finally { await db.exec("rollback"); } }
beforeAll(async () => {
  db = await createTestDatabase();
  await db.query("insert into auth.users(id,email_confirmed_at) values($1,now()),($2,now())", [alice,bob]);
  for (const actor of [alice,bob]) {
    const ws = await rpc<{ id: string }>("provision_workspace($1,'organization','Owner')", [actor]);
    await rpc("complete_onboarding($1,$2,$3::jsonb)", [actor,ws.id,JSON.stringify({ name: "Arcade Labs", industry: "tech" })]);
    if (actor === alice) workspace = ws.id; else foreign = ws.id;
  }
});
afterAll(async () => { await db?.close(); });
describe("pass transactions and public verification", () => {
  it("issues once for an identical retry and audits once", async () => isolated(async () => {
    const key = crypto.randomUUID(); const first = await issue(fields,key); const retry = await issue(fields,key);
    expect(retry.id).toBe(first.id); expect(first.organization_name).toBe("Arcade Labs");
    expect((await db.query("select * from public.audit_logs where resource_id=$1",[first.id])).rows).toHaveLength(1);
    await expect(issue({ ...fields, holderName: "Changed" },key)).rejects.toMatchObject({ code: "PT409" });
  }));
  it("isolates issue, read, edit, revoke and statistics by owner", async () => {
    for (const call of [() => issue(fields,crypto.randomUUID(),alice,foreign),
      () => rpc("list_passes($1,$2,'{}')",[alice,foreign]), () => rpc("dashboard_stats($1,$2)",[alice,foreign])]) {
      await isolated(async () => { await expect(call()).rejects.toMatchObject({ code: "PT404" }); });
    }
    for (const fn of ["edit_pass($1,$2,'{\"holderName\":\"Changed\"}')", "revoke_pass($1,$2,'Reason')"]) {
      await isolated(async () => { const pass = await issue(); await expect(rpc(fn,[bob,pass.id])).rejects.toMatchObject({ code: "PT404" }); });
    }
  });
  it("rolls back issuance and its receipt when the audit fails", async () => {
    await db.exec("create function public.fail_audit() returns trigger language plpgsql as $$ begin raise exception 'test failure'; end $$; create trigger fail_audit before insert on public.audit_logs for each row execute function public.fail_audit()");
    try {
      await expect(issue()).rejects.toMatchObject({ code: "P0001" });
      expect((await db.query("select * from public.passes")).rows).toHaveLength(0);
      expect((await db.query("select * from public.issuance_requests")).rows).toHaveLength(0);
    } finally { await db.exec("drop trigger fail_audit on public.audit_logs; drop function public.fail_audit()"); }
  });
  it("returns only minimal public fields and bounds repeated verification logs", async () => isolated(async () => {
    const pass = await issue(); const verify = () => rpc<Record<string,unknown>>("verify_pass($1)",[pass.verification_token]);
    const result = await verify(); await verify();
    expect(result.status).toBe("active"); expect(result.valid).toBe(true);
    expect(Object.keys(result).sort()).toEqual(["expiresAt","issuedAt","organization","passNumber","status","valid"]);
    expect((await db.query("select * from public.verification_logs where pass_id=$1",[pass.id])).rows).toHaveLength(1);
    expect(await rpc("verify_pass($1)",["z".repeat(43)])).toEqual({ valid:false,status:"not_found" });
    expect(await rpc("verify_pass($1)",["malformed"])).toEqual({ valid:false,status:"not_found" });
  }));
  it("uses expiry <= now and gives revocation priority, including old QR codes", async () => isolated(async () => {
    const pass = await issue();
    await db.query("update public.passes set expires_at=issued_at+interval '1 microsecond' where id=$1",[pass.id]);
    expect(await rpc("verify_pass($1)",[pass.verification_token])).toMatchObject({ valid:false,status:"expired" });
    await rpc("revoke_pass($1,$2,'Lost')",[alice,pass.id]); await rpc("revoke_pass($1,$2,'Retry')",[alice,pass.id]);
    expect(await rpc("verify_pass($1)",[pass.verification_token])).toMatchObject({ valid:false,status:"revoked" });
    expect((await db.query("select * from public.audit_logs where resource_id=$1 and action='pass.revoked'",[pass.id])).rows).toHaveLength(1);
    await expect(rpc("edit_pass($1,$2,'{\"holderName\":\"Changed\"}')",[alice,pass.id])).rejects.toMatchObject({ code:"PT409" });
  }));
  it("filters before pagination, excludes tokens and keeps statistics consistent", async () => isolated(async () => {
    const a = await issue(); const b = await issue({ ...fields, holderName:"Beta" }); await issue({ ...fields, holderName:"Gamma" });
    await db.query("update public.passes set expires_at=issued_at+interval '1 microsecond' where id=$1",[a.id]);
    await rpc("revoke_pass($1,$2,'Ended')",[alice,b.id]);
    const list = await rpc<{ total:number; items: Record<string,unknown>[] }>("list_passes($1,$2,$3::jsonb)",[alice,workspace,JSON.stringify({ status:"active",limit:1,page:1 })]);
    expect(list.total).toBe(1); expect(list.items[0].holder_name).toBe("Gamma"); expect(list.items[0]).not.toHaveProperty("verification_token");
    expect(await rpc("dashboard_stats($1,$2)",[alice,workspace])).toEqual({ total:3,active:1,expired:1,revoked:1 });
    expect(await rpc("list_passes($1,$2,$3::jsonb)",[alice,workspace,JSON.stringify({ search:"bEt",page:2,limit:1 })])).toMatchObject({ total:1,items:[] });
  }));
  it("rejects cross-workspace groups and inactive templates", async () => {
    await isolated(async () => {
      const group = await rpc<{ id:string }>("save_group($1,$2,null,$3::jsonb)",[bob,foreign,JSON.stringify({ name:"Other",groupType:"event" })]);
      await expect(issue({ ...fields, ...{ groupId:group.id } })).rejects.toMatchObject({ code:"23503" });
    });
    await isolated(async () => { await db.exec("update public.templates set is_active=false where id='corporate-navy'"); await expect(issue()).rejects.toMatchObject({ code:"PT400" }); });
  });
  it("edits groups and organization settings under ownership checks", async () => isolated(async () => {
    const group = await rpc<{ id:string }>("save_group($1,$2,null,$3::jsonb)",[alice,workspace,JSON.stringify({ name:"Launch",groupType:"event" })]);
    expect(await rpc("save_group($1,$2,$3,$4::jsonb)",[alice,workspace,group.id,JSON.stringify({ name:"Launch 2" })])).toMatchObject({ name:"Launch 2" });
    expect(await rpc("update_organization($1,$2,$3::jsonb)",[alice,workspace,JSON.stringify({ name:"New Name",timezone:"America/New_York" })])).toMatchObject({ name:"New Name",timezone:"America/New_York" });
    await expect(rpc("save_group($1,$2,$3,'{\"name\":\"Bad\"}')",[bob,foreign,group.id])).rejects.toMatchObject({ code:"PT404" });
  }));
  it("imports atomically and returns the original job on retry", async () => isolated(async () => {
    const rows = ["001","002"].map((externalId) => ({ input:{ ...fields, externalId },...newPassCredentials() }));
    const args = [alice,workspace,crypto.randomUUID(),payloadHash(rows),JSON.stringify(rows)];
    const first = await rpc("import_passes($1,$2,$3,$4,$5::jsonb)",args);
    expect(first).toMatchObject({ totalRows:2,created:2,failed:0,rowErrors:[] });
    expect(await rpc("import_passes($1,$2,$3,$4,$5::jsonb)",args)).toEqual(first);
    expect((await db.query("select * from public.passes")).rows).toHaveLength(2);
  }));
  it("rolls back the entire batch on a late duplicate", async () => {
    const rows = ["001","001"].map((externalId) => ({ input:{ ...fields,externalId },...newPassCredentials() }));
    await expect(rpc("import_passes($1,$2,$3,$4,$5::jsonb)",[alice,workspace,crypto.randomUUID(),payloadHash(rows),JSON.stringify(rows)])).rejects.toMatchObject({ code:"23505" });
    for (const table of ["passes","import_jobs","issuance_requests"]) expect((await db.query(`select * from public.${table}`)).rows).toHaveLength(0);
    expect((await db.query("select * from public.audit_logs where action='pass.issued'")).rows).toHaveLength(0);
  });
});
