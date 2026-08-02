-- VeraDoc Production Schema
-- Tables: lease_packets, packet_documents, packet_signers, signer_evidence,
--         signature_records, notary_assignments, notary_certifications,
--         registry_entries, packet_audit_log, payments, notary_coverage
-- All tables have RLS enabled with packet-participant scoping.

-- =============================================================================
-- HELPER: check if current user is active realtor (avoids subquery repetition)
-- =============================================================================

create or replace function public.is_active_realtor()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role = 'realtor'
      and status = 'active'
  );
$$;

revoke execute on function public.is_active_realtor() from public;
grant execute on function public.is_active_realtor() to authenticated;

-- =============================================================================
-- LEASE PACKETS
-- =============================================================================

create table public.lease_packets (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles(id),
  status text not null default 'draft'
    check (status in (
      'draft', 'signing', 'all_signed', 'pending_notary',
      'under_review', 'needs_correction', 'certified', 'rejected'
    )),
  property_address text,
  property_unit text,
  district text,
  province text,
  department text,
  rental_amount numeric(12, 2),
  deposit_amount numeric(12, 2),
  lease_start_date date,
  lease_end_date date,
  document_hash text,
  submitted_to_notary_at timestamptz,
  certified_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.lease_packets enable row level security;

create index idx_lease_packets_created_by on public.lease_packets(created_by);
create index idx_lease_packets_status on public.lease_packets(status);
create index idx_lease_packets_province on public.lease_packets(province);

-- =============================================================================
-- PACKET DOCUMENTS
-- =============================================================================

create table public.packet_documents (
  id uuid primary key default gen_random_uuid(),
  packet_id uuid not null references public.lease_packets(id) on delete cascade,
  document_type text not null
    check (document_type in ('lease_original', 'signed_pdf', 'evidence_report', 'certified_lease')),
  storage_path text not null,
  file_hash text,
  version int not null default 1,
  uploaded_by uuid not null references public.profiles(id),
  created_at timestamptz default now()
);

alter table public.packet_documents enable row level security;

create index idx_packet_documents_packet on public.packet_documents(packet_id);

-- =============================================================================
-- PACKET SIGNERS
-- =============================================================================

create table public.packet_signers (
  id uuid primary key default gen_random_uuid(),
  packet_id uuid not null references public.lease_packets(id) on delete cascade,
  profile_id uuid references public.profiles(id),
  signing_token_id uuid references public.signing_tokens(id),
  role_in_lease text not null check (role_in_lease in ('landlord', 'renter')),
  signer_email text not null,
  signer_full_name text not null,
  signer_dni text not null,
  signer_whatsapp text not null,
  status text not null default 'invited'
    check (status in (
      'invited', 'otp_verified', 'account_created',
      'identity_verified', 'consent_given', 'signed', 'complete'
    )),
  signed_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz default now()
);

alter table public.packet_signers enable row level security;

create index idx_packet_signers_packet on public.packet_signers(packet_id);
create index idx_packet_signers_profile on public.packet_signers(profile_id);

-- =============================================================================
-- SIGNER EVIDENCE
-- =============================================================================

create table public.signer_evidence (
  id uuid primary key default gen_random_uuid(),
  packet_signer_id uuid not null references public.packet_signers(id) on delete cascade,
  evidence_type text not null
    check (evidence_type in (
      'dni_front', 'dni_back', 'selfie', 'liveness',
      'whatsapp_otp', 'consent_record', 'property_authority'
    )),
  storage_path text,
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

alter table public.signer_evidence enable row level security;

create index idx_signer_evidence_signer on public.signer_evidence(packet_signer_id);

-- =============================================================================
-- SIGNATURE RECORDS
-- =============================================================================

create table public.signature_records (
  id uuid primary key default gen_random_uuid(),
  packet_signer_id uuid not null references public.packet_signers(id) on delete cascade,
  certificate_subject text,
  certificate_issuer text,
  certificate_serial text,
  certificate_valid_from timestamptz,
  certificate_valid_to timestamptz,
  chain_validation_result text,
  revocation_result text,
  timestamp_result timestamptz,
  signature_valid boolean,
  pdf_integrity_valid boolean,
  signed_document_hash text,
  raw_validation_data jsonb default '{}',
  created_at timestamptz default now()
);

alter table public.signature_records enable row level security;

create index idx_signature_records_signer on public.signature_records(packet_signer_id);

-- =============================================================================
-- NOTARY ASSIGNMENTS
-- =============================================================================

create table public.notary_assignments (
  id uuid primary key default gen_random_uuid(),
  packet_id uuid not null unique references public.lease_packets(id) on delete cascade,
  notary_id uuid not null references public.profiles(id),
  assigned_at timestamptz default now(),
  review_started_at timestamptz,
  decision text check (decision in ('certified', 'certified_with_observations', 'needs_correction', 'rejected')),
  decided_at timestamptz,
  observations text
);

alter table public.notary_assignments enable row level security;

create index idx_notary_assignments_notary on public.notary_assignments(notary_id);

-- =============================================================================
-- NOTARY CERTIFICATIONS
-- =============================================================================

create table public.notary_certifications (
  id uuid primary key default gen_random_uuid(),
  packet_id uuid not null references public.lease_packets(id) on delete cascade,
  notary_id uuid not null references public.profiles(id),
  certified_at timestamptz default now(),
  certification_type text not null
    check (certification_type in ('certified', 'certified_with_observations')),
  observations text,
  checklist_data jsonb default '{}'
);

alter table public.notary_certifications enable row level security;

create index idx_notary_certifications_packet on public.notary_certifications(packet_id);
create index idx_notary_certifications_notary on public.notary_certifications(notary_id);

-- =============================================================================
-- REGISTRY ENTRIES
-- =============================================================================

create table public.registry_entries (
  id uuid primary key default gen_random_uuid(),
  packet_id uuid not null references public.lease_packets(id) on delete cascade,
  property_address text not null,
  property_unit text,
  district text,
  province text,
  landlord_dni text not null,
  renter_dni text not null,
  lease_start_date date not null,
  lease_end_date date not null,
  status text not null default 'active'
    check (status in ('active', 'expired', 'terminated')),
  certified_at timestamptz,
  created_at timestamptz default now()
);

alter table public.registry_entries enable row level security;

create index idx_registry_entries_property on public.registry_entries(property_address, property_unit);
create index idx_registry_entries_landlord on public.registry_entries(landlord_dni);
create index idx_registry_entries_renter on public.registry_entries(renter_dni);
create index idx_registry_entries_dates on public.registry_entries(lease_start_date, lease_end_date);

-- =============================================================================
-- PACKET AUDIT LOG (immutable)
-- =============================================================================

create table public.packet_audit_log (
  id uuid primary key default gen_random_uuid(),
  packet_id uuid not null references public.lease_packets(id) on delete cascade,
  actor_id uuid references public.profiles(id),
  action text not null,
  metadata jsonb default '{}',
  ip_address inet,
  created_at timestamptz default now()
);

alter table public.packet_audit_log enable row level security;

create index idx_audit_log_packet on public.packet_audit_log(packet_id);
create index idx_audit_log_actor on public.packet_audit_log(actor_id);

-- =============================================================================
-- PAYMENTS
-- =============================================================================

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  packet_id uuid not null references public.lease_packets(id) on delete cascade,
  realtor_id uuid not null references public.profiles(id),
  amount numeric(12, 2) not null,
  currency text not null default 'PEN',
  status text not null default 'pending'
    check (status in ('pending', 'completed', 'refunded')),
  payment_provider_ref text,
  paid_at timestamptz,
  created_at timestamptz default now()
);

alter table public.payments enable row level security;

create index idx_payments_realtor on public.payments(realtor_id);
create index idx_payments_packet on public.payments(packet_id);

-- =============================================================================
-- NOTARY COVERAGE
-- =============================================================================

create table public.notary_coverage (
  id uuid primary key default gen_random_uuid(),
  notary_id uuid not null references public.profiles(id),
  province text not null,
  department text,
  active boolean not null default true,
  created_at timestamptz default now(),
  unique (notary_id, province)
);

alter table public.notary_coverage enable row level security;

create index idx_notary_coverage_province on public.notary_coverage(province);
create index idx_notary_coverage_notary on public.notary_coverage(notary_id);

-- =============================================================================
-- HELPERS: packet participation lookups (bypass RLS to prevent recursion)
-- These SECURITY DEFINER functions return the set of packet IDs a user can
-- access through each participation path. Policies reference these instead of
-- doing cross-table subqueries that would trigger circular RLS evaluation.
-- Defined AFTER all tables exist so SQL function bodies resolve correctly.
-- =============================================================================

-- Packets where the user is the creating realtor
create or replace function public.packets_as_realtor()
returns setof uuid
language sql
security definer
set search_path = public
stable
as $$
  select id from public.lease_packets where created_by = auth.uid();
$$;

revoke execute on function public.packets_as_realtor() from public;
grant execute on function public.packets_as_realtor() to authenticated;

-- Packets where the user is a linked signer
create or replace function public.packets_as_signer()
returns setof uuid
language sql
security definer
set search_path = public
stable
as $$
  select packet_id from public.packet_signers where profile_id = auth.uid();
$$;

revoke execute on function public.packets_as_signer() from public;
grant execute on function public.packets_as_signer() to authenticated;

-- Packets where the user is the assigned notary
create or replace function public.packets_as_notary()
returns setof uuid
language sql
security definer
set search_path = public
stable
as $$
  select packet_id from public.notary_assignments where notary_id = auth.uid();
$$;

revoke execute on function public.packets_as_notary() from public;
grant execute on function public.packets_as_notary() to authenticated;

-- Packet-signer IDs where the user is the linked signer
create or replace function public.my_packet_signer_ids()
returns setof uuid
language sql
security definer
set search_path = public
stable
as $$
  select id from public.packet_signers where profile_id = auth.uid();
$$;

revoke execute on function public.my_packet_signer_ids() from public;
grant execute on function public.my_packet_signer_ids() to authenticated;

-- Packet-signer IDs on packets owned by the calling realtor
create or replace function public.signer_ids_on_own_packets()
returns setof uuid
language sql
security definer
set search_path = public
stable
as $$
  select ps.id from public.packet_signers ps
  join public.lease_packets lp on lp.id = ps.packet_id
  where lp.created_by = auth.uid();
$$;

revoke execute on function public.signer_ids_on_own_packets() from public;
grant execute on function public.signer_ids_on_own_packets() to authenticated;

-- Packet-signer IDs on packets assigned to the calling notary
create or replace function public.signer_ids_on_notary_packets()
returns setof uuid
language sql
security definer
set search_path = public
stable
as $$
  select ps.id from public.packet_signers ps
  join public.notary_assignments na on na.packet_id = ps.packet_id
  where na.notary_id = auth.uid();
$$;

revoke execute on function public.signer_ids_on_notary_packets() from public;
grant execute on function public.signer_ids_on_notary_packets() to authenticated;

-- =============================================================================
-- REVOKE DEFAULT GRANTS (prevent PostgREST enumeration)
-- =============================================================================

revoke select on public.lease_packets from anon;
revoke select on public.packet_documents from anon;
revoke select on public.packet_signers from anon;
revoke select on public.signer_evidence from anon;
revoke select on public.signature_records from anon;
revoke select on public.notary_assignments from anon;
revoke select on public.notary_certifications from anon;
revoke select on public.registry_entries from anon;
revoke select on public.packet_audit_log from anon;
revoke select on public.payments from anon;
revoke select on public.notary_coverage from anon;

-- Grant select back to authenticated (RLS will enforce row-level access)
grant select on public.lease_packets to authenticated;
grant select on public.packet_documents to authenticated;
grant select on public.packet_signers to authenticated;
grant select on public.signer_evidence to authenticated;
grant select on public.signature_records to authenticated;
grant select on public.notary_assignments to authenticated;
grant select on public.notary_certifications to authenticated;
grant select on public.registry_entries to authenticated;
grant select on public.packet_audit_log to authenticated;
grant select on public.payments to authenticated;
grant select on public.notary_coverage to authenticated;

-- Grant insert/update where needed for authenticated users
grant insert on public.lease_packets to authenticated;
grant update on public.lease_packets to authenticated;
grant insert on public.packet_documents to authenticated;
grant insert on public.packet_signers to authenticated;
-- No UPDATE grant for authenticated on packet_signers: status transitions are service-role only
grant update on public.packet_signers to service_role;
grant insert on public.signer_evidence to authenticated;
grant insert on public.signature_records to authenticated;
grant insert on public.notary_assignments to authenticated;
grant update on public.notary_assignments to authenticated;
grant insert on public.notary_certifications to authenticated;
grant insert on public.registry_entries to authenticated;
grant insert on public.notary_coverage to authenticated;
grant update on public.notary_coverage to authenticated;

-- Audit log and payments: insert only via service_role
grant insert on public.packet_audit_log to service_role;
grant insert on public.payments to service_role;
grant update on public.payments to service_role;
grant select on public.packet_audit_log to service_role;
grant select on public.payments to service_role;

-- =============================================================================
-- RLS POLICIES: lease_packets
-- Uses SECURITY DEFINER helpers to avoid cross-table RLS recursion.
-- =============================================================================

create policy "Realtor reads own packets"
  on public.lease_packets for select
  to authenticated
  using (created_by = auth.uid());

create policy "Signers read their packets"
  on public.lease_packets for select
  to authenticated
  using (id in (select public.packets_as_signer()));

create policy "Assigned notary reads packets"
  on public.lease_packets for select
  to authenticated
  using (id in (select public.packets_as_notary()));

create policy "Admin reads all packets"
  on public.lease_packets for select
  to authenticated
  using (public.is_active_admin());

create policy "Realtor creates packets"
  on public.lease_packets for insert
  to authenticated
  with check (created_by = auth.uid() and public.is_active_realtor());

create policy "Realtor updates own draft packets"
  on public.lease_packets for update
  to authenticated
  using (created_by = auth.uid() and status = 'draft');

create policy "Admin updates any packet"
  on public.lease_packets for update
  to authenticated
  using (public.is_active_admin());

-- =============================================================================
-- RLS POLICIES: packet_documents
-- =============================================================================

create policy "Realtor reads docs on own packets"
  on public.packet_documents for select
  to authenticated
  using (packet_id in (select public.packets_as_realtor()));

create policy "Signers read docs on their packets"
  on public.packet_documents for select
  to authenticated
  using (packet_id in (select public.packets_as_signer()));

create policy "Notary reads docs on assigned packets"
  on public.packet_documents for select
  to authenticated
  using (packet_id in (select public.packets_as_notary()));

create policy "Admin reads all docs"
  on public.packet_documents for select
  to authenticated
  using (public.is_active_admin());

create policy "Realtor uploads docs to own packets"
  on public.packet_documents for insert
  to authenticated
  with check (
    uploaded_by = auth.uid()
    and packet_id in (select public.packets_as_realtor())
  );

-- =============================================================================
-- RLS POLICIES: packet_signers
-- =============================================================================

create policy "Signer reads own record"
  on public.packet_signers for select
  to authenticated
  using (profile_id = auth.uid());

create policy "Realtor reads signers on own packets"
  on public.packet_signers for select
  to authenticated
  using (packet_id in (select public.packets_as_realtor()));

create policy "Notary reads signers on assigned packets"
  on public.packet_signers for select
  to authenticated
  using (packet_id in (select public.packets_as_notary()));

create policy "Admin reads all signers"
  on public.packet_signers for select
  to authenticated
  using (public.is_active_admin());

create policy "Realtor adds signers to own packets"
  on public.packet_signers for insert
  to authenticated
  with check (packet_id in (select public.packets_as_realtor()));

-- No UPDATE policy for authenticated. Signer status transitions are controlled
-- exclusively through the advance_signer_status RPC (service_role).

-- =============================================================================
-- RLS POLICIES: signer_evidence
-- =============================================================================

create policy "Signer reads own evidence"
  on public.signer_evidence for select
  to authenticated
  using (packet_signer_id in (select public.my_packet_signer_ids()));

create policy "Realtor reads evidence on own packets"
  on public.signer_evidence for select
  to authenticated
  using (packet_signer_id in (select public.signer_ids_on_own_packets()));

create policy "Notary reads evidence on assigned packets"
  on public.signer_evidence for select
  to authenticated
  using (packet_signer_id in (select public.signer_ids_on_notary_packets()));

create policy "Admin reads all evidence"
  on public.signer_evidence for select
  to authenticated
  using (public.is_active_admin());

create policy "Signer uploads own evidence"
  on public.signer_evidence for insert
  to authenticated
  with check (packet_signer_id in (select public.my_packet_signer_ids()));

-- =============================================================================
-- RLS POLICIES: signature_records
-- =============================================================================

create policy "Signer reads own signatures"
  on public.signature_records for select
  to authenticated
  using (packet_signer_id in (select public.my_packet_signer_ids()));

create policy "Realtor reads signatures on own packets"
  on public.signature_records for select
  to authenticated
  using (packet_signer_id in (select public.signer_ids_on_own_packets()));

create policy "Notary reads signatures on assigned packets"
  on public.signature_records for select
  to authenticated
  using (packet_signer_id in (select public.signer_ids_on_notary_packets()));

create policy "Admin reads all signatures"
  on public.signature_records for select
  to authenticated
  using (public.is_active_admin());

create policy "Signer inserts own signature record"
  on public.signature_records for insert
  to authenticated
  with check (packet_signer_id in (select public.my_packet_signer_ids()));

-- =============================================================================
-- RLS POLICIES: notary_assignments
-- =============================================================================

create policy "Notary reads own assignments"
  on public.notary_assignments for select
  to authenticated
  using (notary_id = auth.uid());

create policy "Realtor reads assignments on own packets"
  on public.notary_assignments for select
  to authenticated
  using (packet_id in (select public.packets_as_realtor()));

create policy "Admin reads all assignments"
  on public.notary_assignments for select
  to authenticated
  using (public.is_active_admin());

create policy "Admin creates assignments"
  on public.notary_assignments for insert
  to authenticated
  with check (public.is_active_admin());

create policy "Notary updates own assignments"
  on public.notary_assignments for update
  to authenticated
  using (notary_id = auth.uid());

create policy "Admin updates any assignment"
  on public.notary_assignments for update
  to authenticated
  using (public.is_active_admin());

-- =============================================================================
-- RLS POLICIES: notary_certifications
-- =============================================================================

create policy "Notary reads own certifications"
  on public.notary_certifications for select
  to authenticated
  using (notary_id = auth.uid());

create policy "Realtor reads certifications on own packets"
  on public.notary_certifications for select
  to authenticated
  using (packet_id in (select public.packets_as_realtor()));

create policy "Signers read certifications on their packets"
  on public.notary_certifications for select
  to authenticated
  using (packet_id in (select public.packets_as_signer()));

create policy "Admin reads all certifications"
  on public.notary_certifications for select
  to authenticated
  using (public.is_active_admin());

create policy "Notary creates certifications"
  on public.notary_certifications for insert
  to authenticated
  with check (
    notary_id = auth.uid()
    and packet_id in (select public.packets_as_notary())
  );

-- =============================================================================
-- RLS POLICIES: registry_entries
-- =============================================================================

create policy "Realtor reads registry for own packets"
  on public.registry_entries for select
  to authenticated
  using (packet_id in (select public.packets_as_realtor()));

create policy "Landlord reads registry by DNI"
  on public.registry_entries for select
  to authenticated
  using (
    landlord_dni in (select dni from public.profiles where id = auth.uid())
  );

create policy "Renter reads registry by DNI"
  on public.registry_entries for select
  to authenticated
  using (
    renter_dni in (select dni from public.profiles where id = auth.uid())
  );

create policy "Notary reads registry for assigned packets"
  on public.registry_entries for select
  to authenticated
  using (packet_id in (select public.packets_as_notary()));

create policy "Admin reads all registry"
  on public.registry_entries for select
  to authenticated
  using (public.is_active_admin());

create policy "Admin creates registry entries"
  on public.registry_entries for insert
  to authenticated
  with check (public.is_active_admin());

-- =============================================================================
-- RLS POLICIES: packet_audit_log (immutable -- no UPDATE/DELETE)
-- =============================================================================

create policy "Realtor reads audit log on own packets"
  on public.packet_audit_log for select
  to authenticated
  using (packet_id in (select public.packets_as_realtor()));

create policy "Notary reads audit log on assigned packets"
  on public.packet_audit_log for select
  to authenticated
  using (packet_id in (select public.packets_as_notary()));

create policy "Admin reads all audit logs"
  on public.packet_audit_log for select
  to authenticated
  using (public.is_active_admin());

-- No insert policy for authenticated -- inserts go through service_role only

-- =============================================================================
-- RLS POLICIES: payments
-- =============================================================================

create policy "Realtor reads own payments"
  on public.payments for select
  to authenticated
  using (realtor_id = auth.uid());

create policy "Admin reads all payments"
  on public.payments for select
  to authenticated
  using (public.is_active_admin());

-- No insert/update policy for authenticated -- managed via service_role only

-- =============================================================================
-- RLS POLICIES: notary_coverage
-- =============================================================================

create policy "Anyone authenticated reads active coverage"
  on public.notary_coverage for select
  to authenticated
  using (active = true);

create policy "Admin reads all coverage"
  on public.notary_coverage for select
  to authenticated
  using (public.is_active_admin());

create policy "Admin manages coverage"
  on public.notary_coverage for insert
  to authenticated
  with check (public.is_active_admin());

create policy "Admin updates coverage"
  on public.notary_coverage for update
  to authenticated
  using (public.is_active_admin());

-- =============================================================================
-- RPC: check_duplicate_lease
-- Returns overlap count and date ranges only. Does NOT expose DNI to prevent
-- PII leakage. Restricted to active realtors and admins.
-- =============================================================================

create or replace function public.check_duplicate_lease(
  p_property_address text,
  p_property_unit text,
  p_lease_start date,
  p_lease_end date
)
returns table (
  overlap_count bigint,
  earliest_start date,
  latest_end date
)
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Allow service_role (admin client), active realtors, and admins
  if current_setting('role', true) is distinct from 'service_role'
     and not (public.is_active_realtor() or public.is_active_admin()) then
    raise exception 'No autorizado para verificar duplicados de arrendamiento.';
  end if;

  return query
  select
    count(*)::bigint as overlap_count,
    min(re.lease_start_date) as earliest_start,
    max(re.lease_end_date) as latest_end
  from public.registry_entries re
  where re.property_address = p_property_address
    and (re.property_unit = p_property_unit or (re.property_unit is null and p_property_unit is null))
    and re.status = 'active'
    and re.lease_start_date < p_lease_end
    and re.lease_end_date > p_lease_start;
end;
$$;

revoke execute on function public.check_duplicate_lease(text, text, date, date) from public;
grant execute on function public.check_duplicate_lease(text, text, date, date) to authenticated;
grant execute on function public.check_duplicate_lease(text, text, date, date) to service_role;

-- =============================================================================
-- RPC: advance_signer_status
-- Enforces a strict status state machine for packet_signers. Only service_role
-- can call this. Prevents arbitrary client-side status mutations.
-- =============================================================================

create or replace function public.advance_signer_status(
  p_signer_id uuid,
  p_new_status text,
  p_profile_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_status text;
  v_valid_transitions jsonb := '{
    "invited": ["otp_verified"],
    "otp_verified": ["account_created"],
    "account_created": ["identity_verified"],
    "identity_verified": ["consent_given"],
    "consent_given": ["signed"],
    "signed": ["complete"]
  }'::jsonb;
  v_allowed jsonb;
begin
  select status into v_current_status
  from public.packet_signers
  where id = p_signer_id
  for update;

  if v_current_status is null then
    raise exception 'Signer not found: %', p_signer_id;
  end if;

  v_allowed := v_valid_transitions -> v_current_status;

  if v_allowed is null or not v_allowed ? p_new_status then
    raise exception 'Invalid transition from % to %', v_current_status, p_new_status;
  end if;

  update public.packet_signers
  set
    status = p_new_status,
    profile_id = coalesce(p_profile_id, profile_id),
    signed_at = case when p_new_status = 'signed' then now() else signed_at end,
    completed_at = case when p_new_status = 'complete' then now() else completed_at end
  where id = p_signer_id;
end;
$$;

revoke execute on function public.advance_signer_status(uuid, text, uuid) from public;
grant execute on function public.advance_signer_status(uuid, text, uuid) to service_role;
