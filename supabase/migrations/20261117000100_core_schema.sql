-- Server-mediated architecture: public roles get no application-table access.
begin;

create type public.workspace_type as enum ('personal', 'organization');
create type public.group_type as enum ('event', 'department', 'membership', 'other');
create type public.pass_status as enum ('active', 'expired', 'revoked');
create type public.upload_purpose as enum ('photo', 'avatar', 'logo');
create type public.import_state as enum ('pending', 'completed', 'failed');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (char_length(btrim(full_name)) between 1 and 100),
  avatar_path text,
  created_at timestamptz not null default now()
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  workspace_type public.workspace_type not null,
  name text not null check (char_length(btrim(name)) between 1 and 100),
  default_pass_name text check (char_length(btrim(default_pass_name)) between 1 and 40),
  avatar_path text,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  unique (owner_id, workspace_type),
  unique (id, workspace_type),
  unique (id, owner_id)
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null unique,
  workspace_type public.workspace_type not null default 'organization' check (workspace_type = 'organization'),
  name text not null check (char_length(btrim(name)) between 1 and 100),
  industry text check (char_length(btrim(industry)) between 1 and 100),
  description text check (char_length(description) <= 2000),
  logo_path text,
  timezone text not null default 'Asia/Kolkata' check (char_length(timezone) between 1 and 100),
  created_at timestamptz not null default now(),
  foreign key (workspace_id, workspace_type) references public.workspaces(id, workspace_type) on delete cascade
);

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 100),
  group_type public.group_type not null,
  description text check (char_length(description) <= 2000),
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  unique (id, workspace_id),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);
create index groups_workspace_created_idx on public.groups(workspace_id, created_at desc);

create table public.templates (
  id text primary key,
  workspace_type public.workspace_type not null,
  name text not null check (char_length(btrim(name)) between 1 and 100),
  is_active boolean not null default true,
  unique (id, workspace_type)
);

create table public.uploads (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  object_path text not null unique,
  purpose public.upload_purpose not null,
  byte_size bigint not null check (byte_size between 1 and 4194304),
  processed_at timestamptz not null default now(),
  attached_at timestamptz,
  unique (object_path, workspace_id),
  check (object_path ~ ('^' || workspace_id::text || '/' ||
    case purpose when 'photo' then 'photos' when 'avatar' then 'avatars' else 'logos' end ||
    '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$')),
  check (attached_at is null or attached_at >= processed_at)
);
create index uploads_workspace_idx on public.uploads(workspace_id);
create index uploads_unattached_idx on public.uploads(processed_at) where attached_at is null;

-- Composite references are database-level tenant boundaries, independent of services.
alter table public.workspaces add constraint workspaces_avatar_fkey
  foreign key (avatar_path, id) references public.uploads(object_path, workspace_id);
alter table public.organizations add constraint organizations_logo_fkey
  foreign key (logo_path, workspace_id) references public.uploads(object_path, workspace_id);

create table public.passes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  workspace_type public.workspace_type not null,
  group_id uuid,
  template_id text not null,
  pass_number text not null unique check (pass_number ~ '^PSF-[0-9A-F]{12}$'),
  verification_token text not null unique check (verification_token ~ '^[A-Za-z0-9_-]{43}$'),
  holder_name text not null check (char_length(btrim(holder_name)) between 1 and 40),
  holder_title text not null check (char_length(btrim(holder_title)) between 1 and 40),
  organization_name text check (char_length(btrim(organization_name)) between 1 and 100),
  external_id text check (char_length(btrim(external_id)) between 1 and 20),
  photo_path text,
  issued_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  revocation_reason text check (char_length(btrim(revocation_reason)) between 1 and 500),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  foreign key (workspace_id, workspace_type) references public.workspaces(id, workspace_type) on delete cascade,
  foreign key (workspace_id, created_by) references public.workspaces(id, owner_id),
  foreign key (template_id, workspace_type) references public.templates(id, workspace_type),
  foreign key (group_id, workspace_id) references public.groups(id, workspace_id),
  foreign key (photo_path, workspace_id) references public.uploads(object_path, workspace_id),
  check (expires_at is null or expires_at > issued_at),
  check (revoked_at is null or revoked_at >= issued_at),
  check (revoked_at is not null or revocation_reason is null)
);
create index passes_workspace_created_idx on public.passes(workspace_id, created_at desc, id desc);
create index passes_workspace_expiry_idx on public.passes(workspace_id, expires_at);
create index passes_workspace_revoked_idx on public.passes(workspace_id, revoked_at);
create index passes_group_idx on public.passes(group_id);
-- Supplied external IDs are unique per workspace; CSV imports use the same policy.
create unique index passes_workspace_external_id_idx on public.passes(workspace_id, external_id) where external_id is not null;

