-- VeraDoc Onboarding Auth Schema
-- Tables: profiles, invitations, signing_tokens
-- RPCs: is_active_admin, claim_signing_token, lookup_invitation
-- RLS policies for all tables

-- =============================================================================
-- PROFILES
-- =============================================================================

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'notary', 'realtor', 'landlord', 'renter')),
  status text not null default 'pending_approval'
    check (status in ('active', 'pending_approval', 'rejected', 'suspended')),
  full_name text not null,
  email text not null unique,
  phone text,
  dni text,
  company_name text,
  ruc text,
  license_number text,
  accreditation_number text,
  province text,
  department text,
  invited_by uuid references public.profiles(id),
  approved_by uuid references public.profiles(id),
  approved_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;

-- =============================================================================
-- ADMIN CHECK HELPER (avoids RLS self-recursion on profiles)
-- =============================================================================
-- Policies on public.profiles cannot query public.profiles to check admin
-- status — Postgres detects the cycle and throws "infinite recursion detected
-- in policy". This SECURITY DEFINER function runs as the owner (bypassing RLS)
-- so it can read the profiles table without triggering policy evaluation.
-- It must be created after public.profiles so a clean migration replay can
-- validate the SQL-language function body.

create or replace function public.is_active_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role = 'admin'
      and status = 'active'
  );
$$;

revoke execute on function public.is_active_admin() from public;
grant execute on function public.is_active_admin() to authenticated;

-- Users can read their own profile
create policy "Users can read own profile"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

-- Admins can read all profiles (uses SECURITY DEFINER helper to avoid recursion)
create policy "Admins can read all profiles"
  on public.profiles for select
  to authenticated
  using (public.is_active_admin());

-- Admins can update profiles (uses SECURITY DEFINER helper to avoid recursion)
create policy "Admins can update profiles"
  on public.profiles for update
  to authenticated
  using (public.is_active_admin());

-- =============================================================================
-- INVITATIONS (notary invites, admin-managed)
-- =============================================================================

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  role text not null check (role in ('notary')),
  invited_by uuid not null references public.profiles(id),
  token text unique not null default encode(gen_random_bytes(32), 'hex'),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'expired', 'revoked')),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

alter table public.invitations enable row level security;

-- Admins can create invitations
create policy "Admins can create invitations"
  on public.invitations for insert
  to authenticated
  with check (public.is_active_admin());

-- Admins can read invitations (for management)
create policy "Admins can read invitations"
  on public.invitations for select
  to authenticated
  using (public.is_active_admin());

-- =============================================================================
-- SIGNING TOKENS (signer invitations tied to lease packets)
-- =============================================================================

create table public.signing_tokens (
  id uuid primary key default gen_random_uuid(),
  token_hash text unique not null,
  packet_id uuid not null,
  signer_email text not null,
  signer_whatsapp text not null,
  signer_dni text not null,
  signer_full_name text not null,
  role_in_lease text not null check (role_in_lease in ('landlord', 'renter')),
  status text not null default 'pending'
    check (status in ('pending', 'otp_verified', 'claiming', 'account_created', 'expired', 'revoked')),
  otp_verified_at timestamptz,
  auth_user_id uuid unique references auth.users(id),
  expires_at timestamptz not null default (now() + interval '30 days'),
  created_at timestamptz default now(),
  consumed_at timestamptz,
  constraint one_account_per_token check (
    (status != 'account_created') or (auth_user_id is not null and consumed_at is not null)
  )
);

alter table public.signing_tokens enable row level security;

create index idx_signing_tokens_packet on public.signing_tokens(packet_id);
create index idx_signing_tokens_email on public.signing_tokens(signer_email);

-- =============================================================================
-- REVOKE DEFAULT GRANTS
-- Prevent PostgREST enumeration of PII tables via anon/authenticated
-- =============================================================================

revoke select on public.invitations from anon;
revoke select on public.signing_tokens from anon;
revoke select on public.invitations from authenticated;
revoke select on public.signing_tokens from authenticated;

-- Re-grant only what RLS policies explicitly allow
grant select on public.invitations to authenticated;
-- signing_tokens gets NO direct select grant — all access goes through RPCs

-- =============================================================================
-- RPC: claim_signing_token
-- Atomic token claim for signer account creation. Prevents concurrency races
-- by using UPDATE ... WHERE status = 'otp_verified' RETURNING with row locks.
-- =============================================================================

create or replace function public.claim_signing_token(
  p_token_hash text
)
returns table (
  id uuid,
  signer_email text,
  signer_full_name text,
  signer_dni text,
  signer_whatsapp text,
  role_in_lease text,
  packet_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  update public.signing_tokens
  set status = 'claiming'
  where signing_tokens.token_hash = p_token_hash
    and signing_tokens.status = 'otp_verified'
    and signing_tokens.expires_at > now()
  returning
    signing_tokens.id,
    signing_tokens.signer_email,
    signing_tokens.signer_full_name,
    signing_tokens.signer_dni,
    signing_tokens.signer_whatsapp,
    signing_tokens.role_in_lease,
    signing_tokens.packet_id;
end;
$$;

-- Revoke from PUBLIC pseudo-role (all roles inherit from it by default),
-- then grant only to service_role. Server actions call this via admin client.
revoke execute on function public.claim_signing_token(text) from public;
grant execute on function public.claim_signing_token(text) to service_role;

-- =============================================================================
-- RPC: lookup_invitation
-- Secure invitation token lookup. Returns only pending, unexpired invitations.
-- Includes invited_by so the acceptNotaryInvite action can record who invited
-- the notary on their profiles row.
-- =============================================================================

create or replace function public.lookup_invitation(
  p_token text
)
returns table (
  id uuid,
  email text,
  role text,
  status text,
  expires_at timestamptz,
  invited_by uuid
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select
    inv.id,
    inv.email,
    inv.role,
    inv.status,
    inv.expires_at,
    inv.invited_by
  from public.invitations inv
  where inv.token = p_token
    and inv.status = 'pending'
    and inv.expires_at > now();
end;
$$;

-- Revoke from PUBLIC pseudo-role, then grant only to authenticated
revoke execute on function public.lookup_invitation(text) from public;
grant execute on function public.lookup_invitation(text) to authenticated;
