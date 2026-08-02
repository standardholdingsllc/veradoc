-- =============================================================================
-- Migration 00006: OTP codes table for WhatsApp verification
-- Stores hashed OTP codes with expiry for rate limiting and verification.
-- =============================================================================

create table public.otp_codes (
  id uuid primary key default gen_random_uuid(),
  signing_token_id uuid not null references public.signing_tokens(id) on delete cascade,
  otp_hash text not null,
  expires_at timestamptz not null default (now() + interval '5 minutes'),
  verified boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_otp_codes_token on public.otp_codes(signing_token_id);
create index idx_otp_codes_created on public.otp_codes(created_at);

alter table public.otp_codes enable row level security;

revoke all on public.otp_codes from public, authenticated;
grant select, insert, update on public.otp_codes to service_role;
