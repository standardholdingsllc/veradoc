-- VeraDoc Storage Buckets
-- Buckets: documents (lease PDFs, evidence reports), evidence (signer identity docs)
-- Both private with participant-scoped access policies.

-- =============================================================================
-- HELPER: safe UUID cast (returns NULL instead of raising on malformed input)
-- =============================================================================

create or replace function public.safe_cast_uuid(p_text text)
returns uuid
language plpgsql
immutable
security definer
set search_path = public
as $$
begin
  return p_text::uuid;
exception when invalid_text_representation then
  return null;
end;
$$;

revoke execute on function public.safe_cast_uuid(text) from public;
grant execute on function public.safe_cast_uuid(text) to authenticated;
grant execute on function public.safe_cast_uuid(text) to service_role;

-- =============================================================================
-- HELPER: check if a packet_id belongs to the current user (via any role).
-- Bypasses RLS to avoid recursion from storage -> lease_packets -> etc.
-- =============================================================================

create or replace function public.user_owns_packet(p_packet_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.lease_packets where id = p_packet_id and created_by = auth.uid()
  );
$$;

revoke execute on function public.user_owns_packet(uuid) from public;
grant execute on function public.user_owns_packet(uuid) to authenticated;

create or replace function public.user_is_signer_on_packet(p_packet_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.packet_signers where packet_id = p_packet_id and profile_id = auth.uid()
  );
$$;

revoke execute on function public.user_is_signer_on_packet(uuid) from public;
grant execute on function public.user_is_signer_on_packet(uuid) to authenticated;

create or replace function public.user_is_notary_on_packet(p_packet_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.notary_assignments where packet_id = p_packet_id and notary_id = auth.uid()
  );
$$;

revoke execute on function public.user_is_notary_on_packet(uuid) from public;
grant execute on function public.user_is_notary_on_packet(uuid) to authenticated;

create or replace function public.user_is_packet_signer(p_signer_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.packet_signers where id = p_signer_id and profile_id = auth.uid()
  );
$$;

revoke execute on function public.user_is_packet_signer(uuid) from public;
grant execute on function public.user_is_packet_signer(uuid) to authenticated;

create or replace function public.user_owns_signer_packet(p_signer_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.packet_signers ps
    join public.lease_packets lp on lp.id = ps.packet_id
    where ps.id = p_signer_id and lp.created_by = auth.uid()
  );
$$;

revoke execute on function public.user_owns_signer_packet(uuid) from public;
grant execute on function public.user_owns_signer_packet(uuid) to authenticated;

create or replace function public.user_is_notary_for_signer(p_signer_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.packet_signers ps
    join public.notary_assignments na on na.packet_id = ps.packet_id
    where ps.id = p_signer_id and na.notary_id = auth.uid()
  );
$$;

revoke execute on function public.user_is_notary_for_signer(uuid) from public;
grant execute on function public.user_is_notary_for_signer(uuid) to authenticated;

-- =============================================================================
-- CREATE BUCKETS
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('documents', 'documents', false, 52428800, array['application/pdf', 'image/png', 'image/jpeg']),
  ('evidence', 'evidence', false, 10485760, array['image/png', 'image/jpeg', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

-- =============================================================================
-- STORAGE POLICIES: documents bucket
-- Organized as packets/{packet_id}/filename
-- Uses safe_cast_uuid to avoid errors on malformed paths.
-- Uses SECURITY DEFINER helpers to avoid RLS recursion.
-- =============================================================================

-- Realtor uploads to own packets
create policy "Realtor uploads to own packets"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = 'packets'
    and public.user_owns_packet(public.safe_cast_uuid((storage.foldername(name))[2]))
  );

-- Realtor downloads from own packets
create policy "Realtor downloads own packet docs"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = 'packets'
    and public.user_owns_packet(public.safe_cast_uuid((storage.foldername(name))[2]))
  );

-- Signers download docs from their packets
create policy "Signers download their packet docs"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = 'packets'
    and public.user_is_signer_on_packet(public.safe_cast_uuid((storage.foldername(name))[2]))
  );

-- Notary downloads docs from assigned packets
create policy "Notary downloads assigned packet docs"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = 'packets'
    and public.user_is_notary_on_packet(public.safe_cast_uuid((storage.foldername(name))[2]))
  );

-- Admin full access to documents
create policy "Admin full access to documents"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'documents'
    and public.is_active_admin()
  );

create policy "Admin uploads to documents"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'documents'
    and public.is_active_admin()
  );

create policy "Admin deletes from documents"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'documents'
    and public.is_active_admin()
  );

-- =============================================================================
-- STORAGE POLICIES: evidence bucket
-- Organized as signers/{packet_signer_id}/filename
-- Uses safe_cast_uuid and SECURITY DEFINER helpers.
-- =============================================================================

-- Signer uploads own evidence
create policy "Signer uploads own evidence"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'evidence'
    and (storage.foldername(name))[1] = 'signers'
    and public.user_is_packet_signer(public.safe_cast_uuid((storage.foldername(name))[2]))
  );

-- Signer downloads own evidence
create policy "Signer downloads own evidence"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'evidence'
    and (storage.foldername(name))[1] = 'signers'
    and public.user_is_packet_signer(public.safe_cast_uuid((storage.foldername(name))[2]))
  );

-- Realtor downloads evidence for signers on own packets
create policy "Realtor downloads evidence on own packets"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'evidence'
    and (storage.foldername(name))[1] = 'signers'
    and public.user_owns_signer_packet(public.safe_cast_uuid((storage.foldername(name))[2]))
  );

-- Notary downloads evidence for signers on assigned packets
create policy "Notary downloads evidence on assigned packets"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'evidence'
    and (storage.foldername(name))[1] = 'signers'
    and public.user_is_notary_for_signer(public.safe_cast_uuid((storage.foldername(name))[2]))
  );

-- Admin full access to evidence
create policy "Admin full access to evidence"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'evidence'
    and public.is_active_admin()
  );

create policy "Admin uploads to evidence"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'evidence'
    and public.is_active_admin()
  );

create policy "Admin deletes from evidence"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'evidence'
    and public.is_active_admin()
  );
