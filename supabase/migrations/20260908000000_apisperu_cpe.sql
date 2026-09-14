-- Migration: 20260908000000_apisperu_cpe.sql
-- Electronic CPE issuance with APIsPERU Facturación v1.3.
-- Adds: payment purchaser snapshot, payment_refunds, invoices (generic CPE table),
-- correlativo sequences, fenced RPCs, private artifact storage, and cpe_prepare
-- event enqueue in process_payment_success.

-- =============================================================================
-- 1. PAYMENT PURCHASER SNAPSHOT
-- =============================================================================

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS comprobante_type text,
  ADD COLUMN IF NOT EXISTS purchaser_tipo_doc text,
  ADD COLUMN IF NOT EXISTS purchaser_num_doc text,
  ADD COLUMN IF NOT EXISTS purchaser_razon_social text,
  ADD COLUMN IF NOT EXISTS purchaser_address jsonb,
  ADD COLUMN IF NOT EXISTS cpe_snapshot_version smallint;

-- Factura (01) requires RUC (tipo_doc '6') with valid 11-digit number and nonblank name
ALTER TABLE public.payments
  ADD CONSTRAINT payments_cpe_factura_check
  CHECK (
    comprobante_type IS NULL
    OR comprobante_type != '01'
    OR (
      purchaser_tipo_doc = '6'
      AND purchaser_num_doc ~ '^\d{11}$'
      AND btrim(COALESCE(purchaser_razon_social, '')) != ''
    )
  );

-- Boleta (03) requires DNI (tipo_doc '1') with 8-digit number (VeraDoc MVP policy)
ALTER TABLE public.payments
  ADD CONSTRAINT payments_cpe_boleta_check
  CHECK (
    comprobante_type IS NULL
    OR comprobante_type != '03'
    OR (
      purchaser_tipo_doc = '1'
      AND purchaser_num_doc ~ '^\d{8}$'
    )
  );

-- Only 01 or 03 allowed
ALTER TABLE public.payments
  ADD CONSTRAINT payments_comprobante_type_check
  CHECK (comprobante_type IS NULL OR comprobante_type IN ('01', '03'));

-- Immutability trigger: reject purchaser changes after payment leaves 'prepared'
CREATE OR REPLACE FUNCTION public.payments_purchaser_immutable()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status NOT IN ('prepared', 'failed') THEN
    IF NEW.comprobante_type IS DISTINCT FROM OLD.comprobante_type
       OR NEW.purchaser_tipo_doc IS DISTINCT FROM OLD.purchaser_tipo_doc
       OR NEW.purchaser_num_doc IS DISTINCT FROM OLD.purchaser_num_doc
       OR NEW.purchaser_razon_social IS DISTINCT FROM OLD.purchaser_razon_social
       OR NEW.purchaser_address IS DISTINCT FROM OLD.purchaser_address
    THEN
      RAISE EXCEPTION 'Purchaser snapshot is immutable after payment leaves prepared/failed state';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_payments_purchaser_immutable ON public.payments;
CREATE TRIGGER trg_payments_purchaser_immutable
  BEFORE UPDATE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.payments_purchaser_immutable();

-- =============================================================================
-- 2. PAYMENT REFUNDS
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.payment_refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES public.payments(id) ON DELETE RESTRICT,
  packet_id uuid NOT NULL REFERENCES public.lease_packets(id) ON DELETE RESTRICT,
  realtor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  requested_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  request_id uuid NOT NULL UNIQUE,
  provider text NOT NULL CHECK (provider = 'mercadopago'),
  provider_refund_id text UNIQUE,
  provider_idempotency_key text NOT NULL UNIQUE,
  amount_centimos integer NOT NULL CHECK (amount_centimos > 0),
  currency text NOT NULL CHECK (currency = 'PEN'),
  reason_code text NOT NULL CHECK (reason_code IN ('01', '09')),
  reason_description text NOT NULL CHECK (char_length(btrim(reason_description)) BETWEEN 1 AND 250),
  status text NOT NULL CHECK (status IN ('pending', 'succeeded', 'failed', 'manual_review')),
  provider_response jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  refunded_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_refunds ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.payment_refunds FROM anon;
REVOKE ALL ON public.payment_refunds FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON public.payment_refunds TO service_role;

CREATE INDEX IF NOT EXISTS idx_payment_refunds_payment
  ON public.payment_refunds (payment_id);

-- =============================================================================
-- 3. INVOICES (CPE) TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  packet_id uuid NOT NULL REFERENCES public.lease_packets(id) ON DELETE RESTRICT,
  payment_id uuid NOT NULL REFERENCES public.payments(id) ON DELETE RESTRICT,
  realtor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  refund_id uuid REFERENCES public.payment_refunds(id) ON DELETE RESTRICT,
  related_invoice_id uuid REFERENCES public.invoices(id) ON DELETE RESTRICT,

  tipo_doc text NOT NULL CHECK (tipo_doc IN ('01', '03', '07')),
  serie text NOT NULL,
  correlativo text NOT NULL,

  status text NOT NULL CHECK (status IN (
    'pending', 'submitted', 'accepted', 'available', 'rejected', 'manual_review'
  )),
  next_operation text NOT NULL CHECK (next_operation IN (
    'prepare', 'submit', 'status_check', 'pdf', 'none'
  )),
  operation_status text NOT NULL CHECK (operation_status IN (
    'ready', 'processing', 'error', 'done'
  )),
  claim_operation text CHECK (claim_operation IS NULL OR claim_operation IN (
    'prepare', 'submit', 'status_check', 'pdf'
  )),
  claim_token uuid,
  claimed_at timestamptz,

  purchaser_tipo_doc text NOT NULL,
  purchaser_num_doc text NOT NULL,
  purchaser_razon_social text NOT NULL,
  purchaser_address jsonb,

  subtotal_centimos integer NOT NULL CHECK (subtotal_centimos >= 0),
  igv_centimos integer NOT NULL CHECK (igv_centimos >= 0),
  total_centimos integer NOT NULL CHECK (total_centimos > 0),
  currency text NOT NULL CHECK (currency = 'PEN'),

  request_payload jsonb,
  provider_response jsonb,
  signed_xml text,
  cdr_zip_base64 text,
  document_hash text,
  sunat_response_code text,
  sunat_cdr_description text,
  sunat_cdr_notes text[],

  xml_storage_path text,
  cdr_storage_path text,
  pdf_storage_path text,
  last_error_operation text CHECK (last_error_operation IS NULL OR last_error_operation IN (
    'prepare', 'submit', 'status_check', 'pdf', 'storage'
  )),
  last_error_code text,
  error_detail text,

  issue_date date NOT NULL,
  issued_at timestamptz NOT NULL,
  submission_intent_at timestamptz,
  accepted_at timestamptz,
  available_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Credit note (07) must have refund_id and related_invoice_id; primary (01/03) must not
  CONSTRAINT invoices_credit_note_refs CHECK (
    (tipo_doc = '07' AND refund_id IS NOT NULL AND related_invoice_id IS NOT NULL)
    OR (tipo_doc IN ('01', '03') AND refund_id IS NULL AND related_invoice_id IS NULL)
  ),
  -- request_payload must be set before submission
  CONSTRAINT invoices_payload_before_submit CHECK (
    next_operation IN ('prepare') OR request_payload IS NOT NULL
  ),
  -- submission_intent_at required for post-pending states
  CONSTRAINT invoices_intent_after_pending CHECK (
    status = 'pending' OR submission_intent_at IS NOT NULL
  ),
  -- accepted_at required for accepted and available
  CONSTRAINT invoices_accepted_at_check CHECK (
    status NOT IN ('accepted', 'available') OR accepted_at IS NOT NULL
  ),
  -- pdf_storage_path required for available
  CONSTRAINT invoices_pdf_for_available CHECK (
    status != 'available' OR pdf_storage_path IS NOT NULL
  ),
  -- Claim columns are all-null or all-non-null
  CONSTRAINT invoices_claim_consistency CHECK (
    (claim_token IS NULL AND claim_operation IS NULL AND claimed_at IS NULL)
    OR (claim_token IS NOT NULL AND claim_operation IS NOT NULL AND claimed_at IS NOT NULL)
  )
);

