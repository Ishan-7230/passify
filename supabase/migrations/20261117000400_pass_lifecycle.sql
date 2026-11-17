begin;

create function passify_private.owned_workspace(p_actor_id uuid, p_workspace_id uuid)
returns public.workspaces language plpgsql set search_path = '' as $$
declare ws public.workspaces;
begin
  perform passify_private.assert_confirmed_actor(p_actor_id);
  select * into ws from public.workspaces where id = p_workspace_id and owner_id = p_actor_id for update;
  if not found then raise exception 'Workspace not found' using errcode = 'PT404'; end if;
  return ws;
end;
$$;

create function passify_private.check_photo(p_workspace_id uuid, p_path text, p_required boolean)
returns void language plpgsql set search_path = '' as $$
declare upload_id uuid;
begin
  if p_path is null then
    if p_required then raise exception 'Photo required' using errcode = 'PT400'; end if;
    return;
  end if;
  select id into upload_id from public.uploads where workspace_id = p_workspace_id and object_path = p_path
    and purpose = 'photo' and deletion_started_at is null for update;
  if not found or not exists (select 1 from storage.objects where bucket_id = 'passify-assets' and name = p_path) then
    raise exception 'Validated photo required' using errcode = 'PT400';
  end if;
  update public.uploads set attached_at = coalesce(attached_at, now()) where id = upload_id;
end;
$$;

