begin;

create schema if not exists passify_private;
revoke all on schema passify_private from public, anon, authenticated, service_role;

create function passify_private.assert_confirmed_actor(p_actor_id uuid) returns void
language plpgsql set search_path = '' as $$
begin
  if not exists (select 1 from auth.users where id = p_actor_id and email_confirmed_at is not null) then
    raise exception 'Confirmed user required' using errcode = 'PT401';
  end if;
end;
$$;

alter table public.uploads add column deletion_started_at timestamptz;

create function public.provision_workspace(p_actor_id uuid, p_workspace_type public.workspace_type, p_full_name text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result public.workspaces; inserted_id uuid;
begin
  perform passify_private.assert_confirmed_actor(p_actor_id);
  if p_workspace_type is null or p_full_name is null or char_length(btrim(p_full_name)) not between 1 and 100 then
    raise exception 'Invalid workspace input' using errcode = 'PT400';
  end if;
  insert into public.profiles(id, full_name) values (p_actor_id, btrim(p_full_name)) on conflict (id) do nothing;
  insert into public.workspaces(owner_id, workspace_type, name)
    values (p_actor_id, p_workspace_type, case when p_workspace_type = 'organization' then 'My organization' else btrim(p_full_name) end)
    on conflict (owner_id, workspace_type) do nothing returning id into inserted_id;
  select * into strict result from public.workspaces where owner_id = p_actor_id and workspace_type = p_workspace_type;
  if inserted_id is not null then
    insert into public.audit_logs(workspace_id, actor_id, action, resource_id)
      values (result.id, p_actor_id, 'workspace.created', result.id);
  end if;
  return to_jsonb(result);
end;
$$;

create function public.complete_onboarding(p_actor_id uuid, p_workspace_id uuid, p_input jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare ws public.workspaces; asset_path text; expected_purpose public.upload_purpose; uploaded public.uploads;
begin
  perform passify_private.assert_confirmed_actor(p_actor_id);
  select * into ws from public.workspaces where id = p_workspace_id and owner_id = p_actor_id for update;
  if not found then raise exception 'Workspace not found' using errcode = 'PT404'; end if;
  if p_input is null or jsonb_typeof(p_input) <> 'object' then raise exception 'Invalid input' using errcode = 'PT400'; end if;
  if ws.workspace_type = 'personal' then
    if exists (select 1 from jsonb_object_keys(p_input) k where k not in ('defaultPassName', 'avatarPath'))
      or jsonb_typeof(p_input->'defaultPassName') is distinct from 'string'
      or char_length(btrim(p_input->>'defaultPassName')) not between 1 and 40 then
      raise exception 'Invalid personal input' using errcode = 'PT400';
    end if;
    asset_path := coalesce(p_input->>'avatarPath', ws.avatar_path);
    expected_purpose := 'avatar';
  else
    if exists (select 1 from jsonb_object_keys(p_input) k where k not in ('name', 'industry', 'logoPath'))
      or jsonb_typeof(p_input->'name') is distinct from 'string'
      or char_length(btrim(p_input->>'name')) not between 1 and 100
      or jsonb_typeof(p_input->'industry') is distinct from 'string'
      or p_input->>'industry' not in ('tech', 'edu', 'event', 'other') then
      raise exception 'Invalid organization input' using errcode = 'PT400';
    end if;
    asset_path := coalesce(p_input->>'logoPath', (select logo_path from public.organizations where workspace_id = ws.id));
    expected_purpose := 'logo';
  end if;
  if asset_path is not null then
    select * into uploaded from public.uploads where workspace_id = ws.id and object_path = asset_path
      and purpose = expected_purpose and deletion_started_at is null for update;
    if not found or not exists (select 1 from storage.objects where bucket_id = 'passify-assets' and name = asset_path) then
      raise exception 'Validated upload required' using errcode = 'PT400';
    end if;
  end if;
  if ws.workspace_type = 'personal' then
    update public.workspaces set default_pass_name = btrim(p_input->>'defaultPassName'), avatar_path = asset_path,
      onboarding_completed = true where id = ws.id and owner_id = p_actor_id returning * into ws;
  else
    insert into public.organizations(workspace_id, name, industry, logo_path)
      values (ws.id, btrim(p_input->>'name'), p_input->>'industry', asset_path)
      on conflict (workspace_id) do update set name = excluded.name, industry = excluded.industry, logo_path = excluded.logo_path;
    update public.workspaces set name = btrim(p_input->>'name'), onboarding_completed = true
      where id = ws.id and owner_id = p_actor_id returning * into ws;
  end if;
  if asset_path is not null then
    update public.uploads set attached_at = coalesce(attached_at, now()) where id = uploaded.id and workspace_id = ws.id;
  end if;
  insert into public.audit_logs(workspace_id, actor_id, action, resource_id)
    values (ws.id, p_actor_id, 'workspace.onboarded', ws.id);
  return to_jsonb(ws);
end;
$$;

-- Tombstones prevent an upload being attached while storage cleanup is in progress.
-- Failed storage deletion can be retried; references and attached files are excluded.
create function public.claim_abandoned_uploads(p_actor_id uuid, p_workspace_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  perform passify_private.assert_confirmed_actor(p_actor_id);
  if not exists (select 1 from public.workspaces where id = p_workspace_id and owner_id = p_actor_id) then
    raise exception 'Workspace not found' using errcode = 'PT404';
  end if;
  with candidates as (
    select u.id from public.uploads u where u.workspace_id = p_workspace_id and u.attached_at is null
      and u.processed_at < now() - interval '24 hours'
      and not exists (select 1 from public.workspaces w where w.avatar_path = u.object_path)
      and not exists (select 1 from public.organizations o where o.logo_path = u.object_path)
      and not exists (select 1 from public.profiles p where p.avatar_path = u.object_path)
      and not exists (select 1 from public.passes p where p.photo_path = u.object_path)
      order by u.processed_at limit 100 for update of u skip locked
  ), claimed as (
    update public.uploads set deletion_started_at = now() where id in (select id from candidates)
    returning id, object_path
  ) select coalesce(jsonb_agg(to_jsonb(claimed)), '[]'::jsonb) into result from claimed;
  return result;
end;
$$;

create table public.rate_limit_buckets (
  key text primary key check (key ~ '^[a-z_.-]{1,40}:[0-9a-f]{64}$'),
  window_started_at timestamptz not null,
  hits integer not null check (hits > 0),
  expires_at timestamptz not null
);
create index rate_limit_expiry_idx on public.rate_limit_buckets(expires_at);
alter table public.rate_limit_buckets enable row level security;
revoke all on public.rate_limit_buckets from public, anon, authenticated, service_role;

create function public.consume_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean language plpgsql security definer set search_path = '' as $$
declare count_now integer; captured_now timestamptz := clock_timestamp();
begin
  if p_limit is null or p_limit not between 1 and 10000 or p_window_seconds is null or p_window_seconds not between 1 and 86400 then
    raise exception 'Invalid rate limit' using errcode = 'PT400';
  end if;
  delete from public.rate_limit_buckets where key in (
    select key from public.rate_limit_buckets where expires_at < captured_now order by expires_at limit 100
  );
  insert into public.rate_limit_buckets(key, window_started_at, hits, expires_at)
    values (p_key, captured_now, 1, captured_now + make_interval(secs => p_window_seconds))
    on conflict (key) do update set
      hits = case when public.rate_limit_buckets.expires_at <= captured_now then 1 else least(public.rate_limit_buckets.hits + 1, p_limit + 1) end,
      window_started_at = case when public.rate_limit_buckets.expires_at <= captured_now then captured_now else public.rate_limit_buckets.window_started_at end,
      expires_at = case when public.rate_limit_buckets.expires_at <= captured_now then captured_now + make_interval(secs => p_window_seconds) else public.rate_limit_buckets.expires_at end
    returning hits into count_now;
  return count_now <= p_limit;
end;
$$;

revoke all on function public.provision_workspace(uuid, public.workspace_type, text),
  public.complete_onboarding(uuid, uuid, jsonb), public.claim_abandoned_uploads(uuid, uuid),
  public.consume_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.provision_workspace(uuid, public.workspace_type, text),
  public.complete_onboarding(uuid, uuid, jsonb), public.claim_abandoned_uploads(uuid, uuid),
  public.consume_rate_limit(text, integer, integer) to service_role;

commit;