-- Unique document identity
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_sunat_doc
  ON public.invoices (tipo_doc, serie, correlativo);

-- One primary CPE per payment (including rejected/manual_review)
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_payment_primary
  ON public.invoices (payment_id)
  WHERE tipo_doc IN ('01', '03');

-- One credit note per refund
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_refund_note
  ON public.invoices (refund_id)
  WHERE tipo_doc = '07';

CREATE INDEX IF NOT EXISTS idx_invoices_packet
  ON public.invoices (packet_id);

CREATE INDEX IF NOT EXISTS idx_invoices_realtor
  ON public.invoices (realtor_id);

CREATE INDEX IF NOT EXISTS idx_invoices_next_operation
  ON public.invoices (next_operation, operation_status)
  WHERE operation_status IN ('ready', 'error');

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- Service role: full mutation access
REVOKE ALL ON public.invoices FROM anon;
REVOKE ALL ON public.invoices FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON public.invoices TO service_role;

-- Authenticated users: read-only safe metadata for their own rows
CREATE POLICY "Users read own invoice metadata"
  ON public.invoices FOR SELECT
  TO authenticated
  USING (realtor_id = auth.uid());

-- =============================================================================
-- 4. CORRELATIVO SEQUENCES
-- =============================================================================

-- Use four independent sequences. The starting values here assume brand-new
-- series. If existing series have prior issuance, ALTER SEQUENCE to the
-- verified next value before enabling production.
CREATE SEQUENCE IF NOT EXISTS public.cpe_correlativo_factura START 1;
CREATE SEQUENCE IF NOT EXISTS public.cpe_correlativo_boleta START 1;
CREATE SEQUENCE IF NOT EXISTS public.cpe_correlativo_credit_note_factura START 1;
CREATE SEQUENCE IF NOT EXISTS public.cpe_correlativo_credit_note_boleta START 1;

