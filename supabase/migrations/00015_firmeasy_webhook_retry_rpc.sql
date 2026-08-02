-- 1. Add missing columns to firmeasy_webhook_log for retry tracking
ALTER TABLE public.firmeasy_webhook_log
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS processing_started_at timestamptz;

-- Backfill processing_started_at for existing rows so the RPC's COALESCE is not needed long-term
UPDATE public.firmeasy_webhook_log
  SET processing_started_at = created_at
  WHERE processing_started_at IS NULL;

-- 2. RPC: Atomically claim a stale/failed webhook log row for retry.
--    Uses COALESCE(processing_started_at, created_at) for staleness so pre-migration
--    rows with NULL processing_started_at can still be reclaimed.
create or replace function public.claim_webhook_for_retry(
  p_log_id uuid,
  p_stale_threshold_seconds int default 300
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows int;
begin
  update firmeasy_webhook_log
  set processing_state = 'processing',
      retry_count = retry_count + 1,
      processing_started_at = now(),
      updated_at = now()
  where id = p_log_id
    and (
      processing_state = 'failed'
      or (
        processing_state = 'processing'
        and coalesce(processing_started_at, created_at) < now() - (p_stale_threshold_seconds || ' seconds')::interval
      )
    );

  get diagnostics v_rows = row_count;
  return v_rows > 0;
end;
$$;

revoke execute on function public.claim_webhook_for_retry(uuid, int) from public;
grant execute on function public.claim_webhook_for_retry(uuid, int) to service_role;

-- 3. Also add 'firmeasy_signature' to signer_evidence evidence_type CHECK.
--    The constraint needs to be dropped and recreated to add the new value.
ALTER TABLE public.signer_evidence DROP CONSTRAINT IF EXISTS signer_evidence_evidence_type_check;
ALTER TABLE public.signer_evidence ADD CONSTRAINT signer_evidence_evidence_type_check
  CHECK (evidence_type IN (
    'dni_front', 'dni_back', 'selfie', 'liveness',
    'whatsapp_otp', 'consent_record', 'property_authority',
    'digital_signature', 'firmeasy_signature'
  ));

-- 4. Add unique constraints to prevent duplicate side effects on retries.
--    These are NON-PARTIAL so that PostgREST/supabase-js onConflict can target them.

--    signature_records: one record per signer per provider document.
--    provider_document_token is NULL for non-FirmEasy records (legacy dev-stub),
--    so we use a regular unique index — NULLs are treated as distinct by Postgres,
--    meaning legacy rows without provider_document_token won't conflict with each other.
CREATE UNIQUE INDEX IF NOT EXISTS idx_signature_records_signer_provider
  ON public.signature_records(packet_signer_id, provider_document_token);

--    signer_evidence: only firmeasy_signature is deduplicated (one per signer).
--    Other evidence types (whatsapp_otp, dni_front, etc.) are legitimately
--    multi-row (OTP resends, document re-uploads). This remains partial.
--    The app layer uses select-before-insert instead of onConflict for this table.
CREATE UNIQUE INDEX IF NOT EXISTS idx_signer_evidence_firmeasy_unique
  ON public.signer_evidence(packet_signer_id)
  WHERE evidence_type = 'firmeasy_signature';

--    packet_documents: one document per packet per document_type.
--    This correctly models the domain: a packet has at most one lease_original,
--    one signed_pdf, one evidence_report, one certified_lease.
CREATE UNIQUE INDEX IF NOT EXISTS idx_packet_documents_packet_type
  ON public.packet_documents(packet_id, document_type);
