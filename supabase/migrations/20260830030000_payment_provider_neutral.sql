-- Remove provider-specific payment state and make the retained payment RPCs
-- explicit about which provider owns each attempt.

ALTER TABLE public.payments
  DROP CONSTRAINT IF EXISTS payments_status_check;

UPDATE public.payments SET status = 'processing' WHERE status IN ('charging', 'verifying');
UPDATE public.payments SET status = 'requires_action' WHERE status = 'requires_3ds';

ALTER TABLE public.payments
  ADD CONSTRAINT payments_status_check
  CHECK (status IN (
    'pending', 'prepared', 'processing', 'requires_action', 'completed',
    'failed', 'cancelled', 'partially_refunded', 'refunded', 'charged_back'
  ));

DROP INDEX IF EXISTS public.idx_payments_active_per_packet;
CREATE UNIQUE INDEX idx_payments_active_per_packet
  ON public.payments (packet_id)
  WHERE status IN ('prepared', 'processing', 'requires_action', 'completed');

DROP FUNCTION IF EXISTS public.claim_charging(uuid, uuid, text, text, text);
DROP TYPE IF EXISTS public.claim_charging_result;

DROP FUNCTION IF EXISTS public.claim_payment_attempt(uuid, uuid, integer, text, text, text);
ALTER TYPE public.claim_attempt_result DROP ATTRIBUTE IF EXISTS challenge_nonce;

ALTER TABLE public.payments
  DROP COLUMN IF EXISTS device_finger_print_id,
  DROP COLUMN IF EXISTS source_token_hash,
  DROP COLUMN IF EXISTS challenge_nonce;

ALTER TABLE public.payment_webhook_events
  ALTER COLUMN provider DROP DEFAULT;

UPDATE public.payments
SET payment_provider = 'legacy'
WHERE payment_provider IS NULL;

ALTER TABLE public.payments
  ALTER COLUMN payment_provider SET NOT NULL;

CREATE OR REPLACE FUNCTION public.claim_payment_attempt(
  p_packet_id uuid,
  p_realtor_id uuid,
  p_payment_provider text,
  p_amount_centimos integer,
  p_currency text,
  p_idempotency_key text
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
    payment_provider, idempotency_key, updated_at
  ) VALUES (
    p_packet_id, p_realtor_id, p_amount_centimos / 100.0, p_amount_centimos,
    p_currency, 'prepared', p_payment_provider, p_idempotency_key, now()
  )
  ON CONFLICT (idempotency_key)
  DO UPDATE SET
    status = 'prepared',
    amount = EXCLUDED.amount,
    amount_centimos = EXCLUDED.amount_centimos,
    currency = EXCLUDED.currency,
    payment_provider = EXCLUDED.payment_provider,
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

REVOKE EXECUTE ON FUNCTION public.claim_payment_attempt(uuid, uuid, text, integer, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.claim_payment_attempt(uuid, uuid, text, integer, text, text) TO service_role;

DROP FUNCTION IF EXISTS public.process_payment_success(uuid, text, integer, text, text, uuid);

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
         payment_provider, payment_provider_ref
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

  v_result.outcome := 'completed';
  RETURN v_result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.process_payment_success(uuid, text, text, integer, text, text, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.process_payment_success(uuid, text, text, integer, text, text, uuid) TO service_role;
