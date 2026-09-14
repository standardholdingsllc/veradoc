-- Migration: 00013_payment_infrastructure.sql
-- Expand the payments table with provider-neutral payment state, webhook events,
-- pricing config, and atomic payment processing RPCs.

-- =============================================================================
-- 1. ADD COLUMNS AND EXPAND STATUS CONSTRAINT
-- =============================================================================

ALTER TABLE public.payments
  DROP CONSTRAINT IF EXISTS payments_status_check;

ALTER TABLE public.payments
  ADD CONSTRAINT payments_status_check
  CHECK (status IN ('pending', 'prepared', 'processing', 'requires_action', 'completed', 'failed', 'cancelled', 'partially_refunded', 'refunded', 'charged_back'));

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS payment_provider text,
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS amount_centimos integer,
  ADD COLUMN IF NOT EXISTS error_code text,
  ADD COLUMN IF NOT EXISTS error_message text,
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS payment_confirmation_claimed_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_confirmation_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_confirmation_error text,
  ADD COLUMN IF NOT EXISTS payment_confirmation_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- =============================================================================
-- 2. LEGACY DATA REMEDIATION
-- =============================================================================

UPDATE public.payments
SET payment_provider = 'demo'
WHERE payment_provider IS NULL
  AND (payment_provider_ref = 'stub-payment' OR payment_provider_ref IS NULL);

UPDATE public.payments
SET payment_provider = 'legacy'
WHERE payment_provider IS NULL;

ALTER TABLE public.payments
  ALTER COLUMN payment_provider SET NOT NULL;

UPDATE public.payments
SET amount_centimos = round(amount * 100)::integer
WHERE amount_centimos IS NULL AND amount IS NOT NULL;

WITH ranked AS (
  SELECT id, packet_id, status,
    ROW_NUMBER() OVER (PARTITION BY packet_id ORDER BY
      CASE WHEN status = 'completed' THEN 0 ELSE 1 END,
      COALESCE(paid_at, created_at) DESC
    ) AS rn,
    FIRST_VALUE(id) OVER (PARTITION BY packet_id ORDER BY
      CASE WHEN status = 'completed' THEN 0 ELSE 1 END,
      COALESCE(paid_at, created_at) DESC
    ) AS retained_id
  FROM public.payments
  WHERE status IN ('pending', 'completed')
)
UPDATE public.payments p
SET status = 'failed',
    error_message = 'Deduplicated by migration 00013; retained payment: ' || r.retained_id::text
FROM ranked r
WHERE p.id = r.id AND r.rn > 1;

-- =============================================================================
-- 3. ADD CONSTRAINTS AND INDEXES
-- =============================================================================

ALTER TABLE public.payments
  ADD CONSTRAINT payments_amount_centimos_positive
  CHECK (amount_centimos > 0 OR amount_centimos IS NULL);

ALTER TABLE public.payments
  ADD CONSTRAINT payments_idempotency_key_unique UNIQUE (idempotency_key);

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_active_per_packet
  ON public.payments (packet_id)
  WHERE status IN ('prepared', 'processing', 'requires_action', 'completed');

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_provider_ref
  ON public.payments (payment_provider, payment_provider_ref)
  WHERE payment_provider_ref IS NOT NULL AND payment_provider != 'demo';

-- =============================================================================
-- 4. PAYMENT WEBHOOK EVENTS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.payment_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  event_type text NOT NULL,
  object_id text NOT NULL,
  payload_hash text NOT NULL,
  raw_payload jsonb,
  processing_result text DEFAULT 'received'
    CHECK (processing_result IN ('received', 'processing', 'processed', 'ignored', 'retryable_failure', 'permanent_failure')),
  attempt_count integer NOT NULL DEFAULT 0,
  last_attempt_at timestamptz,
  received_at timestamptz DEFAULT now(),
  processed_at timestamptz,
  error_message text,
  UNIQUE(provider, payload_hash)
);

