-- =============================================================================
-- Forward-only migration v3: CPE hardening round 3
-- Adds reason_code/reason_description validation to requestId reuse.
-- =============================================================================

-- FIX R3.3: Validate reason_code and reason_description on requestId reuse.
-- When a request_id is reused, all legally significant fields must match.

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
    -- Validate ALL legally significant fields, not just payment and amount
    IF v_existing.payment_id != p_payment_id THEN
      RAISE EXCEPTION 'request_id % already used for a different payment', p_request_id;
    END IF;
    IF v_existing.amount_centimos != p_amount_centimos THEN
      RAISE EXCEPTION 'request_id % already used with a different amount', p_request_id;
    END IF;
    IF v_existing.reason_code != p_reason_code THEN
      RAISE EXCEPTION 'request_id % already used with a different reason_code', p_request_id;
    END IF;
    IF v_existing.reason_description != p_reason_description THEN
      RAISE EXCEPTION 'request_id % already used with a different reason_description', p_request_id;
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
  -- 'failed' is excluded: definitive 4xx means MP rejected, amount was never deducted
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
