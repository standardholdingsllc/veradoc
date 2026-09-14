-- Close CPE RPC privilege gaps and preserve the full purchaser snapshot.
-- This is intentionally forward-only: previously deployed migrations remain unchanged.

BEGIN;

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
  v_packet RECORD;
  v_existing RECORD;
  v_result public.claim_attempt_result;
  v_cpe_snapshot_version integer;
  v_purchaser_changed boolean := false;
BEGIN
  SELECT * INTO v_packet
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

  SELECT id, status, amount_centimos, currency, realtor_id, payment_provider,
         comprobante_type, purchaser_tipo_doc, purchaser_num_doc,
         purchaser_razon_social, purchaser_address
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

    v_purchaser_changed := (
      COALESCE(v_existing.comprobante_type, '') != COALESCE(p_comprobante_type, '')
      OR COALESCE(v_existing.purchaser_tipo_doc, '') != COALESCE(p_purchaser_tipo_doc, '')
      OR COALESCE(v_existing.purchaser_num_doc, '') != COALESCE(p_purchaser_num_doc, '')
      OR COALESCE(v_existing.purchaser_razon_social, '') != COALESCE(p_purchaser_razon_social, '')
      OR v_existing.purchaser_address IS DISTINCT FROM p_purchaser_address
    );

    IF v_purchaser_changed THEN
      IF v_existing.status = 'prepared' THEN
        UPDATE public.payments
        SET comprobante_type = p_comprobante_type,
            purchaser_tipo_doc = p_purchaser_tipo_doc,
            purchaser_num_doc = p_purchaser_num_doc,
            purchaser_razon_social = p_purchaser_razon_social,
            purchaser_address = p_purchaser_address,
            cpe_snapshot_version = CASE
              WHEN p_comprobante_type IS NOT NULL
                   AND p_purchaser_num_doc IS NOT NULL
                   AND p_purchaser_razon_social IS NOT NULL
              THEN 1 ELSE 0 END,
            updated_at = now()
        WHERE id = v_existing.id;
      ELSE
        RAISE EXCEPTION 'Cannot change purchaser data after payment status %', v_existing.status;
      END IF;
    END IF;

    v_result.payment_id := v_existing.id;
    v_result.existing_status := v_existing.status;
    v_result.amount_centimos := v_existing.amount_centimos;
    v_result.currency := v_existing.currency;
    v_result.claimed := false;
    RETURN v_result;
  END IF;

  IF p_comprobante_type IS NOT NULL
     AND p_purchaser_num_doc IS NOT NULL
     AND p_purchaser_razon_social IS NOT NULL
  THEN
    v_cpe_snapshot_version := 1;
  ELSE
    v_cpe_snapshot_version := 0;
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
    p_purchaser_razon_social, p_purchaser_address, v_cpe_snapshot_version,
    now()
  )
  RETURNING id, status, amount_centimos, currency
  INTO v_result.payment_id, v_result.existing_status,
       v_result.amount_centimos, v_result.currency;

  v_result.claimed := true;
  RETURN v_result;
END;
$$;

-- Repair any credit notes created before purchaser_address was copied.
UPDATE public.invoices AS credit_note
SET purchaser_address = original.purchaser_address,
    updated_at = now()
FROM public.invoices AS original
WHERE credit_note.tipo_doc = '07'
  AND credit_note.related_invoice_id = original.id
  AND credit_note.purchaser_address IS DISTINCT FROM original.purchaser_address;

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
  v_existing RECORD;
  v_serie text;
  v_series_type text;
  v_correlativo text;
  v_new_id uuid;
  v_issue_date date;
  v_issued_at timestamptz;
