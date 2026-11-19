import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDatabase } from "../../scripts/test-database.mjs";

const alice = "10000000-0000-4000-8000-000000000011";
const bob = "10000000-0000-4000-8000-000000000012";
const unconfirmed = "10000000-0000-4000-8000-000000000013";
let db: PGlite;
let personal: string;
let organization: string;
let foreignWorkspace: string;

async function provision(user: string, type: string) {
  return (await db.query<{ ws: { id: string } }>("select public.provision_workspace($1, $2::public.workspace_type, 'Test User') as ws", [user, type])).rows[0].ws;
}
async function onboarding(user: string, workspace: string, input: object) {
  return db.query("select public.complete_onboarding($1, $2, $3::jsonb)", [user, workspace, JSON.stringify(input)]);
}
async function isolated(run: () => Promise<void>) {
  await db.exec("begin");
  try { await run(); } finally { await db.exec("rollback"); }
}
async function asset(workspace: string, purpose: "avatar" | "logo" | "photo", old = false) {
  const directory = { avatar: "avatars", logo: "logos", photo: "photos" }[purpose];
  const path = `${workspace}/${directory}/50000000-0000-4000-8000-000000000001.webp`;
  await db.query("insert into public.uploads(workspace_id, object_path, purpose, byte_size, processed_at) values ($1,$2,$3,100,now() - $4::interval)", [workspace, path, purpose, old ? "2 days" : "0 seconds"]);
  await db.query("insert into storage.objects(bucket_id,name) values ('passify-assets',$1)", [path]);
  return path;
}
beforeAll(async () => {
  db = await createTestDatabase();
  await db.query("insert into auth.users(id,email_confirmed_at) values ($1,now()),($2,now()),($3,null)", [alice, bob, unconfirmed]);
  personal = (await provision(alice, "personal")).id;
  organization = (await provision(alice, "organization")).id;
  foreignWorkspace = (await provision(bob, "organization")).id;
});
afterAll(async () => { await db?.close(); });

