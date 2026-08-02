-- =============================================================================
-- Migration 00014: FirmEasy Integration
-- Adds columns and tables to support FirmEasy digital signature provider.
-- =============================================================================

-- =============================================================================
-- SYSTEM ACTOR: Make uploaded_by nullable for system-generated documents
-- =============================================================================
-- The webhook handler runs without an authenticated user. Rather than seeding
-- a fake auth.users row, we make uploaded_by nullable. System-generated
-- documents (signed PDF from FirmEasy webhook) use NULL for uploaded_by, with
-- traceability via packet_audit_log metadata (system_source: "firmeasy_webhook").
ALTER TABLE public.packet_documents
  ALTER COLUMN uploaded_by DROP NOT NULL;

-- =============================================================================
-- FIRMEASY TRACKING COLUMNS ON LEASE_PACKETS
-- =============================================================================
ALTER TABLE public.lease_packets
  ADD COLUMN IF NOT EXISTS firmeasy_document_token text,
  ADD COLUMN IF NOT EXISTS firmeasy_document_status text;

CREATE INDEX idx_lease_packets_firmeasy_token
  ON public.lease_packets(firmeasy_document_token)
  WHERE firmeasy_document_token IS NOT NULL;

-- =============================================================================
-- FIRMEASY TRACKING COLUMNS ON PACKET_SIGNERS
-- =============================================================================
ALTER TABLE public.packet_signers
  ADD COLUMN IF NOT EXISTS firmeasy_signer_token text,
  ADD COLUMN IF NOT EXISTS firmeasy_signer_link text,
  ADD COLUMN IF NOT EXISTS firmeasy_signer_status text;

-- =============================================================================
-- PROVIDER COLUMNS ON SIGNATURE_RECORDS
-- =============================================================================
ALTER TABLE public.signature_records
  ADD COLUMN IF NOT EXISTS provider_name text,
  ADD COLUMN IF NOT EXISTS provider_document_token text,
  ADD COLUMN IF NOT EXISTS provider_signer_token text,
  ADD COLUMN IF NOT EXISTS verification_url text,
  ADD COLUMN IF NOT EXISTS provider_signed_at timestamptz;

-- =============================================================================
-- WEBHOOK RECEIPT LOG (idempotency + audit)
-- =============================================================================
CREATE TABLE public.firmeasy_webhook_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  document_token text,
  signer_token text,
  payload_hash text NOT NULL UNIQUE,
  raw_payload jsonb NOT NULL DEFAULT '{}',
  processing_state text NOT NULL DEFAULT 'received'
    CHECK (processing_state IN ('received', 'processing', 'processed', 'failed')),
  retry_count int NOT NULL DEFAULT 0,
  processed_at timestamptz,
  error_message text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.firmeasy_webhook_log ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_firmeasy_webhook_document_token
  ON public.firmeasy_webhook_log(document_token);

-- No authenticated access; only service_role
REVOKE SELECT ON public.firmeasy_webhook_log FROM anon;
GRANT ALL ON public.firmeasy_webhook_log TO service_role;

-- =============================================================================
-- WIDEN SIGNER_EVIDENCE CHECK to include 'firmeasy_signature'
-- =============================================================================
ALTER TABLE public.signer_evidence
  DROP CONSTRAINT IF EXISTS signer_evidence_evidence_type_check;
ALTER TABLE public.signer_evidence
  ADD CONSTRAINT signer_evidence_evidence_type_check
  CHECK (evidence_type IN (
    'dni_front', 'dni_back', 'selfie', 'liveness',
    'whatsapp_otp', 'consent_record', 'property_authority',
    'digital_signature', 'firmeasy_signature'
  ));