ALTER TABLE public.payment_webhook_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.payment_webhook_events FROM anon;
REVOKE ALL ON public.payment_webhook_events FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON public.payment_webhook_events TO service_role;

CREATE INDEX IF NOT EXISTS idx_webhook_events_object
  ON public.payment_webhook_events (provider, object_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_retryable
  ON public.payment_webhook_events (processing_result)
  WHERE processing_result IN ('retryable_failure', 'received');

-- =============================================================================
-- 5. PRICING CONFIG TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.pricing_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_code text NOT NULL UNIQUE,
  amount_centimos integer NOT NULL CHECK (amount_centimos > 0),
  currency text NOT NULL DEFAULT 'PEN' CHECK (currency = 'PEN'),
  description text NOT NULL DEFAULT 'Paquete de arrendamiento estándar',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

INSERT INTO public.pricing_config (product_code, amount_centimos, currency, description)
VALUES ('lease_packet_standard', 8900, 'PEN', 'Paquete de arrendamiento estándar')
ON CONFLICT (product_code) DO NOTHING;

ALTER TABLE public.pricing_config ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.pricing_config FROM anon;
GRANT SELECT ON public.pricing_config TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.pricing_config TO service_role;

CREATE POLICY "Authenticated reads active pricing"
  ON public.pricing_config FOR SELECT
  TO authenticated
  USING (active = true);

-- =============================================================================
-- 6. RPC: claim_payment_attempt
-- =============================================================================

DO $$ BEGIN
  CREATE TYPE public.claim_attempt_result AS (
    payment_id uuid,
    existing_status text,
    amount_centimos integer,
    currency text,
    claimed boolean
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

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

-- =============================================================================
-- 7. RPC: process_payment_success
-- =============================================================================

DO $$ BEGIN
  CREATE TYPE public.payment_success_result AS (
    outcome text
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

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

-- =============================================================================
-- 8. RPC: claim_webhook_processing
-- =============================================================================

DO $$ BEGIN
  CREATE TYPE public.webhook_claim_result AS (
    event_id uuid,
    owned boolean,
    already_processed boolean
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.claim_webhook_processing(
  p_provider text,
  p_event_type text,
  p_object_id text,
  p_payload_hash text,
  p_raw_payload jsonb,
  p_stale_threshold_seconds integer DEFAULT 300
)
RETURNS public.webhook_claim_result
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result public.webhook_claim_result;
  v_existing RECORD;
BEGIN
  v_result.owned := false;
  v_result.already_processed := false;

  BEGIN
    INSERT INTO public.payment_webhook_events (
      provider, event_type, object_id, payload_hash, raw_payload,
      processing_result, attempt_count, last_attempt_at
    ) VALUES (
      p_provider, p_event_type, p_object_id, p_payload_hash, p_raw_payload,
      'processing', 1, now()
    )
    RETURNING id INTO v_result.event_id;

    v_result.owned := true;
    RETURN v_result;
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;

  UPDATE public.payment_webhook_events
  SET processing_result = 'processing',
      attempt_count = attempt_count + 1,
      last_attempt_at = now()
  WHERE provider = p_provider
    AND payload_hash = p_payload_hash
    AND (
      processing_result = 'retryable_failure'
      OR (processing_result IN ('received', 'processing')
          AND last_attempt_at < now() - (p_stale_threshold_seconds || ' seconds')::interval)
    )
  RETURNING id INTO v_result.event_id;

  IF FOUND THEN
    v_result.owned := true;
    RETURN v_result;
  END IF;

  SELECT id, processing_result, last_attempt_at INTO v_existing
  FROM public.payment_webhook_events
  WHERE provider = p_provider AND payload_hash = p_payload_hash;

  v_result.event_id := v_existing.id;
  v_result.already_processed := v_existing.processing_result IN ('processed', 'ignored', 'permanent_failure');
  RETURN v_result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_webhook_processing(text, text, text, text, jsonb, integer) FROM public;
GRANT EXECUTE ON FUNCTION public.claim_webhook_processing(text, text, text, text, jsonb, integer) TO service_role;
