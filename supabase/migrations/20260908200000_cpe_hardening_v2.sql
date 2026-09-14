-- =============================================================================
-- Forward-only migration v2: CPE hardening round 2
-- Fixes regression in process_payment_success, adds escalation RPC,
-- revokes overly broad SELECT grant, and corrects refund cap semantics.
-- =============================================================================

-- =============================================================================
-- FIX R2.1: Restore process_payment_success original semantics + snapshot guard
-- Restores: already_completed_same_payment/conflict, provider_mismatch,
--           CPE outbox repair on idempotent replay.
-- Adds: tighter snapshot guard requiring comprobante_type + purchaser data.
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
    RAISE EXCEPTION 'Payment not found: %', p_payment_id;
  END IF;

  -- Idempotent replay handling (original semantics)
  IF v_payment.status = 'completed' THEN
    IF v_payment.payment_provider = p_payment_provider
       AND v_payment.payment_provider_ref = p_provider_payment_id THEN
      v_result.outcome := 'already_completed_same_payment';

      -- Repair missing CPE event for complete snapshots
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
    ELSE
      v_result.outcome := 'already_completed_conflict';
    END IF;
    RETURN v_result;
  END IF;

  -- Provider mismatch check (original semantics)
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

  -- Enqueue CPE only for complete purchaser snapshots
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
-- FIX R2.2 + R2.8: escalate_cpe_manual_review
-- Unclaimed escalation: moves an invoice to manual_review regardless of claim
-- state. Used for credit-note crash recovery and definitive validation errors.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.escalate_cpe_manual_review(
  p_invoice_id uuid,
  p_error_detail text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.invoices
  SET status = 'manual_review',
      next_operation = 'none',
      operation_status = 'error',
      last_error_operation = COALESCE(claim_operation, next_operation, 'unknown'),
      error_detail = p_error_detail,
      claim_operation = NULL,
      claim_token = NULL,
      claimed_at = NULL,
      updated_at = now()
  WHERE id = p_invoice_id
    AND status NOT IN ('available', 'rejected');

  RETURN FOUND;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.escalate_cpe_manual_review(uuid, text) FROM public;
REVOKE EXECUTE ON FUNCTION public.escalate_cpe_manual_review(uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.escalate_cpe_manual_review(uuid, text) TO service_role;


-- =============================================================================
-- FIX R2.5: Revoke broad SELECT grant on invoices
-- The admin client is used for all invoice queries; authenticated users
-- do not need direct table access.
-- =============================================================================

REVOKE SELECT ON public.invoices FROM authenticated;


-- =============================================================================
-- FIX R2.6: Revert claim_payment_refund cap to exclude 'failed'
-- Now that 4xx → failed (definitively rejected, never processed) and
-- 5xx → stays pending (ambiguous, included in cap), 'failed' should be
-- excluded from the cap since those refunds never happened.
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

  SELECT * INTO v_existing
  FROM public.payment_refunds
  WHERE request_id = p_request_id
  FOR UPDATE;

  IF FOUND THEN
    IF v_existing.payment_id != p_payment_id THEN
      RAISE EXCEPTION 'request_id % already used for a different payment', p_request_id;
    END IF;
    IF v_existing.amount_centimos != p_amount_centimos THEN
      RAISE EXCEPTION 'request_id % already used with a different amount', p_request_id;
    END IF;

    RETURN jsonb_build_object(
      'refund_id', v_existing.id,
      'status', v_existing.status,
      'reused', true,
      'provider_idempotency_key', v_existing.provider_idempotency_key,
      'amount_centimos', v_existing.amount_centimos
    );
  END IF;

  -- Cap: succeeded + pending (ambiguous 5xx stays pending and reserves its amount)
  -- 'failed' is excluded: 4xx means MP definitively rejected, amount was never deducted
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