describe("account transactions", () => {
  it("provisions each workspace idempotently and audits creation once", async () => {
    expect((await provision(alice, "personal")).id).toBe(personal);
    expect((await db.query("select * from public.workspaces where owner_id=$1", [alice])).rows).toHaveLength(2);
    expect((await db.query("select * from public.audit_logs where workspace_id=$1 and action='workspace.created'", [personal])).rows).toHaveLength(1);
  });
  it("rejects unconfirmed users even at the transaction boundary", async () => isolated(async () => {
    await expect(provision(unconfirmed, "personal")).rejects.toMatchObject({ code: "PT401" });
  }));
  it("saves personal onboarding with a validated avatar and audit atomically", async () => isolated(async () => {
    const path = await asset(personal, "avatar");
    await db.exec("set local role service_role");
    await onboarding(alice, personal, { defaultPassName: " Alex ", avatarPath: path });
    expect((await db.query("select default_pass_name,avatar_path,onboarding_completed from public.workspaces where id=$1", [personal])).rows[0]).toEqual({ default_pass_name: "Alex", avatar_path: path, onboarding_completed: true });
    expect((await db.query<{ attached_at: string | null }>("select attached_at from public.uploads where object_path=$1", [path])).rows[0].attached_at).not.toBeNull();
  }));
  it("saves organization details and preserves assets on retries without a new path", async () => isolated(async () => {
    const path = await asset(organization, "logo");
    await onboarding(alice, organization, { name: "Org", industry: "tech", logoPath: path });
    await onboarding(alice, organization, { name: "Updated", industry: "edu" });
    expect((await db.query("select name,industry,logo_path from public.organizations where workspace_id=$1", [organization])).rows[0]).toEqual({ name: "Updated", industry: "edu", logo_path: path });
  }));
  it("rejects a different owner's workspace", async () => isolated(async () => {
    await expect(onboarding(alice, foreignWorkspace, { name: "Hijacked", industry: "tech" })).rejects.toMatchObject({ code: "PT404" });
  }));
  it("rejects another workspace's uploaded logo", async () => isolated(async () => {
    const path = await asset(foreignWorkspace, "logo");
    await expect(onboarding(alice, organization, { name: "Org", industry: "tech", logoPath: path })).rejects.toMatchObject({ code: "PT400" });
  }));
  it("rejects wrong upload purpose despite correct workspace", async () => isolated(async () => {
    const path = await asset(personal, "photo");
    await expect(onboarding(alice, personal, { defaultPassName: "Alex", avatarPath: path })).rejects.toMatchObject({ code: "PT400" });
  }));
  it("rejects a metadata record whose storage object is missing", async () => isolated(async () => {
    const path = await asset(personal, "avatar");
    await db.query("delete from storage.objects where name=$1", [path]);
    await expect(onboarding(alice, personal, { defaultPassName: "Alex", avatarPath: path })).rejects.toMatchObject({ code: "PT400" });
  }));
  it("rejects unknown fields and invalid workspace-specific data", async () => {
    for (const input of [{ defaultPassName: "Alex", owner_id: bob }, { name: "Wrong type", industry: "tech" }, { defaultPassName: "" }]) {
      await isolated(async () => { await expect(onboarding(alice, personal, input)).rejects.toMatchObject({ code: "PT400" }); });
    }
  });
  it("rolls back organization/workspace/asset changes if the audit insert fails", async () => {
    await isolated(async () => {
      const path = await asset(organization, "logo");
      await db.exec("create function public.test_audit_failure() returns trigger language plpgsql as $$ begin raise exception 'test failure'; end; $$; create trigger test_failure before insert on public.audit_logs for each row execute function public.test_audit_failure()");
      await expect(onboarding(alice, organization, { name: "Must rollback", industry: "tech", logoPath: path })).rejects.toMatchObject({ code: "P0001" });
    });
    expect((await db.query("select * from public.organizations where workspace_id=$1", [organization])).rows).toHaveLength(0);
    expect((await db.query<{ onboarding_completed: boolean }>("select onboarding_completed from public.workspaces where id=$1", [organization])).rows[0].onboarding_completed).toBe(false);
  });
  it.each(["anon", "authenticated"])("denies %s execution of every account RPC", async (role) => {
    const { rows } = await db.query<{ allowed: boolean }>("select has_function_privilege($1,p.oid,'EXECUTE') as allowed from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'", [role]);
    expect(rows.every((row) => !row.allowed)).toBe(true);
  });
});

describe("safe upload cleanup and shared limits", () => {
  it("claims only old, unreferenced uploads and disallows subsequent attachment", async () => isolated(async () => {
    const path = await asset(personal, "avatar", true);
    await asset(organization, "logo", true);
    const result = await db.query<{ claimed: { object_path: string }[] }>("select public.claim_abandoned_uploads($1,$2) as claimed", [alice, personal]);
    expect(result.rows[0].claimed.map((row) => row.object_path)).toEqual([path]);
    await expect(onboarding(alice, personal, { defaultPassName: "Alex", avatarPath: path })).rejects.toMatchObject({ code: "PT400" });
  }));
  it("never claims attached or recent uploads", async () => isolated(async () => {
    const path = await asset(personal, "avatar", true);
    await onboarding(alice, personal, { defaultPassName: "Alex", avatarPath: path });
    await asset(personal, "photo");
    const result = await db.query<{ claimed: unknown[] }>("select public.claim_abandoned_uploads($1,$2) as claimed", [alice, personal]);
    expect(result.rows[0].claimed).toEqual([]);
  }));
  it("never lets one owner claim another owner's assets", async () => isolated(async () => {
    await expect(db.query("select public.claim_abandoned_uploads($1,$2)", [alice, foreignWorkspace])).rejects.toMatchObject({ code: "PT404" });
  }));
  it("shares counters across calls and resets expired windows", async () => isolated(async () => {
    const key = `login:${"a".repeat(64)}`;
    const consume = async () => (await db.query<{ ok: boolean }>("select public.consume_rate_limit($1,2,600) as ok", [key])).rows[0].ok;
    expect(await consume()).toBe(true); expect(await consume()).toBe(true); expect(await consume()).toBe(false);
    await db.query("update public.rate_limit_buckets set expires_at=now()-interval '1 second' where key=$1", [key]);
    expect(await consume()).toBe(true);
  }));
});
