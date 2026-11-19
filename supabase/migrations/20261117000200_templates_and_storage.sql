begin;

-- Rendering remains in components/pass/{templates,orgTemplates}.ts.
insert into public.templates (id, workspace_type, name) values
  ('design-1', 'personal', 'Sunburst Pop'),
  ('design-2', 'personal', 'Crown Mosaic'),
  ('design-3', 'personal', 'Neon Cosmic'),
  ('design-4', 'personal', 'Pop Art Burst'),
  ('design-5', 'personal', 'Tech Circuit'),
  ('design-6', 'personal', 'Vinyl Grid'),
  ('corporate-navy', 'organization', 'Corporate Navy'),
  ('executive-gold', 'organization', 'Executive Black & Gold'),
  ('conference-attendee', 'organization', 'Conference Attendee'),
  ('visitor-pass', 'organization', 'Visitor Pass'),
  ('contractor-access', 'organization', 'Contractor Access'),
  ('campus-id', 'organization', 'Campus ID'),
  ('healthcare-staff', 'organization', 'Healthcare Staff'),
  ('event-staff', 'organization', 'Event Staff');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('passify-assets', 'passify-assets', false, 4194304, array['image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Explicit restrictive policies also block access if a project has broader policies.
-- Service-role Storage operations bypass RLS; services issue owner-scoped signed URLs.
create policy passify_assets_server_only on storage.objects as restrictive
  for all to anon, authenticated
  using (bucket_id <> 'passify-assets') with check (bucket_id <> 'passify-assets');
create policy passify_bucket_server_only on storage.buckets as restrictive
  for all to anon, authenticated
  using (id <> 'passify-assets') with check (id <> 'passify-assets');

commit;
