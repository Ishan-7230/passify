import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDatabase } from "../../scripts/test-database.mjs";
import { passTemplates } from "@/components/pass/templates";
import { orgTemplates } from "@/components/pass/orgTemplates";

const alice = "10000000-0000-4000-8000-000000000001";
const bob = "10000000-0000-4000-8000-000000000002";
const personal = "20000000-0000-4000-8000-000000000001";
const organization = "20000000-0000-4000-8000-000000000002";
const foreignWorkspace = "20000000-0000-4000-8000-000000000003";
const group = "30000000-0000-4000-8000-000000000001";
const foreignGroup = "30000000-0000-4000-8000-000000000002";
const pass = "40000000-0000-4000-8000-000000000001";
const objectId = "50000000-0000-4000-8000-000000000001";
let db: PGlite;

beforeAll(async () => {
  db = await createTestDatabase();
  await db.query("insert into auth.users(id) values ($1), ($2)", [alice, bob]);
  await db.query(`insert into public.workspaces(id, owner_id, workspace_type, name) values
    ($1, $4, 'personal', 'Alice'), ($2, $4, 'organization', 'Alice Org'), ($3, $5, 'organization', 'Bob Org')`,
  [personal, organization, foreignWorkspace, alice, bob]);
  await db.query("insert into public.groups(id, workspace_id, name, group_type) values ($1, $3, 'Team', 'department'), ($2, $4, 'Other', 'event')", [group, foreignGroup, organization, foreignWorkspace]);
  await db.query(`insert into public.uploads(workspace_id, object_path, purpose, byte_size) values
    ($1, $2, 'photo', 100), ($3, $4, 'photo', 100)`, [organization, `${organization}/photos/${objectId}.webp`, foreignWorkspace, `${foreignWorkspace}/photos/${objectId}.webp`]);
  await db.query(`insert into public.passes(id, workspace_id, workspace_type, group_id, template_id, pass_number,
    verification_token, holder_name, holder_title, created_by, issued_at, photo_path) values
    ($1, $2, 'organization', $3, 'campus-id', 'PSF-ABCDEF123456', $4, 'Alex', 'Student', $5, '2026-01-01T00:00:00Z', $6)`,
  [pass, organization, group, "a".repeat(43), alice, `${organization}/photos/${objectId}.webp`]);
});
afterAll(async () => { await db?.close(); });

// Each test transaction rolls back, including successful statements before an error.
async function isolated(run: () => Promise<void>) {
  await db.exec("begin");
  try { await run(); } finally { await db.exec("rollback"); }
}

