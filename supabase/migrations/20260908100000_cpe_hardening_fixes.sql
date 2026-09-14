-- =============================================================================
-- Forward-only migration: CPE hardening fixes
-- Addresses all database-level issues from the code review.
-- =============================================================================

-- =============================================================================
-- FIX #2: Pass series as RPC parameters (remove dependency on app.* settings)
-- =============================================================================

-- Drop old function signatures before creating new ones
DROP FUNCTION IF EXISTS public.claim_or_create_primary_cpe(uuid, uuid, integer);
DROP FUNCTION IF EXISTS public.claim_or_create_credit_note(uuid, uuid, integer);

-- Recreate with series parameters
CREATE OR REPLACE FUNCTION public.claim_or_create_primary_cpe(
  p_payment_id uuid,
  p_claim_token uuid,
  p_factura_serie text DEFAULT NULL,
  p_boleta_serie text DEFAULT NULL,
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

  IF v_payment.status NOT IN ('completed', 'partially_refunded', 'refunded') THEN
    RAISE EXCEPTION 'Payment not in captured status: %', v_payment.status;
  END IF;

  -- FIX #3: Require BOTH cpe_snapshot_version >= 1 AND comprobante_type is not null
  IF v_payment.cpe_snapshot_version IS NULL OR v_payment.cpe_snapshot_version < 1 THEN
    RAISE EXCEPTION 'Payment missing CPE snapshot (legacy row)';
  END IF;

  IF v_payment.comprobante_type IS NULL OR v_payment.purchaser_num_doc IS NULL
     OR v_payment.purchaser_razon_social IS NULL THEN
    RAISE EXCEPTION 'Payment missing purchaser data (comprobante_type, num_doc, or razon_social is null)';
  END IF;

  -- Check for existing primary CPE
  SELECT * INTO v_existing
  FROM public.invoices
  WHERE payment_id = p_payment_id
    AND tipo_doc IN ('01', '03')
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

  -- No existing row — use series from RPC parameters
  IF v_payment.comprobante_type = '01' THEN
    v_serie := p_factura_serie;
  ELSE
    v_serie := p_boleta_serie;
  END IF;

  IF v_serie IS NULL OR v_serie = '' THEN
    RAISE EXCEPTION 'Series not provided for comprobante_type %', v_payment.comprobante_type;
  END IF;

  v_correlativo := public.allocate_cpe_correlativo(v_serie);

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

REVOKE EXECUTE ON FUNCTION public.claim_or_create_primary_cpe(uuid, uuid, text, text, integer) FROM public;
REVOKE EXECUTE ON FUNCTION public.claim_or_create_primary_cpe(uuid, uuid, text, text, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.claim_or_create_primary_cpe(uuid, uuid, text, text, integer) TO service_role;


-- claim_or_create_credit_note with series params
CREATE OR REPLACE FUNCTION public.claim_or_create_credit_note(
  p_refund_id uuid,
  p_claim_token uuid,
  p_cn_factura_serie text DEFAULT NULL,
  p_cn_boleta_serie text DEFAULT NULL,
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

  SELECT * INTO v_payment
  FROM public.payments
  WHERE id = v_refund.payment_id
  FOR UPDATE;

  SELECT COALESCE(SUM(r.amount_centimos), 0) INTO v_cumulative_centimos
  FROM public.payment_refunds r
  WHERE r.payment_id = v_refund.payment_id
    AND r.status = 'succeeded';

  IF v_cumulative_centimos > v_original.total_centimos THEN
    RAISE EXCEPTION 'Cumulative refunds (%) exceed original CPE total (%)',
      v_cumulative_centimos, v_original.total_centimos;
  END IF;

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

  -- Allocate series from RPC parameters
  IF v_original.tipo_doc = '01' THEN
    v_serie := p_cn_factura_serie;
  ELSE
    v_serie := p_cn_boleta_serie;
  END IF;

  IF v_serie IS NULL OR v_serie = '' THEN
    RAISE EXCEPTION 'Credit note series not provided for original tipo_doc %', v_original.tipo_doc;
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

REVOKE EXECUTE ON FUNCTION public.claim_or_create_credit_note(uuid, uuid, text, text, integer) FROM public;
REVOKE EXECUTE ON FUNCTION public.claim_or_create_credit_note(uuid, uuid, text, text, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.claim_or_create_credit_note(uuid, uuid, text, text, integer) TO service_role;


-- =============================================================================
-- FIX #3: Guard process_payment_success against incomplete snapshots
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
         payment_provider, payment_provider_ref, cpe_snapshot_version,
         comprobante_type, purchaser_num_doc, purchaser_razon_social
  INTO v_payment
  FROM public.payments
  WHERE id = p_payment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    v_result.outcome := 'not_found';
    RETURN v_result;
  END IF;

  IF v_payment.status = 'completed' THEN
    v_result.outcome := 'already_completed';
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

  -- FIX #3: Require BOTH cpe_snapshot_version >= 1 AND complete purchaser data
  IF v_payment.cpe_snapshot_version >= 1
     AND v_payment.comprobante_type IS NOT NULL
     AND v_payment.purchaser_num_doc IS NOT NULL
     AND v_payment.purchaser_razon_social IS NOT NULL
  THEN
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


-- =============================================================================
-- FIX #3: Tighten immutability trigger — only allow changes from failed→prepared
-- =============================================================================

CREATE OR REPLACE FUNCTION public.payments_purchaser_immutable()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  -- Allow changes when transitioning from 'failed' to 'prepared' (retry reclaim)
  -- Block changes in all other non-prepared states
  IF OLD.status NOT IN ('prepared') AND NOT (OLD.status = 'failed' AND NEW.status = 'prepared') THEN
    IF NEW.comprobante_type IS DISTINCT FROM OLD.comprobante_type
       OR NEW.purchaser_tipo_doc IS DISTINCT FROM OLD.purchaser_tipo_doc
       OR NEW.purchaser_num_doc IS DISTINCT FROM OLD.purchaser_num_doc
       OR NEW.purchaser_razon_social IS DISTINCT FROM OLD.purchaser_razon_social
       OR NEW.purchaser_address IS DISTINCT FROM OLD.purchaser_address
    THEN
      RAISE EXCEPTION 'Purchaser snapshot is immutable after payment leaves prepared/failed→prepared state';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


-- =============================================================================
-- FIX #4: record_submission_intent — keep next_operation='submit' for credit notes
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
      -- FIX #4: For 01/03, move to status_check. For 07, keep at submit
      -- so a crash-retry re-enters the submit handler (no status endpoint for notes).
      next_operation = CASE
        WHEN tipo_doc IN ('01', '03') THEN 'status_check'
        ELSE 'submit'
      END,
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

  RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_submission_intent(uuid, uuid) FROM public;
REVOKE EXECUTE ON FUNCTION public.record_submission_intent(uuid, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.record_submission_intent(uuid, uuid) TO service_role;


-- =============================================================================
-- FIX #5: Add claim_operation to WHERE clause in result RPCs
-- =============================================================================

-- record_cpe_accepted: add claim_operation IN ('submit', 'status_check')
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
    AND claim_operation IN ('submit', 'status_check')
  RETURNING * INTO v_invoice;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'lost_claim: acceptance fence failed for invoice %', p_invoice_id;
  END IF;

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


-- record_cpe_rejected: add claim_operation IN ('submit', 'status_check')
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
    AND claim_token = p_claim_token
    AND claim_operation IN ('submit', 'status_check');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'lost_claim: rejection fence failed for invoice %', p_invoice_id;
  END IF;

  RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_cpe_rejected(uuid, uuid, jsonb, text, text, text[]) FROM public;
REVOKE EXECUTE ON FUNCTION public.record_cpe_rejected(uuid, uuid, jsonb, text, text, text[]) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.record_cpe_rejected(uuid, uuid, jsonb, text, text, text[]) TO service_role;


-- record_cpe_ambiguous: add claim_operation check
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
      AND claim_token = p_claim_token
      AND claim_operation = 'submit';
  ELSE
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
      AND claim_token = p_claim_token
      AND claim_operation = 'submit';
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


-- record_cpe_operation_error: add claim_operation to fence
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
    AND claim_token = p_claim_token
    AND claim_operation = p_operation;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'lost_claim: operation error fence failed for invoice %', p_invoice_id;
  END IF;

  RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_cpe_operation_error(uuid, uuid, text, text, text) FROM public;
REVOKE EXECUTE ON FUNCTION public.record_cpe_operation_error(uuid, uuid, text, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.record_cpe_operation_error(uuid, uuid, text, text, text) TO service_role;


-- =============================================================================
-- FIX #7: Grant SELECT on invoices to authenticated users (required for RLS)
-- =============================================================================

GRANT SELECT ON public.invoices TO authenticated;


-- =============================================================================
-- FIX #8: claim_payment_refund — include 'failed' in cumulative cap; validate
--         request_id reuse params
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
    -- FIX #8: Validate that reused row matches the requested params
    IF v_existing.payment_id != p_payment_id THEN
      RAISE EXCEPTION 'request_id % already used for a different payment', p_request_id;
    END IF;
    IF v_existing.amount_centimos != p_amount_centimos THEN
      RAISE EXCEPTION 'request_id % already used with a different amount (existing=%, requested=%)',
        p_request_id, v_existing.amount_centimos, p_amount_centimos;
    END IF;

    RETURN jsonb_build_object(
      'refund_id', v_existing.id,
      'status', v_existing.status,
      'reused', true,
      'provider_idempotency_key', v_existing.provider_idempotency_key,
      'amount_centimos', v_existing.amount_centimos
    );
  END IF;

  -- FIX #8: Include 'failed' in cumulative cap to prevent over-refunding
  -- when MP processed the refund but the local update failed
  SELECT COALESCE(SUM(amount_centimos), 0) INTO v_cumulative
  FROM public.payment_refunds
  WHERE payment_id = p_payment_id
    AND status IN ('succeeded', 'pending', 'failed');

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
-- FIX #3: claim_payment_attempt — set cpe_snapshot_version=0 when no purchaser
-- =============================================================================

-- Drop old overloaded signatures if any exist
DROP FUNCTION IF EXISTS public.claim_payment_attempt(uuid, uuid, text, integer, text, text, text, text, text, text, jsonb);

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
  v_snapshot_version integer;
BEGIN
  IF NULLIF(trim(p_payment_provider), '') IS NULL THEN
    RAISE EXCEPTION 'Payment provider is required';
  END IF;

  -- FIX #3: Only set snapshot version 1 if purchaser data is complete
  IF p_comprobante_type IS NOT NULL AND p_purchaser_num_doc IS NOT NULL
     AND p_purchaser_razon_social IS NOT NULL THEN
    v_snapshot_version := 1;
  ELSE
    v_snapshot_version := 0;
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
    p_purchaser_razon_social, p_purchaser_address, v_snapshot_version,
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
    cpe_snapshot_version = v_snapshot_version,
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