-- Service-role-only correlativo allocator
CREATE OR REPLACE FUNCTION public.allocate_cpe_correlativo(p_serie text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_val bigint;
  -- These must match the environment's configured series exactly.
  -- Update them when deploying a different series set.
  v_factura_series text;
  v_boleta_series text;
  v_cn_factura_series text;
  v_cn_boleta_series text;
BEGIN
  -- Read configured series from app.settings (set in migration or via ALTER DATABASE)
  -- For MVP, accept any F-family or B-family series and route to the correct sequence.
  IF p_serie ~ '^F' AND p_serie !~ '^(FC|FB)' THEN
    SELECT nextval('public.cpe_correlativo_factura') INTO v_val;
  ELSIF p_serie ~ '^B' AND p_serie !~ '^(BC|BB)' THEN
    SELECT nextval('public.cpe_correlativo_boleta') INTO v_val;
  ELSIF p_serie ~ '^F' THEN
    SELECT nextval('public.cpe_correlativo_credit_note_factura') INTO v_val;
  ELSIF p_serie ~ '^B' THEN
    SELECT nextval('public.cpe_correlativo_credit_note_boleta') INTO v_val;
  ELSE
    RAISE EXCEPTION 'Unknown or unconfigured series: %', p_serie;
  END IF;

  RETURN v_val::text;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.allocate_cpe_correlativo(text) FROM public;
REVOKE EXECUTE ON FUNCTION public.allocate_cpe_correlativo(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.allocate_cpe_correlativo(text) TO service_role;

-- =============================================================================
-- 5. PRIVATE ARTIFACT STORAGE
-- =============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'tax-documents',
  'tax-documents',
  false,
  10485760,  -- 10 MB
  ARRAY['application/pdf', 'application/xml', 'text/xml', 'application/zip', 'application/octet-stream']
)
ON CONFLICT (id) DO NOTHING;

-- Only service_role can write. No public/anon/authenticated direct access.
-- Downloads go through signed URLs created by server actions.

-- =============================================================================
-- 6. RPC: claim_or_create_primary_cpe
-- =============================================================================

CREATE OR REPLACE FUNCTION public.claim_or_create_primary_cpe(
  p_payment_id uuid,
  p_claim_token uuid,
  p_stale_seconds integer DEFAULT 300
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment RECORD;
  v_existing RECORD;
  v_serie text;
  v_correlativo text;
  v_new_id uuid;
  v_issue_date date;
  v_issued_at timestamptz;
BEGIN
  -- Lock the payment row
  SELECT id, packet_id, realtor_id, status, amount_centimos, currency, paid_at,
         comprobante_type, purchaser_tipo_doc, purchaser_num_doc,
         purchaser_razon_social, purchaser_address, cpe_snapshot_version
  INTO v_payment
  FROM public.payments
  WHERE id = p_payment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment not found: %', p_payment_id;
  END IF;

  -- Require captured status and complete purchaser snapshot
  IF v_payment.status NOT IN ('completed', 'partially_refunded', 'refunded') THEN
    RAISE EXCEPTION 'Payment not in captured status: %', v_payment.status;
  END IF;

  IF v_payment.cpe_snapshot_version IS NULL OR v_payment.cpe_snapshot_version < 1 THEN
    RAISE EXCEPTION 'Payment missing CPE snapshot (legacy row)';
  END IF;

  IF v_payment.comprobante_type IS NULL OR v_payment.purchaser_num_doc IS NULL THEN
    RAISE EXCEPTION 'Payment missing purchaser data';
  END IF;

  -- Check for existing primary CPE
  SELECT * INTO v_existing
  FROM public.invoices
  WHERE payment_id = p_payment_id
    AND tipo_doc IN ('01', '03')
  FOR UPDATE;

  IF FOUND THEN
    -- If it still needs prepare, try to acquire it
    IF v_existing.next_operation = 'prepare' THEN
      IF v_existing.claim_token IS NULL
         OR v_existing.claim_token = p_claim_token
         OR v_existing.claimed_at < now() - (p_stale_seconds || ' seconds')::interval
      THEN
        UPDATE public.invoices
        SET claim_operation = 'prepare',
            claim_token = p_claim_token,
            claimed_at = now(),
            operation_status = 'processing',
            updated_at = now()
        WHERE id = v_existing.id
          AND (claim_token IS NULL OR claim_token = p_claim_token
               OR claimed_at < now() - (p_stale_seconds || ' seconds')::interval);

        RETURN jsonb_build_object(
          'invoice_id', v_existing.id,
          'owned', true,
          'already_advanced', false,
          'tipo_doc', v_existing.tipo_doc,
          'serie', v_existing.serie,
          'correlativo', v_existing.correlativo,
          'payment_id', v_payment.id,
          'packet_id', v_payment.packet_id,
          'realtor_id', v_payment.realtor_id,
          'comprobante_type', v_payment.comprobante_type,
          'purchaser_tipo_doc', v_payment.purchaser_tipo_doc,
          'purchaser_num_doc', v_payment.purchaser_num_doc,
          'purchaser_razon_social', v_payment.purchaser_razon_social,
          'purchaser_address', COALESCE(v_payment.purchaser_address, '{}'::jsonb),
          'amount_centimos', v_payment.amount_centimos,
          'currency', v_payment.currency,
          'issued_at', v_existing.issued_at
        );
      ELSE
        -- Another live worker owns it
        RETURN jsonb_build_object(
          'invoice_id', v_existing.id,
          'owned', false,
          'already_advanced', false
        );
      END IF;
    END IF;

    -- Already past prepare
    RETURN jsonb_build_object(
      'invoice_id', v_existing.id,
      'owned', false,
      'already_advanced', true,
      'status', v_existing.status,
      'next_operation', v_existing.next_operation
    );
  END IF;

  -- No existing row — allocate series and correlativo
  IF v_payment.comprobante_type = '01' THEN
    v_serie := current_setting('app.factura_series', true);
  ELSE
    v_serie := current_setting('app.boleta_series', true);
  END IF;

  IF v_serie IS NULL OR v_serie = '' THEN
    RAISE EXCEPTION 'Series not configured for comprobante_type %', v_payment.comprobante_type;
  END IF;

  v_correlativo := public.allocate_cpe_correlativo(v_serie);

  -- Issue date from paid_at in Lima timezone
  v_issued_at := v_payment.paid_at;
  v_issue_date := (v_issued_at AT TIME ZONE 'America/Lima')::date;

  v_new_id := gen_random_uuid();

  INSERT INTO public.invoices (
    id, packet_id, payment_id, realtor_id,
    tipo_doc, serie, correlativo,
    status, next_operation, operation_status,
    claim_operation, claim_token, claimed_at,
    purchaser_tipo_doc, purchaser_num_doc, purchaser_razon_social, purchaser_address,
    subtotal_centimos, igv_centimos, total_centimos, currency,
    issue_date, issued_at
  ) VALUES (
    v_new_id, v_payment.packet_id, v_payment.id, v_payment.realtor_id,
    v_payment.comprobante_type, v_serie, v_correlativo,
    'pending', 'prepare', 'processing',
    'prepare', p_claim_token, now(),
    v_payment.purchaser_tipo_doc, v_payment.purchaser_num_doc,
    v_payment.purchaser_razon_social, v_payment.purchaser_address,
    0, 0, v_payment.amount_centimos, v_payment.currency,
    v_issue_date, v_issued_at
  );

  RETURN jsonb_build_object(
    'invoice_id', v_new_id,
    'owned', true,
    'already_advanced', false,
    'tipo_doc', v_payment.comprobante_type,
    'serie', v_serie,
    'correlativo', v_correlativo,
    'payment_id', v_payment.id,
    'packet_id', v_payment.packet_id,
    'realtor_id', v_payment.realtor_id,
    'comprobante_type', v_payment.comprobante_type,
    'purchaser_tipo_doc', v_payment.purchaser_tipo_doc,
    'purchaser_num_doc', v_payment.purchaser_num_doc,
    'purchaser_razon_social', v_payment.purchaser_razon_social,
    'purchaser_address', COALESCE(v_payment.purchaser_address, '{}'::jsonb),
    'amount_centimos', v_payment.amount_centimos,
    'currency', v_payment.currency,
    'issued_at', v_issued_at
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_or_create_primary_cpe(uuid, uuid, integer) FROM public;
REVOKE EXECUTE ON FUNCTION public.claim_or_create_primary_cpe(uuid, uuid, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.claim_or_create_primary_cpe(uuid, uuid, integer) TO service_role;

-- =============================================================================
-- 7. RPC: claim_or_create_credit_note
-- =============================================================================

CREATE OR REPLACE FUNCTION public.claim_or_create_credit_note(
  p_refund_id uuid,
  p_claim_token uuid,
  p_stale_seconds integer DEFAULT 300
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_refund RECORD;
  v_original RECORD;
  v_payment RECORD;
  v_existing RECORD;
  v_serie text;
  v_correlativo text;
  v_new_id uuid;
  v_cumulative_centimos bigint;
  v_issue_date date;
  v_issued_at timestamptz;
BEGIN
  -- Lock the refund
  SELECT * INTO v_refund
  FROM public.payment_refunds
  WHERE id = p_refund_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Refund not found: %', p_refund_id;
  END IF;

  IF v_refund.status != 'succeeded' THEN
    RAISE EXCEPTION 'Refund not in succeeded status: %', v_refund.status;
  END IF;

  -- Lock original CPE
  SELECT * INTO v_original
  FROM public.invoices
  WHERE payment_id = v_refund.payment_id
    AND tipo_doc IN ('01', '03')
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No primary CPE found for payment: %', v_refund.payment_id;
  END IF;

  IF v_original.status NOT IN ('accepted', 'available') THEN
    RAISE EXCEPTION 'Original CPE not accepted: status=%', v_original.status;
  END IF;

  -- Lock payment for amount cap check
  SELECT * INTO v_payment
  FROM public.payments
  WHERE id = v_refund.payment_id
  FOR UPDATE;

  -- Sum all succeeded refunds (including pending/manual_review notes)
  SELECT COALESCE(SUM(r.amount_centimos), 0) INTO v_cumulative_centimos
  FROM public.payment_refunds r
  WHERE r.payment_id = v_refund.payment_id
    AND r.status = 'succeeded';

  IF v_cumulative_centimos > v_original.total_centimos THEN
    RAISE EXCEPTION 'Cumulative refunds (%) exceed original CPE total (%)',
      v_cumulative_centimos, v_original.total_centimos;
  END IF;

  -- Check existing credit note for this refund
  SELECT * INTO v_existing
  FROM public.invoices
  WHERE refund_id = p_refund_id
    AND tipo_doc = '07'
  FOR UPDATE;

  IF FOUND THEN
    IF v_existing.next_operation = 'prepare' THEN
      IF v_existing.claim_token IS NULL
         OR v_existing.claim_token = p_claim_token
         OR v_existing.claimed_at < now() - (p_stale_seconds || ' seconds')::interval
      THEN
        UPDATE public.invoices
        SET claim_operation = 'prepare',
            claim_token = p_claim_token,
            claimed_at = now(),
            operation_status = 'processing',
            updated_at = now()
        WHERE id = v_existing.id
          AND (claim_token IS NULL OR claim_token = p_claim_token
               OR claimed_at < now() - (p_stale_seconds || ' seconds')::interval);

        RETURN jsonb_build_object(
          'invoice_id', v_existing.id,
          'owned', true,
          'already_advanced', false,
          'tipo_doc', '07',
          'serie', v_existing.serie,
          'correlativo', v_existing.correlativo,
          'original_tipo_doc', v_original.tipo_doc,
          'original_serie', v_original.serie,
          'original_correlativo', v_original.correlativo,
          'purchaser_tipo_doc', v_original.purchaser_tipo_doc,
          'purchaser_num_doc', v_original.purchaser_num_doc,
          'purchaser_razon_social', v_original.purchaser_razon_social,
          'purchaser_address', COALESCE(v_original.purchaser_address, '{}'::jsonb),
          'refund_amount_centimos', v_refund.amount_centimos,
          'reason_code', v_refund.reason_code,
          'reason_description', v_refund.reason_description,
          'issued_at', v_existing.issued_at
        );
      ELSE
        RETURN jsonb_build_object(
          'invoice_id', v_existing.id,
          'owned', false,
          'already_advanced', false
        );
      END IF;
    END IF;

    RETURN jsonb_build_object(
      'invoice_id', v_existing.id,
      'owned', false,
      'already_advanced', true,
      'status', v_existing.status,
      'next_operation', v_existing.next_operation
    );
  END IF;

  -- Allocate series based on original document family
  IF v_original.tipo_doc = '01' THEN
    v_serie := current_setting('app.credit_note_factura_series', true);
  ELSE
    v_serie := current_setting('app.credit_note_boleta_series', true);
  END IF;

  IF v_serie IS NULL OR v_serie = '' THEN
    RAISE EXCEPTION 'Credit note series not configured for original tipo_doc %', v_original.tipo_doc;
  END IF;

  v_correlativo := public.allocate_cpe_correlativo(v_serie);

  v_issued_at := v_refund.refunded_at;
  v_issue_date := (v_issued_at AT TIME ZONE 'America/Lima')::date;

  v_new_id := gen_random_uuid();

  INSERT INTO public.invoices (
    id, packet_id, payment_id, realtor_id,
    refund_id, related_invoice_id,
    tipo_doc, serie, correlativo,
    status, next_operation, operation_status,
    claim_operation, claim_token, claimed_at,
    purchaser_tipo_doc, purchaser_num_doc, purchaser_razon_social, purchaser_address,
    subtotal_centimos, igv_centimos, total_centimos, currency,
    issue_date, issued_at
  ) VALUES (
    v_new_id, v_original.packet_id, v_original.payment_id, v_original.realtor_id,
    p_refund_id, v_original.id,
    '07', v_serie, v_correlativo,
    'pending', 'prepare', 'processing',
    'prepare', p_claim_token, now(),
    v_original.purchaser_tipo_doc, v_original.purchaser_num_doc,
    v_original.purchaser_razon_social, v_original.purchaser_address,
    0, 0, v_refund.amount_centimos, v_refund.currency,
    v_issue_date, v_issued_at
  );

  RETURN jsonb_build_object(
    'invoice_id', v_new_id,
    'owned', true,
    'already_advanced', false,
    'tipo_doc', '07',
    'serie', v_serie,
    'correlativo', v_correlativo,
    'original_tipo_doc', v_original.tipo_doc,
    'original_serie', v_original.serie,
    'original_correlativo', v_original.correlativo,
    'purchaser_tipo_doc', v_original.purchaser_tipo_doc,
    'purchaser_num_doc', v_original.purchaser_num_doc,
    'purchaser_razon_social', v_original.purchaser_razon_social,
    'purchaser_address', COALESCE(v_original.purchaser_address, '{}'::jsonb),
    'refund_amount_centimos', v_refund.amount_centimos,
    'reason_code', v_refund.reason_code,
    'reason_description', v_refund.reason_description,
    'issued_at', v_issued_at
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_or_create_credit_note(uuid, uuid, integer) FROM public;
REVOKE EXECUTE ON FUNCTION public.claim_or_create_credit_note(uuid, uuid, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.claim_or_create_credit_note(uuid, uuid, integer) TO service_role;

-- =============================================================================
-- 8. RPC: complete_cpe_preparation
-- =============================================================================

CREATE OR REPLACE FUNCTION public.complete_cpe_preparation(
  p_invoice_id uuid,
  p_claim_token uuid,
  p_request_payload jsonb,
  p_subtotal_centimos integer,
  p_igv_centimos integer,
  p_total_centimos integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice RECORD;
BEGIN
  UPDATE public.invoices
  SET request_payload = p_request_payload,
      subtotal_centimos = p_subtotal_centimos,
      igv_centimos = p_igv_centimos,
      total_centimos = p_total_centimos,
      next_operation = 'submit',
      operation_status = 'ready',
      claim_operation = NULL,
      claim_token = NULL,
      claimed_at = NULL,
      updated_at = now()
  WHERE id = p_invoice_id
    AND claim_operation = 'prepare'
    AND claim_token = p_claim_token
  RETURNING * INTO v_invoice;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'lost_claim: preparation fence failed for invoice %', p_invoice_id;
  END IF;

  -- Atomically enqueue cpe_submit
  INSERT INTO public.notification_outbox (
    packet_id, event_type, recipient_key, payload, status, available_at
  ) VALUES (
    v_invoice.packet_id,
    'cpe_submit',
    'invoice:' || v_invoice.id || ':submit',
    jsonb_build_object(
      'invoice_id', v_invoice.id,
      'tipo_doc', v_invoice.tipo_doc
    ),
    'pending',
    now()
  )
  ON CONFLICT (packet_id, event_type, recipient_key) DO NOTHING;

  RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.complete_cpe_preparation(uuid, uuid, jsonb, integer, integer, integer) FROM public;
REVOKE EXECUTE ON FUNCTION public.complete_cpe_preparation(uuid, uuid, jsonb, integer, integer, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.complete_cpe_preparation(uuid, uuid, jsonb, integer, integer, integer) TO service_role;

-- =============================================================================
-- 9. RPC: claim_cpe_operation
-- =============================================================================

CREATE OR REPLACE FUNCTION public.claim_cpe_operation(
  p_invoice_id uuid,
  p_operation text,
  p_claim_token uuid,
  p_stale_seconds integer DEFAULT 300
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice RECORD;
BEGIN
  -- For submit, additionally require pending status and no prior intent
  IF p_operation = 'submit' THEN
    UPDATE public.invoices
    SET claim_operation = p_operation,
        claim_token = p_claim_token,
        claimed_at = now(),
        operation_status = 'processing',
        updated_at = now()
    WHERE id = p_invoice_id
      AND next_operation = p_operation
      AND status = 'pending'
      AND submission_intent_at IS NULL
      AND (
        claim_token IS NULL
        OR claim_token = p_claim_token
        OR claimed_at < now() - (p_stale_seconds || ' seconds')::interval
      )
    RETURNING * INTO v_invoice;
  ELSE
    UPDATE public.invoices
    SET claim_operation = p_operation,
        claim_token = p_claim_token,
        claimed_at = now(),
        operation_status = 'processing',
        updated_at = now()
    WHERE id = p_invoice_id
      AND next_operation = p_operation
      AND operation_status IN ('ready', 'error')
      AND (
        claim_token IS NULL
        OR claim_token = p_claim_token
        OR claimed_at < now() - (p_stale_seconds || ' seconds')::interval
      )
    RETURNING * INTO v_invoice;
  END IF;

  IF NOT FOUND THEN
    -- Read current state to determine why
    SELECT * INTO v_invoice FROM public.invoices WHERE id = p_invoice_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Invoice not found: %', p_invoice_id;
    END IF;
    RETURN jsonb_build_object('owned', false, 'current_status', v_invoice.status,
      'current_operation', v_invoice.next_operation);
  END IF;

  RETURN jsonb_build_object(
    'owned', true,
    'invoice_id', v_invoice.id,
    'tipo_doc', v_invoice.tipo_doc,
    'serie', v_invoice.serie,
    'correlativo', v_invoice.correlativo,
    'status', v_invoice.status,
    'next_operation', v_invoice.next_operation,
    'request_payload', v_invoice.request_payload,
    'submission_intent_at', v_invoice.submission_intent_at,
    'payment_id', v_invoice.payment_id,
    'packet_id', v_invoice.packet_id,
    'realtor_id', v_invoice.realtor_id,
    'refund_id', v_invoice.refund_id,
    'related_invoice_id', v_invoice.related_invoice_id,
    'subtotal_centimos', v_invoice.subtotal_centimos,
    'igv_centimos', v_invoice.igv_centimos,
    'total_centimos', v_invoice.total_centimos
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_cpe_operation(uuid, text, uuid, integer) FROM public;
REVOKE EXECUTE ON FUNCTION public.claim_cpe_operation(uuid, text, uuid, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.claim_cpe_operation(uuid, text, uuid, integer) TO service_role;

-- =============================================================================
-- 10. RPC: record_submission_intent
-- =============================================================================

CREATE OR REPLACE FUNCTION public.record_submission_intent(
  p_invoice_id uuid,
  p_claim_token uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice RECORD;
BEGIN
  UPDATE public.invoices
  SET status = 'submitted',
      submission_intent_at = now(),
      next_operation = 'status_check',
      updated_at = now()
  WHERE id = p_invoice_id
    AND claim_operation = 'submit'
    AND claim_token = p_claim_token
  RETURNING * INTO v_invoice;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'lost_claim: submission intent fence failed for invoice %', p_invoice_id;
  END IF;

  -- For 01/03, enqueue a status check with 2-minute delay
  IF v_invoice.tipo_doc IN ('01', '03') THEN
    INSERT INTO public.notification_outbox (
      packet_id, event_type, recipient_key, payload, status, available_at
    ) VALUES (
      v_invoice.packet_id,
      'cpe_status_check',
      'invoice:' || v_invoice.id || ':status',
      jsonb_build_object(
        'invoice_id', v_invoice.id,
        'tipo_doc', v_invoice.tipo_doc
      ),
      'pending',
      now() + interval '2 minutes'
    )
    ON CONFLICT (packet_id, event_type, recipient_key) DO UPDATE
    SET available_at = EXCLUDED.available_at,
        status = 'pending',
        updated_at = now()
    WHERE notification_outbox.status != 'sent';
  END IF;

  -- For 07 (credit notes), no status event (no documented lookup endpoint)

  RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_submission_intent(uuid, uuid) FROM public;
REVOKE EXECUTE ON FUNCTION public.record_submission_intent(uuid, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.record_submission_intent(uuid, uuid) TO service_role;

-- =============================================================================
-- 11. FENCED RESULT RPCs
-- =============================================================================

-- record_cpe_accepted
CREATE OR REPLACE FUNCTION public.record_cpe_accepted(
  p_invoice_id uuid,
  p_claim_token uuid,
  p_provider_response jsonb,
  p_signed_xml text DEFAULT NULL,
  p_cdr_zip_base64 text DEFAULT NULL,
  p_document_hash text DEFAULT NULL,
  p_sunat_response_code text DEFAULT NULL,
  p_sunat_cdr_description text DEFAULT NULL,
  p_sunat_cdr_notes text[] DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice RECORD;
BEGIN
  UPDATE public.invoices
  SET status = 'accepted',
      provider_response = p_provider_response,
      signed_xml = COALESCE(p_signed_xml, signed_xml),
      cdr_zip_base64 = COALESCE(p_cdr_zip_base64, cdr_zip_base64),
      document_hash = COALESCE(p_document_hash, document_hash),
      sunat_response_code = p_sunat_response_code,
      sunat_cdr_description = p_sunat_cdr_description,
      sunat_cdr_notes = p_sunat_cdr_notes,
      accepted_at = now(),
      next_operation = 'pdf',
      operation_status = 'ready',
      claim_operation = NULL,
      claim_token = NULL,
      claimed_at = NULL,
      last_error_operation = NULL,
      last_error_code = NULL,
      error_detail = NULL,
      updated_at = now()
  WHERE id = p_invoice_id
    AND claim_token = p_claim_token
  RETURNING * INTO v_invoice;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'lost_claim: acceptance fence failed for invoice %', p_invoice_id;
  END IF;

  -- Enqueue PDF generation
  INSERT INTO public.notification_outbox (
    packet_id, event_type, recipient_key, payload, status, available_at
  ) VALUES (
    v_invoice.packet_id,
    'cpe_pdf',
    'invoice:' || v_invoice.id || ':pdf',
    jsonb_build_object(
      'invoice_id', v_invoice.id,
      'tipo_doc', v_invoice.tipo_doc
    ),
    'pending',
    now()
  )
  ON CONFLICT (packet_id, event_type, recipient_key) DO NOTHING;

  RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_cpe_accepted(uuid, uuid, jsonb, text, text, text, text, text, text[]) FROM public;
REVOKE EXECUTE ON FUNCTION public.record_cpe_accepted(uuid, uuid, jsonb, text, text, text, text, text, text[]) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.record_cpe_accepted(uuid, uuid, jsonb, text, text, text, text, text, text[]) TO service_role;

-- record_cpe_rejected
CREATE OR REPLACE FUNCTION public.record_cpe_rejected(
  p_invoice_id uuid,
  p_claim_token uuid,
  p_provider_response jsonb,
  p_sunat_response_code text DEFAULT NULL,
  p_sunat_cdr_description text DEFAULT NULL,
  p_sunat_cdr_notes text[] DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.invoices
  SET status = 'rejected',
      provider_response = p_provider_response,
      sunat_response_code = p_sunat_response_code,
      sunat_cdr_description = p_sunat_cdr_description,
      sunat_cdr_notes = p_sunat_cdr_notes,
      next_operation = 'none',
      operation_status = 'done',
      claim_operation = NULL,
      claim_token = NULL,
      claimed_at = NULL,
      updated_at = now()
  WHERE id = p_invoice_id
    AND claim_token = p_claim_token;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'lost_claim: rejection fence failed for invoice %', p_invoice_id;
  END IF;

  RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_cpe_rejected(uuid, uuid, jsonb, text, text, text[]) FROM public;
REVOKE EXECUTE ON FUNCTION public.record_cpe_rejected(uuid, uuid, jsonb, text, text, text[]) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.record_cpe_rejected(uuid, uuid, jsonb, text, text, text[]) TO service_role;

-- record_cpe_ambiguous
CREATE OR REPLACE FUNCTION public.record_cpe_ambiguous(
  p_invoice_id uuid,
  p_claim_token uuid,
  p_error_detail text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice RECORD;
BEGIN
  SELECT tipo_doc INTO v_invoice FROM public.invoices WHERE id = p_invoice_id;

  IF v_invoice.tipo_doc IN ('01', '03') THEN
    -- Reconcile via status check
    UPDATE public.invoices
    SET next_operation = 'status_check',
        operation_status = 'ready',
        last_error_operation = 'submit',
        error_detail = p_error_detail,
        claim_operation = NULL,
        claim_token = NULL,
        claimed_at = NULL,
        updated_at = now()
    WHERE id = p_invoice_id
      AND claim_token = p_claim_token;
  ELSE
    -- Credit notes go to manual review (no documented status endpoint)
    UPDATE public.invoices
    SET status = 'manual_review',
        next_operation = 'none',
        operation_status = 'error',
        last_error_operation = 'submit',
        error_detail = p_error_detail,
        claim_operation = NULL,
        claim_token = NULL,
        claimed_at = NULL,
        updated_at = now()
    WHERE id = p_invoice_id
      AND claim_token = p_claim_token;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'lost_claim: ambiguous fence failed for invoice %', p_invoice_id;
  END IF;

  RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_cpe_ambiguous(uuid, uuid, text) FROM public;
REVOKE EXECUTE ON FUNCTION public.record_cpe_ambiguous(uuid, uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.record_cpe_ambiguous(uuid, uuid, text) TO service_role;

-- record_cpe_operation_error
CREATE OR REPLACE FUNCTION public.record_cpe_operation_error(
  p_invoice_id uuid,
  p_claim_token uuid,
  p_operation text,
  p_error_detail text DEFAULT NULL,
  p_error_code text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.invoices
  SET operation_status = 'error',
      last_error_operation = p_operation,
      last_error_code = p_error_code,
      error_detail = p_error_detail,
      claim_operation = NULL,
      claim_token = NULL,
      claimed_at = NULL,
      updated_at = now()
  WHERE id = p_invoice_id
    AND claim_token = p_claim_token;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'lost_claim: operation error fence failed for invoice %', p_invoice_id;
  END IF;

  RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_cpe_operation_error(uuid, uuid, text, text, text) FROM public;
REVOKE EXECUTE ON FUNCTION public.record_cpe_operation_error(uuid, uuid, text, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.record_cpe_operation_error(uuid, uuid, text, text, text) TO service_role;

-- complete_cpe_artifacts
CREATE OR REPLACE FUNCTION public.complete_cpe_artifacts(
  p_invoice_id uuid,
  p_claim_token uuid,
  p_pdf_storage_path text,
  p_xml_storage_path text DEFAULT NULL,
  p_cdr_storage_path text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice RECORD;
BEGIN
  UPDATE public.invoices
  SET status = 'available',
      xml_storage_path = COALESCE(p_xml_storage_path, xml_storage_path),
      cdr_storage_path = COALESCE(p_cdr_storage_path, cdr_storage_path),
      pdf_storage_path = p_pdf_storage_path,
      available_at = now(),
      next_operation = 'none',
      operation_status = 'done',
      claim_operation = NULL,
      claim_token = NULL,
      claimed_at = NULL,
      updated_at = now()
  WHERE id = p_invoice_id
    AND claim_operation = 'pdf'
    AND claim_token = p_claim_token
  RETURNING * INTO v_invoice;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'lost_claim: artifacts fence failed for invoice %', p_invoice_id;
  END IF;

  -- Enqueue comprobante available email
  INSERT INTO public.notification_outbox (
    packet_id, event_type, recipient_key, payload, status, available_at
  ) VALUES (
    v_invoice.packet_id,
    'comprobante_available',
    'invoice:' || v_invoice.id || ':available',
    jsonb_build_object(
      'invoice_id', v_invoice.id,
      'tipo_doc', v_invoice.tipo_doc,
      'serie', v_invoice.serie,
      'correlativo', v_invoice.correlativo,
      'realtor_id', v_invoice.realtor_id,
      'packet_id', v_invoice.packet_id
    ),
    'pending',
    now()
  )
  ON CONFLICT (packet_id, event_type, recipient_key) DO NOTHING;

  RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.complete_cpe_artifacts(uuid, uuid, text, text, text) FROM public;
REVOKE EXECUTE ON FUNCTION public.complete_cpe_artifacts(uuid, uuid, text, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.complete_cpe_artifacts(uuid, uuid, text, text, text) TO service_role;

-- =============================================================================
-- 12. RPC: claim_payment_refund
-- =============================================================================

CREATE OR REPLACE FUNCTION public.claim_payment_refund(
  p_payment_id uuid,
  p_request_id uuid,
  p_requested_by uuid,
  p_amount_centimos integer,
  p_reason_code text,
  p_reason_description text,
  p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment RECORD;
  v_original RECORD;
  v_existing RECORD;
  v_cumulative bigint;
  v_refund_id uuid;
BEGIN
  -- Lock and validate payment
  SELECT * INTO v_payment
  FROM public.payments
  WHERE id = p_payment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment not found: %', p_payment_id;
  END IF;

  IF v_payment.status NOT IN ('completed', 'partially_refunded') THEN
    RAISE EXCEPTION 'Payment not in refundable status: %', v_payment.status;
  END IF;

  -- Require accepted original CPE
  SELECT * INTO v_original
  FROM public.invoices
  WHERE payment_id = p_payment_id
    AND tipo_doc IN ('01', '03')
    AND status IN ('accepted', 'available');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No accepted primary CPE found for payment %', p_payment_id;
  END IF;

  -- Check for existing refund with this request_id (idempotent retry)
  SELECT * INTO v_existing
  FROM public.payment_refunds
  WHERE request_id = p_request_id
  FOR UPDATE;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'refund_id', v_existing.id,
      'status', v_existing.status,
      'reused', true,
      'provider_idempotency_key', v_existing.provider_idempotency_key,
      'amount_centimos', v_existing.amount_centimos
    );
  END IF;

  -- Sum existing succeeded + pending refunds
  SELECT COALESCE(SUM(amount_centimos), 0) INTO v_cumulative
  FROM public.payment_refunds
  WHERE payment_id = p_payment_id
    AND status IN ('succeeded', 'pending');

  IF v_cumulative + p_amount_centimos > v_payment.amount_centimos THEN
    RAISE EXCEPTION 'Refund would exceed payment total: cumulative=%, requested=%, payment=%',
      v_cumulative, p_amount_centimos, v_payment.amount_centimos;
  END IF;

  v_refund_id := gen_random_uuid();

  INSERT INTO public.payment_refunds (
    id, payment_id, packet_id, realtor_id, requested_by,
    request_id, provider, provider_idempotency_key,
    amount_centimos, currency, reason_code, reason_description,
    status
  ) VALUES (
    v_refund_id, p_payment_id, v_payment.packet_id, v_payment.realtor_id,
    p_requested_by, p_request_id, 'mercadopago', p_idempotency_key,
    p_amount_centimos, v_payment.currency, p_reason_code, p_reason_description,
    'pending'
  );

  RETURN jsonb_build_object(
    'refund_id', v_refund_id,
    'status', 'pending',
    'reused', false,
    'provider_idempotency_key', p_idempotency_key,
    'amount_centimos', p_amount_centimos
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_payment_refund(uuid, uuid, uuid, integer, text, text, text) FROM public;
REVOKE EXECUTE ON FUNCTION public.claim_payment_refund(uuid, uuid, uuid, integer, text, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.claim_payment_refund(uuid, uuid, uuid, integer, text, text, text) TO service_role;

-- =============================================================================
-- 13. RPC: complete_payment_refund
-- =============================================================================

CREATE OR REPLACE FUNCTION public.complete_payment_refund(
  p_refund_id uuid,
  p_provider_refund_id text,
  p_provider_amount_centimos integer,
  p_provider_response jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_refund RECORD;
  v_payment RECORD;
  v_cumulative bigint;
  v_new_status text;
BEGIN
  SELECT * INTO v_refund
  FROM public.payment_refunds
  WHERE id = p_refund_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Refund not found: %', p_refund_id;
  END IF;

  IF v_refund.status = 'succeeded' THEN
    RETURN jsonb_build_object('outcome', 'already_succeeded');
  END IF;

  -- Verify amount matches
  IF v_refund.amount_centimos != p_provider_amount_centimos THEN
    RAISE EXCEPTION 'Provider amount mismatch: expected=%, got=%',
      v_refund.amount_centimos, p_provider_amount_centimos;
  END IF;

  -- Mark refund succeeded
  UPDATE public.payment_refunds
  SET status = 'succeeded',
      provider_refund_id = p_provider_refund_id,
      provider_response = p_provider_response,
      refunded_at = now(),
      updated_at = now()
  WHERE id = p_refund_id;

  -- Calculate cumulative refunded amount
  SELECT * INTO v_payment
  FROM public.payments
  WHERE id = v_refund.payment_id
  FOR UPDATE;

  SELECT COALESCE(SUM(amount_centimos), 0) INTO v_cumulative
  FROM public.payment_refunds
  WHERE payment_id = v_refund.payment_id
    AND status = 'succeeded';

  IF v_cumulative >= v_payment.amount_centimos THEN
    v_new_status := 'refunded';
  ELSE
    v_new_status := 'partially_refunded';
  END IF;

  UPDATE public.payments
  SET status = v_new_status,
      updated_at = now()
  WHERE id = v_refund.payment_id;

  -- Audit log
  INSERT INTO public.packet_audit_log (packet_id, actor_id, action, metadata)
  VALUES (
    v_refund.packet_id,
    v_refund.requested_by,
    'payment_refunded',
    jsonb_build_object(
      'refund_id', v_refund.id,
      'amount_centimos', v_refund.amount_centimos,
      'reason_code', v_refund.reason_code,
      'provider_refund_id', p_provider_refund_id
    )
  );

  -- Enqueue credit note preparation
  INSERT INTO public.notification_outbox (
    packet_id, event_type, recipient_key, payload, status, available_at
  ) VALUES (
    v_refund.packet_id,
    'cpe_prepare',
    'refund:' || v_refund.id,
    jsonb_build_object(
      'source_kind', 'refund',
      'refund_id', v_refund.id,
      'payment_id', v_refund.payment_id,
      'user_id', v_refund.realtor_id
    ),
    'pending',
    now()
  )
  ON CONFLICT (packet_id, event_type, recipient_key) DO NOTHING;

  RETURN jsonb_build_object('outcome', 'completed', 'payment_status', v_new_status);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.complete_payment_refund(uuid, text, integer, jsonb) FROM public;
REVOKE EXECUTE ON FUNCTION public.complete_payment_refund(uuid, text, integer, jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.complete_payment_refund(uuid, text, integer, jsonb) TO service_role;

-- =============================================================================
-- 14. REPLACE process_payment_success WITH CPE ENQUEUE
-- =============================================================================

CREATE OR REPLACE FUNCTION public.process_payment_success(
  p_payment_id uuid,
  p_payment_provider text,
  p_provider_payment_id text,
  p_provider_amount_centimos integer,
  p_provider_currency text,
  p_payment_method text,
  p_actor_id uuid
)
RETURNS public.payment_success_result
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment RECORD;
  v_result public.payment_success_result;
BEGIN
  SELECT id, packet_id, realtor_id, amount_centimos, currency, status,
         payment_provider, payment_provider_ref, cpe_snapshot_version
  INTO v_payment
  FROM public.payments
  WHERE id = p_payment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment not found: %', p_payment_id;
  END IF;

  IF v_payment.status = 'completed' THEN
    IF v_payment.payment_provider = p_payment_provider
       AND v_payment.payment_provider_ref = p_provider_payment_id THEN
      v_result.outcome := 'already_completed_same_payment';

      -- Repair missing CPE event for version-1 rows
      IF v_payment.cpe_snapshot_version >= 1 THEN
        INSERT INTO public.notification_outbox (
          packet_id, event_type, recipient_key, payload, status, available_at
        ) VALUES (
          v_payment.packet_id,
          'cpe_prepare',
          'payment:' || v_payment.id,
          jsonb_build_object(
            'source_kind', 'payment',
            'payment_id', v_payment.id,
            'user_id', v_payment.realtor_id
          ),
          'pending',
          now()
        )
        ON CONFLICT (packet_id, event_type, recipient_key) DO NOTHING;
      END IF;
    ELSE
      v_result.outcome := 'already_completed_conflict';
    END IF;
    RETURN v_result;
  END IF;

  IF v_payment.payment_provider != p_payment_provider THEN
    v_result.outcome := 'provider_mismatch';
    RETURN v_result;
  END IF;

  IF v_payment.status NOT IN ('prepared', 'processing', 'requires_action') THEN
    v_result.outcome := 'invalid_status';
    RETURN v_result;
  END IF;

  IF v_payment.amount_centimos != p_provider_amount_centimos THEN
    v_result.outcome := 'amount_mismatch';
    RETURN v_result;
  END IF;

  IF v_payment.currency != p_provider_currency THEN
    v_result.outcome := 'currency_mismatch';
    RETURN v_result;
  END IF;

  UPDATE public.payments SET
    status = 'completed',
    payment_provider_ref = p_provider_payment_id,
    payment_method = p_payment_method,
    paid_at = now(),
    updated_at = now()
  WHERE id = p_payment_id;

  INSERT INTO public.packet_audit_log (packet_id, actor_id, action, metadata)
  VALUES (
    v_payment.packet_id,
    p_actor_id,
    'payment_completed',
    jsonb_build_object(
      'payment_provider', p_payment_provider,
      'provider_payment_id', p_provider_payment_id,
      'amount_centimos', v_payment.amount_centimos::text,
      'currency', v_payment.currency,
      'payment_method', p_payment_method
    )
  );

  -- Enqueue CPE preparation for version-1 rows
  IF v_payment.cpe_snapshot_version >= 1 THEN
    INSERT INTO public.notification_outbox (
      packet_id, event_type, recipient_key, payload, status, available_at
    ) VALUES (
      v_payment.packet_id,
      'cpe_prepare',
      'payment:' || v_payment.id,
      jsonb_build_object(
        'source_kind', 'payment',
        'payment_id', v_payment.id,
        'user_id', v_payment.realtor_id
      ),
      'pending',
      now()
    )
    ON CONFLICT (packet_id, event_type, recipient_key) DO NOTHING;
  END IF;

  v_result.outcome := 'completed';
  RETURN v_result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.process_payment_success(uuid, text, text, integer, text, text, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.process_payment_success(uuid, text, text, integer, text, text, uuid) TO service_role;

-- =============================================================================
-- 15. REPLACE claim_payment_attempt WITH PURCHASER PARAMS
-- =============================================================================

-- Drop old function signature first
DROP FUNCTION IF EXISTS public.claim_payment_attempt(uuid, uuid, text, integer, text, text);

CREATE OR REPLACE FUNCTION public.claim_payment_attempt(
  p_packet_id uuid,
  p_realtor_id uuid,
  p_payment_provider text,
  p_amount_centimos integer,
  p_currency text,
  p_idempotency_key text,
  p_comprobante_type text DEFAULT NULL,
  p_purchaser_tipo_doc text DEFAULT NULL,
  p_purchaser_num_doc text DEFAULT NULL,
  p_purchaser_razon_social text DEFAULT NULL,
  p_purchaser_address jsonb DEFAULT NULL
)
RETURNS public.claim_attempt_result
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result public.claim_attempt_result;
  v_existing RECORD;
  v_packet RECORD;
BEGIN
  IF NULLIF(trim(p_payment_provider), '') IS NULL THEN
    RAISE EXCEPTION 'Payment provider is required';
  END IF;

  SELECT id, status, created_by INTO v_packet
  FROM public.lease_packets
  WHERE id = p_packet_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Packet not found: %', p_packet_id;
  END IF;
  IF v_packet.created_by != p_realtor_id THEN
    RAISE EXCEPTION 'Packet not owned by realtor';
  END IF;
  IF v_packet.status != 'draft' THEN
    RAISE EXCEPTION 'Packet is not in draft status: %', v_packet.status;
  END IF;

  SELECT id, status, amount_centimos, currency, realtor_id, payment_provider
  INTO v_existing
  FROM public.payments
  WHERE packet_id = p_packet_id
    AND status IN ('prepared', 'processing', 'requires_action', 'completed')
  FOR UPDATE;

  IF FOUND THEN
    IF v_existing.realtor_id != p_realtor_id THEN
      RAISE EXCEPTION 'Existing payment belongs to different realtor';
    END IF;
    IF v_existing.payment_provider != p_payment_provider THEN
      RAISE EXCEPTION 'Existing payment belongs to different provider';
    END IF;
    v_result.payment_id := v_existing.id;
    v_result.existing_status := v_existing.status;
    v_result.amount_centimos := v_existing.amount_centimos;
    v_result.currency := v_existing.currency;
    v_result.claimed := false;
    RETURN v_result;
  END IF;

  INSERT INTO public.payments (
    packet_id, realtor_id, amount, amount_centimos, currency, status,
    payment_provider, idempotency_key,
    comprobante_type, purchaser_tipo_doc, purchaser_num_doc,
    purchaser_razon_social, purchaser_address, cpe_snapshot_version,
    updated_at
  ) VALUES (
    p_packet_id, p_realtor_id, p_amount_centimos / 100.0, p_amount_centimos,
    p_currency, 'prepared', p_payment_provider, p_idempotency_key,
    p_comprobante_type, p_purchaser_tipo_doc, p_purchaser_num_doc,
    p_purchaser_razon_social, p_purchaser_address, 1,
    now()
  )
  ON CONFLICT (idempotency_key)
  DO UPDATE SET
    status = 'prepared',
    amount = EXCLUDED.amount,
    amount_centimos = EXCLUDED.amount_centimos,
    currency = EXCLUDED.currency,
    payment_provider = EXCLUDED.payment_provider,
    comprobante_type = EXCLUDED.comprobante_type,
    purchaser_tipo_doc = EXCLUDED.purchaser_tipo_doc,
    purchaser_num_doc = EXCLUDED.purchaser_num_doc,
    purchaser_razon_social = EXCLUDED.purchaser_razon_social,
    purchaser_address = EXCLUDED.purchaser_address,
    cpe_snapshot_version = 1,
    error_code = NULL,
    error_message = NULL,
    payment_provider_ref = NULL,
    updated_at = now()
  WHERE public.payments.status = 'failed'
  RETURNING id, status, amount_centimos, currency
  INTO v_result.payment_id, v_result.existing_status, v_result.amount_centimos, v_result.currency;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Could not claim payment attempt for packet %', p_packet_id;
  END IF;

  v_result.claimed := true;
  RETURN v_result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_payment_attempt(uuid, uuid, text, integer, text, text, text, text, text, text, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.claim_payment_attempt(uuid, uuid, text, integer, text, text, text, text, text, text, jsonb) TO service_role;
