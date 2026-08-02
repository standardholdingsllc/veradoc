-- =============================================================================
-- Migration 00005: Signer Status Reconciliation
-- Reorders advance_signer_status transitions to match the production signing
-- flow: consent comes before identity verification.
--
-- Old order: invited -> otp_verified -> account_created -> identity_verified -> consent_given -> signed -> complete
-- New order: invited -> otp_verified -> account_created -> consent_given -> identity_verified -> signed -> complete
--
-- Also adds 'digital_signature' to signer_evidence.evidence_type CHECK.
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
    "account_created": ["consent_given"],
    "consent_given": ["identity_verified"],
    "identity_verified": ["signed"],
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

-- Widen signer_evidence.evidence_type CHECK to include 'digital_signature'
alter table public.signer_evidence
  drop constraint if exists signer_evidence_evidence_type_check;

alter table public.signer_evidence
  add constraint signer_evidence_evidence_type_check
  check (evidence_type in (
    'dni_front', 'dni_back', 'selfie', 'liveness',
    'whatsapp_otp', 'consent_record', 'property_authority',
    'digital_signature'
  ));