BEGIN
  SELECT * INTO v_refund
  FROM public.payment_refunds
  WHERE id = p_refund_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Refund not found';
  END IF;

  SELECT * INTO v_original
  FROM public.invoices
  WHERE payment_id = v_refund.payment_id
    AND tipo_doc IN ('01', '03')
    AND status IN ('accepted', 'available')
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No accepted primary CPE';
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
        WHERE id = v_existing.id;

        RETURN jsonb_build_object(
          'invoice_id', v_existing.id,
          'owned', true,
          'already_advanced', false,
          'tipo_doc', '07',
          'serie', v_existing.serie,
          'correlativo', v_existing.correlativo,
          'original_invoice_id', v_original.id,
          'original_tipo_doc', v_original.tipo_doc,
          'original_serie', v_original.serie,
          'original_correlativo', v_original.correlativo,
          'payment_id', v_refund.payment_id,
          'packet_id', v_refund.packet_id,
          'realtor_id', v_refund.realtor_id,
          'amount_centimos', v_refund.amount_centimos,
          'currency', v_refund.currency,
          'purchaser_tipo_doc', v_original.purchaser_tipo_doc,
          'purchaser_num_doc', v_original.purchaser_num_doc,
          'purchaser_razon_social', v_original.purchaser_razon_social,
          'purchaser_address', COALESCE(v_original.purchaser_address, '{}'::jsonb)
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

  IF v_original.tipo_doc = '01' THEN
    v_serie := p_cn_factura_serie;
    v_series_type := 'credit_note_factura';
  ELSE
    v_serie := p_cn_boleta_serie;
    v_series_type := 'credit_note_boleta';
  END IF;

  IF v_serie IS NULL OR v_serie = '' THEN
    RAISE EXCEPTION 'CN series not provided';
  END IF;

  v_correlativo := public.allocate_cpe_correlativo(v_serie, v_series_type);
  v_issued_at := now();
  v_issue_date := (v_issued_at AT TIME ZONE 'America/Lima')::date;
  v_new_id := gen_random_uuid();

  INSERT INTO public.invoices (
    id, packet_id, payment_id, refund_id, related_invoice_id, realtor_id,
    tipo_doc, serie, correlativo, status, next_operation, operation_status,
    claim_operation, claim_token, claimed_at,
    purchaser_tipo_doc, purchaser_num_doc, purchaser_razon_social,
    purchaser_address,
    subtotal_centimos, igv_centimos, total_centimos, currency,
    issue_date, issued_at
  ) VALUES (
    v_new_id, v_refund.packet_id, v_refund.payment_id, p_refund_id,
    v_original.id, v_refund.realtor_id,
    '07', v_serie, v_correlativo, 'pending', 'prepare', 'processing',
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
    'original_invoice_id', v_original.id,
    'original_tipo_doc', v_original.tipo_doc,
    'original_serie', v_original.serie,
    'original_correlativo', v_original.correlativo,
    'payment_id', v_refund.payment_id,
    'packet_id', v_refund.packet_id,
    'realtor_id', v_refund.realtor_id,
    'amount_centimos', v_refund.amount_centimos,
    'currency', v_refund.currency,
    'purchaser_tipo_doc', v_original.purchaser_tipo_doc,
    'purchaser_num_doc', v_original.purchaser_num_doc,
    'purchaser_razon_social', v_original.purchaser_razon_social,
    'purchaser_address', COALESCE(v_original.purchaser_address, '{}'::jsonb)
  );
END;
$$;

-- All callers in the application use the service-role client. Keep these
-- state-changing SECURITY DEFINER functions off the public API roles.
DROP FUNCTION IF EXISTS public.allocate_cpe_correlativo(text);

DO $$
DECLARE
  v_function regprocedure;
BEGIN
  FOR v_function IN
    SELECT p.oid::regprocedure
    FROM pg_proc AS p
    JOIN pg_namespace AS n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = ANY (ARRAY[
        'allocate_cpe_correlativo',
        'claim_cpe_operation',
        'claim_notification_outbox',
        'claim_or_create_credit_note',
        'claim_or_create_primary_cpe',
        'claim_payment_attempt',
        'claim_payment_refund',
        'complete_cpe_artifacts',
        'complete_cpe_preparation',
        'complete_payment_refund',
        'escalate_cpe_manual_review',
        'process_payment_success',
        'record_cpe_accepted',
        'record_cpe_ambiguous',
        'record_cpe_operation_error',
        'record_cpe_rejected',
        'record_submission_intent'
      ]::text[])
  LOOP
    EXECUTE format(
      'REVOKE ALL PRIVILEGES ON FUNCTION %s FROM PUBLIC, anon, authenticated',
      v_function
    );
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION %s TO service_role',
      v_function
    );
  END LOOP;
END;
$$;

COMMIT;
