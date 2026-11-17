begin;
create function public.save_group(p_actor_id uuid,p_workspace_id uuid,p_group_id uuid,p_input jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare ws public.workspaces; result public.groups;
begin
  ws := passify_private.owned_workspace(p_actor_id,p_workspace_id);
  if ws.workspace_type <> 'organization' then raise exception 'Organization required' using errcode='PT400'; end if;
  if p_input is null or jsonb_typeof(p_input)<>'object' or exists(select 1 from jsonb_object_keys(p_input) k where k not in ('name','groupType','description','startsAt','endsAt')) then
    raise exception 'Invalid fields' using errcode='PT400';
  end if;
  if p_group_id is null then
    insert into public.groups(workspace_id,name,group_type,description,starts_at,ends_at)
      values(ws.id,btrim(p_input->>'name'),(p_input->>'groupType')::public.group_type,p_input->>'description',(p_input->>'startsAt')::timestamptz,(p_input->>'endsAt')::timestamptz) returning * into result;
  else
    update public.groups set name=case when p_input?'name' then btrim(p_input->>'name') else name end,
      group_type=case when p_input?'groupType' then (p_input->>'groupType')::public.group_type else group_type end,
      description=case when p_input?'description' then p_input->>'description' else description end,
      starts_at=case when p_input?'startsAt' then (p_input->>'startsAt')::timestamptz else starts_at end,
      ends_at=case when p_input?'endsAt' then (p_input->>'endsAt')::timestamptz else ends_at end
      where id=p_group_id and workspace_id=ws.id returning * into result;
    if not found then raise exception 'Group not found' using errcode='PT404'; end if;
  end if;
  insert into public.audit_logs(workspace_id,actor_id,action,resource_id) values(ws.id,p_actor_id,case when p_group_id is null then 'group.created' else 'group.edited' end,result.id);
  return to_jsonb(result);
end;
$$;

create function public.update_organization(p_actor_id uuid,p_workspace_id uuid,p_input jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare ws public.workspaces; org public.organizations; config jsonb;
begin
  ws := passify_private.owned_workspace(p_actor_id,p_workspace_id);
  if ws.workspace_type <> 'organization' then raise exception 'Organization required' using errcode='PT400'; end if;
  select * into org from public.organizations where workspace_id=ws.id;
  if not found then raise exception 'Complete onboarding first' using errcode='PT400'; end if;
  if p_input is null or jsonb_typeof(p_input)<>'object' or exists(select 1 from jsonb_object_keys(p_input) k where k not in ('name','industry','description','timezone','logoPath')) then raise exception 'Invalid fields' using errcode='PT400'; end if;
  if p_input?'timezone' and not exists(select 1 from pg_timezone_names where name=p_input->>'timezone') then raise exception 'Invalid timezone' using errcode='PT400'; end if;
  config := jsonb_build_object('name',coalesce(p_input->>'name',org.name),'industry',coalesce(p_input->>'industry',org.industry));
  if p_input?'logoPath' then config := config || jsonb_build_object('logoPath',p_input->>'logoPath'); end if;
  perform public.complete_onboarding(p_actor_id,ws.id,config);
  update public.organizations set description=case when p_input?'description' then p_input->>'description' else description end,
    timezone=coalesce(p_input->>'timezone',timezone) where workspace_id=ws.id returning * into org;
  return to_jsonb(org);
end;
$$;
revoke all on function public.save_group(uuid,uuid,uuid,jsonb),public.update_organization(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.save_group(uuid,uuid,uuid,jsonb),public.update_organization(uuid,uuid,jsonb) to service_role;
commit;