describe("versioned migrations", () => {
  it("applies all migrations to an empty PostgreSQL database and seeds exact frontend templates", async () => {
    const { rows } = await db.query("select id, name, workspace_type, is_active from public.templates order by id");
    const expected = [
      ...passTemplates.map(({ id, name }) => ({ id, name, workspace_type: "personal", is_active: true })),
      ...orgTemplates.map(({ id, name }) => ({ id, name, workspace_type: "organization", is_active: true })),
    ].sort((a, b) => a.id.localeCompare(b.id));
    expect(rows).toEqual(expected);
    expect(rows).toHaveLength(14);
  });
  it("allows one workspace of each type per user and rejects duplicate types", async () => isolated(async () => {
    await expect(db.query("insert into public.workspaces(owner_id, workspace_type, name) values ($1, 'personal', 'Duplicate')", [alice])).rejects.toMatchObject({ code: "23505" });
  }));
  it("rejects an organization profile attached to a personal workspace", async () => isolated(async () => {
    await expect(db.query("insert into public.organizations(workspace_id, name) values ($1, 'Wrong type')", [personal])).rejects.toMatchObject({ code: "23503" });
  }));
  it("rejects a pass with a template from the wrong workspace type", async () => isolated(async () => {
    await expect(db.query(`insert into public.passes(workspace_id, workspace_type, template_id, pass_number, verification_token, holder_name, holder_title, created_by)
      values ($1, 'organization', 'design-1', 'PSF-111111111111', $2, 'Alex', 'Staff', $3)`, [organization, "b".repeat(43), alice])).rejects.toMatchObject({ code: "23503" });
  }));
  it("rejects a foreign tenant's group", async () => isolated(async () => {
    await expect(db.query("update public.passes set group_id = $1 where id = $2", [foreignGroup, pass])).rejects.toMatchObject({ code: "23503" });
  }));
  it("rejects a foreign tenant's photo even with a real upload record", async () => isolated(async () => {
    await expect(db.query("update public.passes set photo_path = $1 where id = $2", [`${foreignWorkspace}/photos/${objectId}.webp`, pass])).rejects.toMatchObject({ code: "23503" });
  }));
  it("rejects pass creation attributed to a different owner", async () => isolated(async () => {
    await expect(db.query(`insert into public.passes(workspace_id, workspace_type, template_id, pass_number, verification_token, holder_name, holder_title, created_by)
      values ($1, 'organization', 'campus-id', 'PSF-111111111111', $2, 'Alex', 'Staff', $3)`, [organization, "b".repeat(43), bob])).rejects.toMatchObject({ code: "23503" });
  }));
  it.each(["2025-12-31T23:59:59Z", "2026-01-01T00:00:00Z"])("rejects expiry at/before issue time: %s", async (expiry) => isolated(async () => {
    await expect(db.query("update public.passes set expires_at = $1 where id = $2", [expiry, pass])).rejects.toMatchObject({ code: "23514" });
  }));
  it("rejects reversed group dates", async () => isolated(async () => {
    await expect(db.query("update public.groups set starts_at = '2027-01-02', ends_at = '2027-01-01' where id = $1", [group])).rejects.toMatchObject({ code: "23514" });
  }));
  it.each(["pass_number", "verification_token"])("enforces unique %s", async (column) => isolated(async () => {
    const number = column === "pass_number" ? "PSF-ABCDEF123456" : "PSF-111111111111";
    const token = column === "verification_token" ? "a".repeat(43) : "b".repeat(43);
    await expect(db.query(`insert into public.passes(workspace_id, workspace_type, template_id, pass_number, verification_token, holder_name, holder_title, created_by)
      values ($1, 'organization', 'campus-id', $2, $3, 'Alex', 'Staff', $4)`, [organization, number, token, alice])).rejects.toMatchObject({ code: "23505" });
  }));
  it("prevents replacing issued credentials", async () => isolated(async () => {
    await expect(db.query("update public.passes set verification_token = $1 where id = $2", ["c".repeat(43), pass])).rejects.toMatchObject({ code: "23514" });
  }));
  it("makes revocation irreversible", async () => isolated(async () => {
    await db.query("update public.passes set revoked_at = now(), revocation_reason = 'Cancelled' where id = $1", [pass]);
    await expect(db.query("update public.passes set revoked_at = null, revocation_reason = null where id = $1", [pass])).rejects.toMatchObject({ code: "23514" });
  }));
  it("does not allow deleted groups or uploads still referenced by a pass", async () => {
    await isolated(async () => {
      await expect(db.query("delete from public.groups where id = $1", [group])).rejects.toMatchObject({ code: "23503" });
    });
    await isolated(async () => {
      await expect(db.query("delete from public.uploads where workspace_id = $1", [organization])).rejects.toMatchObject({ code: "23503" });
    });
  });
  it("rolls back previous changes when a later statement fails", async () => {
    await isolated(async () => {
      await db.query("update public.workspaces set name = 'Should roll back' where id = $1", [personal]);
      await expect(db.query("update public.passes set group_id = $1 where id = $2", [foreignGroup, pass])).rejects.toMatchObject({ code: "23503" });
    });
    expect((await db.query<{ name: string }>("select name from public.workspaces where id = $1", [personal])).rows[0].name).toBe("Alice");
  });
  it("scopes single-issuance receipts to the pass's workspace", async () => isolated(async () => {
    await expect(db.query(`insert into public.issuance_requests(workspace_id, idempotency_key, payload_hash, pass_id)
      values ($1, 'test-key-1', $2, $3)`, [foreignWorkspace, "a".repeat(64), pass])).rejects.toMatchObject({ code: "23503" });
  }));
  it("enforces import idempotency within a workspace", async () => isolated(async () => {
    const insert = "insert into public.import_jobs(workspace_id, idempotency_key, payload_hash, total_rows) values ($1, 'batch-key-1', $2, 1)";
    await db.query(insert, [organization, "a".repeat(64)]);
    await db.query(insert, [foreignWorkspace, "a".repeat(64)]);
    await expect(db.query(insert, [organization, "b".repeat(64)])).rejects.toMatchObject({ code: "23505" });
  }));
});