create table public.verification_logs (
  id uuid primary key default gen_random_uuid(),
  pass_id uuid not null references public.passes(id) on delete cascade,
  result public.pass_status not null,
  verified_at timestamptz not null default now()
);
create index verification_logs_pass_time_idx on public.verification_logs(pass_id, verified_at desc);

create table public.import_jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  idempotency_key text not null check (idempotency_key ~ '^[A-Za-z0-9_-]{8,128}$'),
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  total_rows integer not null check (total_rows between 1 and 500),
  created_count integer not null default 0 check (created_count >= 0),
  failed_count integer not null default 0 check (failed_count >= 0),
  state public.import_state not null default 'pending',
  errors jsonb not null default '[]'::jsonb check (jsonb_typeof(errors) = 'array'),
  created_at timestamptz not null default now(),
  unique (workspace_id, idempotency_key),
  check (created_count + failed_count <= total_rows),
  check (state <> 'completed' or (created_count = total_rows and failed_count = 0)),
  check (state <> 'failed' or (created_count = 0 and failed_count = total_rows))
);
create index import_jobs_workspace_created_idx on public.import_jobs(workspace_id, created_at desc);

-- Single-pass retry receipts are separate from bulk-import jobs.
create table public.issuance_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  idempotency_key text not null check (idempotency_key ~ '^[A-Za-z0-9_-]{8,128}$'),
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  pass_id uuid not null,
  created_at timestamptz not null default now(),
  unique (workspace_id, idempotency_key),
  foreign key (pass_id, workspace_id) references public.passes(id, workspace_id) on delete cascade
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_id uuid not null references auth.users(id),
  action text not null check (char_length(action) between 1 and 100),
  resource_id uuid not null,
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  created_at timestamptz not null default now(),
  foreign key (workspace_id, actor_id) references public.workspaces(id, owner_id)
);
create index audit_logs_workspace_created_idx on public.audit_logs(workspace_id, created_at desc);

-- Protect identifiers and irreversible revocation even from accidental service updates.
create function public.protect_pass_update() returns trigger
language plpgsql set search_path = '' as $$
begin
  if row(new.id, new.workspace_id, new.workspace_type, new.template_id, new.pass_number,
    new.verification_token, new.organization_name, new.external_id, new.issued_at, new.created_by, new.created_at)
    is distinct from row(old.id, old.workspace_id, old.workspace_type, old.template_id, old.pass_number,
    old.verification_token, old.organization_name, old.external_id, old.issued_at, old.created_by, old.created_at) then
    raise exception 'Issued pass identifiers are immutable' using errcode = '23514';
  end if;
  if old.revoked_at is not null and new is distinct from old then
    raise exception 'Revoked passes are immutable' using errcode = '23514';
  end if;
  if old.revoked_at is not null then return old; end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger passes_protect_update before update on public.passes
  for each row execute function public.protect_pass_update();

-- No policies = deny by default. Service-role queries MUST enforce ownership.
do $$
declare relation_name text;
begin
  foreach relation_name in array array['profiles', 'workspaces', 'organizations', 'groups', 'templates',
    'uploads', 'passes', 'verification_logs', 'import_jobs', 'issuance_requests', 'audit_logs'] loop
    execute format('alter table public.%I enable row level security', relation_name);
    execute format('revoke all on public.%I from public, anon, authenticated, service_role', relation_name);
  end loop;
end;
$$;

grant usage on schema public to service_role;
revoke create on schema public from public, anon, authenticated;
grant select, insert, update on public.profiles, public.workspaces, public.organizations,
  public.groups, public.uploads, public.passes, public.import_jobs to service_role;
grant select on public.templates to service_role;
grant select, insert on public.issuance_requests, public.audit_logs, public.verification_logs to service_role;
grant delete on public.uploads to service_role;
revoke all on function public.protect_pass_update() from public, anon, authenticated;

-- Supabase can grant table privileges by default; close the default for future migrations.
alter default privileges in schema public revoke all on tables from public, anon, authenticated;
alter default privileges in schema public revoke all on sequences from public, anon, authenticated;
-- PostgreSQL grants EXECUTE to PUBLIC globally by default. A per-schema revoke
-- cannot subtract that global grant, so remove it at both levels.
alter default privileges revoke execute on functions from public, anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

commit;
