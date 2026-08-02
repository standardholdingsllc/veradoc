-- =============================================================================
-- 00004: Production RPCs, triggers, and schema additions
-- =============================================================================

-- 1. UPDATED_AT TRIGGER (reusable)
-- =============================================================================

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_lease_packets_updated_at
  before update on public.lease_packets
  for each row execute function public.set_updated_at();

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- 2. PACKET CODE (auto-generated on insert via sequence)
-- =============================================================================

alter table public.lease_packets
  add column if not exists packet_code text unique;

create sequence if not exists public.lease_packet_code_seq;

create or replace function public.generate_packet_code()
returns trigger as $$
declare
  v_year int := extract(year from now());
  v_seq int;
begin
  v_seq := nextval('public.lease_packet_code_seq');
  new.packet_code := 'PKT-' || v_year || '-' || lpad(v_seq::text, 4, '0');
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_lease_packets_code on public.lease_packets;
create trigger trg_lease_packets_code
  before insert on public.lease_packets
  for each row when (new.packet_code is null)
  execute function public.generate_packet_code();

-- 2b. PROFILE SELF-UPDATE
-- Column-level GRANT restricts which columns can be SET.
-- RLS policy restricts which rows.
-- =============================================================================

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'Users can update own profile'
  ) then
    execute $policy$
      create policy "Users can update own profile"
        on public.profiles for update
        to authenticated
        using (auth.uid() = id)
        with check (auth.uid() = id)
    $policy$;
  end if;
end;
$$;

grant update (full_name, phone, company_name, ruc) on public.profiles to authenticated;

-- 3. LOOKUP SIGNING CONTEXT (service_role only, read-only)
-- =============================================================================

create or replace function public.lookup_signing_context(p_token_hash text)
returns table (
  token_id uuid,
  packet_id uuid,
  signer_email text,
  signer_full_name text,
  role_in_lease text,
  token_status text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select
    st.id,
    st.packet_id,
    st.signer_email,
    st.signer_full_name,
    st.role_in_lease,
    st.status,
    st.expires_at
  from public.signing_tokens st
  where st.token_hash = p_token_hash
    and st.status in ('pending', 'otp_verified', 'account_created', 'claiming')
    and st.expires_at > now();
end;
$$;

revoke execute on function public.lookup_signing_context(text) from public;
grant execute on function public.lookup_signing_context(text) to service_role;

-- 4. VERIFY SIGNING OTP (service_role only)
-- =============================================================================

create or replace function public.verify_signing_otp(p_token_hash text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.signing_tokens
  set status = 'otp_verified', otp_verified_at = now()
  where token_hash = p_token_hash
    and status = 'pending'
    and expires_at > now();

  if not found then
    raise exception 'Token not found or not in pending state';
  end if;
end;
$$;

revoke execute on function public.verify_signing_otp(text) from public;
grant execute on function public.verify_signing_otp(text) to service_role;

-- 5. TRANSITION PACKET STATUS (service_role only)
-- =============================================================================

create or replace function public.transition_packet_status(
  p_packet_id uuid,
  p_new_status text,
  p_actor_id uuid,
  p_action text,
  p_metadata jsonb default '{}'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_status text;
  v_valid_transitions jsonb := '{
    "draft": ["signing"],
    "signing": ["all_signed", "needs_correction"],
    "all_signed": ["pending_notary"],
    "pending_notary": ["under_review"],
    "under_review": ["certified", "needs_correction", "rejected"],
    "needs_correction": ["signing", "pending_notary"]
  }'::jsonb;
  v_allowed jsonb;
begin
  select status into v_current_status
  from public.lease_packets
  where id = p_packet_id
  for update;

  if v_current_status is null then
    raise exception 'Packet not found: %', p_packet_id;
  end if;

  v_allowed := v_valid_transitions -> v_current_status;

  if v_allowed is null or not v_allowed ? p_new_status then
    raise exception 'Invalid transition from % to %', v_current_status, p_new_status;
  end if;

  update public.lease_packets
  set status = p_new_status
  where id = p_packet_id;

  insert into public.packet_audit_log (packet_id, actor_id, action, metadata)
  values (p_packet_id, p_actor_id, p_action, p_metadata);
end;
$$;

revoke execute on function public.transition_packet_status(uuid, text, uuid, text, jsonb) from public;
grant execute on function public.transition_packet_status(uuid, text, uuid, text, jsonb) to service_role;