describe("database role and storage boundaries", () => {
  it("enables RLS on every public application table", async () => {
    const { rows } = await db.query<{ relrowsecurity: boolean }>("select relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r'");
    expect(rows).toHaveLength(12);
    expect(rows.every((row) => row.relrowsecurity)).toBe(true);
  });
  it.each(["anon", "authenticated"])("denies all table privileges to %s", async (role) => {
    const { rows } = await db.query<{ allowed: boolean }>(`select has_table_privilege($1, c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') as allowed
      from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r'`, [role]);
    expect(rows.every((row) => !row.allowed)).toBe(true);
    await isolated(async () => {
      // Role is restricted to the test's fixed parameter list.
      await db.exec(`set local role ${role}`);
      await expect(db.query("select * from public.passes")).rejects.toMatchObject({ code: "42501" });
    });
  });
  it("gives service_role read access but cannot modify seeds or delete passes", async () => isolated(async () => {
    await db.exec("set local role service_role");
    expect((await db.query("select id from public.passes")).rows).toHaveLength(1);
    expect((await db.query<{ allowed: boolean }>("select has_table_privilege('service_role', 'public.templates', 'INSERT,UPDATE,DELETE') as allowed")).rows[0].allowed).toBe(false);
    await expect(db.query("delete from public.passes")).rejects.toMatchObject({ code: "42501" });
  }));
  it("denies direct privileged function execution", async () => {
    for (const role of ["anon", "authenticated"]) {
      expect((await db.query<{ allowed: boolean }>("select has_function_privilege($1, 'public.protect_pass_update()', 'EXECUTE') as allowed", [role])).rows[0].allowed).toBe(false);
    }
  });
  it("new tables and functions do not inherit public access", async () => isolated(async () => {
    await db.exec("create table public.future_table(id uuid); create function public.future_rpc() returns integer language sql as 'select 1'");
    for (const role of ["anon", "authenticated"]) {
      expect((await db.query<{ allowed: boolean }>("select has_table_privilege($1, 'public.future_table', 'SELECT,INSERT,UPDATE,DELETE') as allowed", [role])).rows[0].allowed).toBe(false);
      expect((await db.query<{ allowed: boolean }>("select has_function_privilege($1, 'public.future_rpc()', 'EXECUTE') as allowed", [role])).rows[0].allowed).toBe(false);
    }
  }));
  it("creates a private WebP-only bucket with 4 MiB limit", async () => {
    expect((await db.query("select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'passify-assets'")).rows[0]).toMatchObject({
      public: false, file_size_limit: 4194304, allowed_mime_types: ["image/webp"],
    });
  });
  it.each(["anon", "authenticated"])("denies %s storage reads/writes even with broad existing policies", async (role) => isolated(async () => {
    await db.query("insert into storage.objects(bucket_id, name) values ('passify-assets', 'private.webp')");
    await db.exec(`set local role ${role}`);
    expect((await db.query("select * from storage.objects where bucket_id = 'passify-assets'")).rows).toHaveLength(0);
    expect((await db.query("select * from storage.buckets where id = 'passify-assets'")).rows).toHaveLength(0);
    await expect(db.query("insert into storage.objects(bucket_id, name) values ('passify-assets', 'bad.webp')")).rejects.toMatchObject({ code: "42501" });
  }));
});
