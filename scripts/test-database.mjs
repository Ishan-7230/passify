import { PGlite } from "@electric-sql/pglite";
import { readdir, readFile } from "node:fs/promises";

/** Disposable PostgreSQL. Only Supabase-managed Auth/Storage scaffolding is simulated. */
export async function createTestDatabase() {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon nologin;
      create role authenticated nologin;
      create role service_role nologin bypassrls;
      create schema auth;
      create table auth.users (id uuid primary key, email_confirmed_at timestamptz);
      create schema storage;
      create table storage.buckets (
        id text primary key, name text not null, public boolean not null default false,
        file_size_limit bigint, allowed_mime_types text[]
      );
      create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text);
      alter table storage.objects enable row level security;
      alter table storage.buckets enable row level security;
      grant usage on schema public, storage to anon, authenticated, service_role;
      grant all on storage.objects, storage.buckets to anon, authenticated, service_role;
      -- Simulate pre-existing permissive project policies to verify ours still deny access.
      create policy fixture_broad_objects on storage.objects for all to anon, authenticated using (true) with check (true);
      create policy fixture_broad_buckets on storage.buckets for all to anon, authenticated using (true) with check (true);
      alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
    `);
    const directory = new URL("../supabase/migrations/", import.meta.url);
    for (const file of (await readdir(directory)).filter((name) => name.endsWith(".sql")).sort()) {
      await db.exec(await readFile(new URL(file, directory), "utf8"));
    }
    return db;
  } catch (error) {
    await db.close();
    throw error;
  }
}