create function public.issue_pass(p_actor_id uuid, p_workspace_id uuid, p_input jsonb,
  p_pass_number text, p_token text, p_idempotency_key text, p_payload_hash text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare ws public.workspaces; result public.passes; receipt public.issuance_requests;
  captured_now timestamptz := clock_timestamp(); issuer text; expiry timestamptz;
begin
  ws := passify_private.owned_workspace(p_actor_id, p_workspace_id);
  select * into receipt from public.issuance_requests where workspace_id = ws.id and idempotency_key = p_idempotency_key;
  if found then
    if receipt.payload_hash <> p_payload_hash then raise exception 'Idempotency conflict' using errcode = 'PT409'; end if;
    select * into strict result from public.passes where id = receipt.pass_id and workspace_id = ws.id;
    return to_jsonb(result);
  end if;
  if not ws.onboarding_completed then raise exception 'Complete onboarding first' using errcode = 'PT400'; end if;
  if p_input is null or jsonb_typeof(p_input) <> 'object' or exists (
    select 1 from jsonb_object_keys(p_input) k where k not in ('templateId','holderName','holderTitle','externalId','groupId','photoPath','expiresAt')
  ) then raise exception 'Invalid pass fields' using errcode = 'PT400'; end if;
  if not exists (select 1 from public.templates where id = p_input->>'templateId' and workspace_type = ws.workspace_type and is_active) then
    raise exception 'Invalid template' using errcode = 'PT400';
  end if;
  expiry := (p_input->>'expiresAt')::timestamptz;
  if expiry <= captured_now then raise exception 'Expiry must be in future' using errcode = 'PT400'; end if;
  perform passify_private.check_photo(ws.id, p_input->>'photoPath', ws.workspace_type = 'personal');
  if ws.workspace_type = 'organization' then
    select name into issuer from public.organizations where workspace_id = ws.id;
    if not found then raise exception 'Organization setup required' using errcode = 'PT400'; end if;
  end if;
  insert into public.passes(workspace_id, workspace_type, template_id, group_id, pass_number, verification_token,
    holder_name, holder_title, organization_name, external_id, photo_path, issued_at, expires_at, created_by)
  values (ws.id, ws.workspace_type, p_input->>'templateId', (p_input->>'groupId')::uuid, p_pass_number, p_token,
    btrim(p_input->>'holderName'), btrim(p_input->>'holderTitle'), issuer, nullif(btrim(p_input->>'externalId'), ''),
    p_input->>'photoPath', captured_now, expiry, p_actor_id) returning * into result;
  insert into public.issuance_requests(workspace_id, idempotency_key, payload_hash, pass_id)
    values (ws.id, p_idempotency_key, p_payload_hash, result.id);
  insert into public.audit_logs(workspace_id, actor_id, action, resource_id) values (ws.id, p_actor_id, 'pass.issued', result.id);
  return to_jsonb(result);
end;
$$;

create function public.revoke_pass(p_actor_id uuid, p_pass_id uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result public.passes;
begin
  perform passify_private.assert_confirmed_actor(p_actor_id);
  select p.* into result from public.passes p join public.workspaces w on w.id = p.workspace_id
    where p.id = p_pass_id and w.owner_id = p_actor_id for update of p;
  if not found then raise exception 'Pass not found' using errcode = 'PT404'; end if;
  if result.revoked_at is not null then return to_jsonb(result); end if;
  if p_reason is null or char_length(btrim(p_reason)) not between 1 and 500 then raise exception 'Reason required' using errcode = 'PT400'; end if;
  update public.passes set revoked_at = clock_timestamp(), revocation_reason = btrim(p_reason) where id = result.id and workspace_id = result.workspace_id returning * into result;
  insert into public.audit_logs(workspace_id, actor_id, action, resource_id) values (result.workspace_id, p_actor_id, 'pass.revoked', result.id);
  return to_jsonb(result);
end;
$$;

create function public.edit_pass(p_actor_id uuid, p_pass_id uuid, p_input jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result public.passes; expiry timestamptz;
begin
  perform passify_private.assert_confirmed_actor(p_actor_id);
  -- Match issuance/cleanup lock order: workspace before pass/upload.
  perform 1 from public.workspaces w join public.passes p on p.workspace_id = w.id
    where p.id = p_pass_id and w.owner_id = p_actor_id for update of w;
  if not found then raise exception 'Pass not found' using errcode = 'PT404'; end if;
  select * into result from public.passes where id = p_pass_id for update;
  if result.revoked_at is not null then raise exception 'Revoked passes cannot be edited' using errcode = 'PT409'; end if;
  if p_input is null or jsonb_typeof(p_input) <> 'object' or p_input = '{}'::jsonb or exists (
    select 1 from jsonb_object_keys(p_input) k where k not in ('holderName','holderTitle','expiresAt','photoPath','groupId')
  ) then raise exception 'Invalid edit fields' using errcode = 'PT400'; end if;
  expiry := case when p_input ? 'expiresAt' then (p_input->>'expiresAt')::timestamptz else result.expires_at end;
  if p_input ? 'expiresAt' and expiry <= clock_timestamp() then raise exception 'Expiry must be in future' using errcode = 'PT400'; end if;
  if p_input ? 'photoPath' then perform passify_private.check_photo(result.workspace_id, p_input->>'photoPath', result.workspace_type = 'personal'); end if;
  update public.passes set
    holder_name = case when p_input ? 'holderName' then btrim(p_input->>'holderName') else holder_name end,
    holder_title = case when p_input ? 'holderTitle' then btrim(p_input->>'holderTitle') else holder_title end,
    photo_path = case when p_input ? 'photoPath' then p_input->>'photoPath' else photo_path end,
    group_id = case when p_input ? 'groupId' then (p_input->>'groupId')::uuid else group_id end,
    expires_at = expiry where id = result.id and workspace_id = result.workspace_id returning * into result;
  insert into public.audit_logs(workspace_id, actor_id, action, resource_id) values (result.workspace_id, p_actor_id, 'pass.edited', result.id);
  return to_jsonb(result);
end;
$$;

create function public.list_passes(p_actor_id uuid, p_workspace_id uuid, p_filters jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare captured_now timestamptz := clock_timestamp(); result jsonb; page_num integer; page_limit integer;
begin
  perform passify_private.assert_confirmed_actor(p_actor_id);
  if not exists(select 1 from public.workspaces where id = p_workspace_id and owner_id = p_actor_id) then raise exception 'Workspace not found' using errcode = 'PT404'; end if;
  page_num := coalesce((p_filters->>'page')::integer,1); page_limit := coalesce((p_filters->>'limit')::integer,20);
  if page_num not between 1 and 100000 or page_limit not between 1 and 100 then raise exception 'Invalid pagination' using errcode = 'PT400'; end if;
  with filtered as materialized (
    select p.*, case when revoked_at is not null then 'revoked' when expires_at <= captured_now then 'expired' else 'active' end as status
    from public.passes p where workspace_id = p_workspace_id
      and (p_filters->>'groupId' is null or group_id = (p_filters->>'groupId')::uuid)
      and (coalesce(p_filters->>'search','') = '' or position(lower(p_filters->>'search') in lower(holder_name || ' ' || coalesce(external_id,'') || ' ' || pass_number)) > 0)
  ), matching as materialized (
    select * from filtered where coalesce(p_filters->>'status','all') = 'all' or status = p_filters->>'status'
  ), paginated as (
    select * from matching order by created_at desc, id desc limit page_limit offset (page_num - 1) * page_limit
  ) select jsonb_build_object('items', coalesce((select jsonb_agg(to_jsonb(p) - 'verification_token' order by created_at desc,id desc) from paginated p), '[]'::jsonb),
    'total', (select count(*) from matching), 'page',page_num, 'limit',page_limit) into result;
  return result;
end;
$$;

create function public.dashboard_stats(p_actor_id uuid, p_workspace_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare captured_now timestamptz := clock_timestamp(); result jsonb;
begin
  perform passify_private.assert_confirmed_actor(p_actor_id);
  if not exists(select 1 from public.workspaces where id = p_workspace_id and owner_id = p_actor_id) then raise exception 'Workspace not found' using errcode = 'PT404'; end if;
  select jsonb_build_object('total',count(*),
    'active',count(*) filter(where revoked_at is null and (expires_at is null or expires_at > captured_now)),
    'expired',count(*) filter(where revoked_at is null and expires_at <= captured_now),
    'revoked',count(*) filter(where revoked_at is not null)) into result
    from public.passes where workspace_id = p_workspace_id;
  return result;
end;
$$;

create function public.verify_pass(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result public.passes; current_status public.pass_status; captured_now timestamptz := clock_timestamp();
begin
  if p_token is null or p_token !~ '^[A-Za-z0-9_-]{43}$' then return jsonb_build_object('valid',false,'status','not_found'); end if;
  select * into result from public.passes where verification_token = p_token;
  if not found then return jsonb_build_object('valid',false,'status','not_found'); end if;
  current_status := case when result.revoked_at is not null then 'revoked' when result.expires_at <= captured_now then 'expired' else 'active' end;
  perform pg_advisory_xact_lock(hashtextextended(result.id::text,0));
  if not exists(select 1 from public.verification_logs l where l.pass_id = result.id and l.verified_at > captured_now - interval '1 minute' and l.result = current_status) then
    insert into public.verification_logs(pass_id,result,verified_at) values (result.id,current_status,captured_now);
  end if;
  return jsonb_build_object('valid',current_status = 'active', 'status',current_status, 'passNumber',result.pass_number,
    'organization',coalesce(result.organization_name,'Personal pass'), 'issuedAt',result.issued_at, 'expiresAt',result.expires_at);
end;
$$;

create function public.import_passes(p_actor_id uuid, p_workspace_id uuid, p_key text, p_hash text, p_rows jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare ws public.workspaces; job public.import_jobs; item jsonb; index_num integer := 0; count_rows integer;
begin
  ws := passify_private.owned_workspace(p_actor_id, p_workspace_id);
  if ws.workspace_type <> 'organization' or not ws.onboarding_completed then raise exception 'Completed organization required' using errcode = 'PT400'; end if;
  select * into job from public.import_jobs where workspace_id = ws.id and idempotency_key = p_key;
  if found then
    if job.payload_hash <> p_hash then raise exception 'Import idempotency conflict' using errcode = 'PT409'; end if;
    return jsonb_build_object('importId',job.id,'totalRows',job.total_rows,'created',job.created_count,'failed',job.failed_count,'rowErrors',job.errors);
  end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then raise exception 'Invalid rows' using errcode = 'PT400'; end if;
  count_rows := jsonb_array_length(p_rows);
  if count_rows not between 1 and 500 then raise exception 'Invalid row count' using errcode = 'PT400'; end if;
  insert into public.import_jobs(workspace_id,idempotency_key,payload_hash,total_rows)
    values(ws.id,p_key,p_hash,count_rows) returning * into job;
  for item in select value from jsonb_array_elements(p_rows) loop
    index_num := index_num + 1;
    perform public.issue_pass(p_actor_id, ws.id, item->'input', item->>'passNumber', item->>'token', 'bulk-' || job.id::text || '-' || index_num::text, p_hash);
  end loop;
  update public.import_jobs set state='completed',created_count=count_rows where id=job.id;
  insert into public.audit_logs(workspace_id,actor_id,action,resource_id,details)
    values(ws.id,p_actor_id,'passes.imported',job.id,jsonb_build_object('count',count_rows));
  return jsonb_build_object('importId',job.id,'totalRows',count_rows,'created',count_rows,'failed',0,'rowErrors','[]'::jsonb);
end;
$$;

create function public.record_import_failure(p_actor_id uuid, p_workspace_id uuid, p_key text, p_hash text, p_total integer)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform passify_private.owned_workspace(p_actor_id,p_workspace_id);
  insert into public.import_jobs(workspace_id,idempotency_key,payload_hash,total_rows,failed_count,state,errors)
    values(p_workspace_id,p_key,p_hash,p_total,p_total,'failed','[{"code":"IMPORT_FAILED","message":"No passes were created."}]'::jsonb)
    on conflict (workspace_id,idempotency_key) do nothing;
end;
$$;

revoke all on function public.issue_pass(uuid,uuid,jsonb,text,text,text,text), public.revoke_pass(uuid,uuid,text),
  public.edit_pass(uuid,uuid,jsonb), public.list_passes(uuid,uuid,jsonb), public.dashboard_stats(uuid,uuid),
  public.verify_pass(text), public.import_passes(uuid,uuid,text,text,jsonb), public.record_import_failure(uuid,uuid,text,text,integer)
  from public, anon, authenticated;
grant execute on function public.issue_pass(uuid,uuid,jsonb,text,text,text,text), public.revoke_pass(uuid,uuid,text),
  public.edit_pass(uuid,uuid,jsonb), public.list_passes(uuid,uuid,jsonb), public.dashboard_stats(uuid,uuid),
  public.verify_pass(text), public.import_passes(uuid,uuid,text,text,jsonb), public.record_import_failure(uuid,uuid,text,text,integer)
  to service_role;

commit;
