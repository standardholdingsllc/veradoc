-- =============================================================================
-- VeraDoc commercial and accounting integration
-- S/199 pricing, private promotions, immutable commercial snapshots, revenue
-- events, packet costs, contract-aligned notary payouts, and 90-day archival.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Explicit finance authority (bootstrapped from current active admins only)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.finance_authorities (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles(id),
  can_manage_promos boolean NOT NULL DEFAULT false,
  can_refund boolean NOT NULL DEFAULT false,
  can_prepare_payout boolean NOT NULL DEFAULT false,
  can_approve_payout boolean NOT NULL DEFAULT false,
  can_record_payout boolean NOT NULL DEFAULT false,
  can_record_cost boolean NOT NULL DEFAULT false,
  can_hold_archival boolean NOT NULL DEFAULT false,
  granted_by uuid REFERENCES public.profiles(id),
  granted_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.finance_authorities (
  profile_id, can_manage_promos, can_refund, can_prepare_payout,
  can_approve_payout, can_record_payout, can_record_cost,
  can_hold_archival, granted_by
)
SELECT id, true, true, true, true, true, true, true, id
FROM public.profiles
WHERE role = 'admin' AND status = 'active'
ON CONFLICT (profile_id) DO NOTHING;

ALTER TABLE public.finance_authorities ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.finance_authorities TO authenticated;
GRANT ALL ON public.finance_authorities TO service_role;

CREATE POLICY "Finance authority reads own grant"
  ON public.finance_authorities FOR SELECT TO authenticated
  USING (profile_id = auth.uid() OR public.is_active_admin());

CREATE OR REPLACE FUNCTION public.is_finance_authorized(
  p_capability text,
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.finance_authorities fa
    JOIN public.profiles p ON p.id = fa.profile_id
    WHERE fa.profile_id = p_user_id
      AND p.role = 'admin'
      AND p.status = 'active'
      AND CASE p_capability
        WHEN 'manage_promos' THEN fa.can_manage_promos
        WHEN 'refund' THEN fa.can_refund
        WHEN 'prepare_payout' THEN fa.can_prepare_payout
        WHEN 'approve_payout' THEN fa.can_approve_payout
        WHEN 'record_payout' THEN fa.can_record_payout
        WHEN 'record_cost' THEN fa.can_record_cost
        WHEN 'hold_archival' THEN fa.can_hold_archival
        ELSE false
      END
  );
$$;

REVOKE ALL ON FUNCTION public.is_finance_authorized(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_finance_authorized(text, uuid) TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 2. Effective-dated commercial configuration; activate S/199
-- -----------------------------------------------------------------------------

ALTER TABLE public.pricing_config
  DROP CONSTRAINT IF EXISTS pricing_config_product_code_key;

ALTER TABLE public.pricing_config
  ADD COLUMN IF NOT EXISTS policy_version text NOT NULL DEFAULT 'legacy_v1',
  ADD COLUMN IF NOT EXISTS tax_included boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS tax_rate_bps integer NOT NULL DEFAULT 1800
    CHECK (tax_rate_bps >= 0 AND tax_rate_bps <= 10000),
  ADD COLUMN IF NOT EXISTS effective_from timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS effective_to timestamptz,
  ADD COLUMN IF NOT EXISTS service_window_days integer NOT NULL DEFAULT 90
    CHECK (service_window_days > 0),
  ADD COLUMN IF NOT EXISTS included_services jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS excluded_services jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS approved_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS idx_pricing_config_product_effective
  ON public.pricing_config(product_code, effective_from);

UPDATE public.pricing_config
SET active = false,
    effective_to = COALESCE(effective_to, now()),
    updated_at = now()
WHERE product_code = 'lease_packet_standard'
  AND active = true
  AND amount_centimos <> 19900;

INSERT INTO public.pricing_config (
  product_code, amount_centimos, currency, description, active,
  policy_version, tax_included, tax_rate_bps, effective_from,
  service_window_days, included_services, excluded_services,
  approved_at
)
SELECT
  'lease_packet_standard', 19900, 'PEN',
  'Un documento de arrendamiento VeraDoc — precio final con IGV', true,
  'commercial_2026_09_v1', true, 1800, now(), 90,
  '["packet_processing","identity_and_evidence","firmeasy_signing","routine_messages","evidence_report","notary_processing_when_accepted","standard_corrections","cpe","standard_storage","workflow_support"]'::jsonb,
  '["additional_primary_documents","additional_notarial_acts","certified_copies","translation_or_interpreter","legalization_or_apostille","public_registry_fees","physical_delivery","extraordinary_verification"]'::jsonb,
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM public.pricing_config
  WHERE product_code = 'lease_packet_standard'
    AND active = true
    AND amount_centimos = 19900
    AND policy_version = 'commercial_2026_09_v1'
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pricing_config_one_active_product
  ON public.pricing_config(product_code)
  WHERE active = true AND effective_to IS NULL;

-- -----------------------------------------------------------------------------
-- 3. Private, server-validated promotion codes (never customer credit balances)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.private_promo_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_hash text NOT NULL UNIQUE,
  code_hint text NOT NULL,
  description text NOT NULL,
  discount_centimos integer NOT NULL CHECK (discount_centimos > 0),
  currency text NOT NULL DEFAULT 'PEN' CHECK (currency = 'PEN'),
  bound_realtor_id uuid REFERENCES public.profiles(id),
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_until timestamptz NOT NULL,
  max_redemptions integer NOT NULL DEFAULT 1 CHECK (max_redemptions > 0),
  active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  approved_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (valid_until > valid_from)
);

CREATE TABLE IF NOT EXISTS public.private_promo_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_id uuid NOT NULL REFERENCES public.private_promo_codes(id),
  payment_id uuid NOT NULL UNIQUE REFERENCES public.payments(id),
  packet_id uuid NOT NULL REFERENCES public.lease_packets(id),
  realtor_id uuid NOT NULL REFERENCES public.profiles(id),
  discount_centimos integer NOT NULL CHECK (discount_centimos > 0),
  status text NOT NULL DEFAULT 'reserved'
    CHECK (status IN ('reserved', 'redeemed', 'released')),
  reserved_at timestamptz NOT NULL DEFAULT now(),
  redeemed_at timestamptz,
  released_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_private_promos_valid
  ON public.private_promo_codes(active, valid_from, valid_until);
CREATE INDEX IF NOT EXISTS idx_private_promo_redemptions_count
  ON public.private_promo_redemptions(promo_id, status);

ALTER TABLE public.private_promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.private_promo_redemptions ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.private_promo_codes TO service_role;
GRANT ALL ON public.private_promo_redemptions TO service_role;

CREATE OR REPLACE FUNCTION public.create_private_promo_code(
  p_code_hash text,
  p_code_hint text,
  p_description text,
  p_discount_centimos integer,
  p_valid_until timestamptz,
  p_bound_realtor_id uuid DEFAULT NULL,
  p_max_redemptions integer DEFAULT 1
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_id uuid;
BEGIN
  IF v_actor IS NULL OR NOT public.is_finance_authorized('manage_promos', v_actor) THEN
    RAISE EXCEPTION 'Finance promotion authority required';
  END IF;
  IF NULLIF(btrim(p_code_hash), '') IS NULL OR NULLIF(btrim(p_code_hint), '') IS NULL THEN
    RAISE EXCEPTION 'Promotion code hash and hint are required';
  END IF;
  IF NULLIF(btrim(p_description), '') IS NULL THEN
    RAISE EXCEPTION 'Promotion reason is required';
  END IF;
  IF p_discount_centimos <= 0 OR p_discount_centimos >= 19900 THEN
    RAISE EXCEPTION 'Promotion must be between S/0.01 and S/198.99';
  END IF;
  IF p_valid_until <= now() THEN
    RAISE EXCEPTION 'Promotion expiry must be in the future';
  END IF;
  IF p_max_redemptions <= 0 THEN
    RAISE EXCEPTION 'Promotion redemption limit must be positive';
  END IF;

  INSERT INTO public.private_promo_codes (
    code_hash, code_hint, description, discount_centimos,
    bound_realtor_id, valid_until, max_redemptions,
    created_by, approved_by
  ) VALUES (
    lower(btrim(p_code_hash)), upper(btrim(p_code_hint)), btrim(p_description),
    p_discount_centimos, p_bound_realtor_id, p_valid_until,
    p_max_redemptions, v_actor, v_actor
  ) RETURNING id INTO v_id;

  RETURN jsonb_build_object(
    'promo_id', v_id,
    'code_hint', upper(btrim(p_code_hint)),
    'discount_centimos', p_discount_centimos,
    'valid_until', p_valid_until,
    'max_redemptions', p_max_redemptions
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_private_promo_code(text, text, text, integer, timestamptz, uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_private_promo_code(text, text, text, integer, timestamptz, uuid, integer) TO authenticated;

-- -----------------------------------------------------------------------------
-- 4. Immutable commercial snapshot, financial events, and packet costs
-- -----------------------------------------------------------------------------

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS pricing_config_id uuid REFERENCES public.pricing_config(id),
  ADD COLUMN IF NOT EXISTS standard_amount_centimos integer,
  ADD COLUMN IF NOT EXISTS promo_discount_centimos integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS promo_code_hint text,
  ADD COLUMN IF NOT EXISTS processing_fee_centimos integer CHECK (processing_fee_centimos >= 0),
  ADD COLUMN IF NOT EXISTS recognized_at timestamptz;

CREATE TABLE IF NOT EXISTS public.payment_commercial_snapshots (
  payment_id uuid PRIMARY KEY REFERENCES public.payments(id),
  packet_id uuid NOT NULL REFERENCES public.lease_packets(id),
  pricing_config_id uuid NOT NULL REFERENCES public.pricing_config(id),
  promo_id uuid REFERENCES public.private_promo_codes(id),
  product_code text NOT NULL,
  policy_version text NOT NULL,
  standard_gross_centimos integer NOT NULL CHECK (standard_gross_centimos > 0),
  promo_discount_centimos integer NOT NULL DEFAULT 0 CHECK (promo_discount_centimos >= 0),
  gross_due_centimos integer NOT NULL CHECK (gross_due_centimos > 0),
  tax_included boolean NOT NULL,
  tax_rate_bps integer NOT NULL CHECK (tax_rate_bps >= 0),
  tax_centimos integer NOT NULL CHECK (tax_centimos >= 0),
  value_of_sale_centimos integer NOT NULL CHECK (value_of_sale_centimos > 0),
  service_window_days integer NOT NULL CHECK (service_window_days > 0),
  included_services jsonb NOT NULL DEFAULT '[]'::jsonb,
  excluded_services jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  CHECK (standard_gross_centimos - promo_discount_centimos = gross_due_centimos),
  CHECK (tax_centimos + value_of_sale_centimos = gross_due_centimos)
);

CREATE TABLE IF NOT EXISTS public.commercial_financial_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  packet_id uuid NOT NULL REFERENCES public.lease_packets(id),
  payment_id uuid NOT NULL REFERENCES public.payments(id),
  event_type text NOT NULL CHECK (event_type IN (
    'revenue_recognized', 'refund_recognized', 'chargeback_recognized',
    'manual_adjustment'
  )),
  source_kind text NOT NULL,
  source_id text NOT NULL,
  standard_gross_centimos integer NOT NULL DEFAULT 0,
  promo_discount_centimos integer NOT NULL DEFAULT 0,
  gross_amount_centimos integer NOT NULL,
  tax_amount_centimos integer NOT NULL,
  net_amount_centimos integer NOT NULL,
  currency text NOT NULL DEFAULT 'PEN' CHECK (currency = 'PEN'),
  occurred_at timestamptz NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (gross_amount_centimos = tax_amount_centimos + net_amount_centimos)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_commercial_financial_event_source
  ON public.commercial_financial_events(payment_id, event_type, source_kind, source_id);

CREATE TABLE IF NOT EXISTS public.packet_cost_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  packet_id uuid NOT NULL REFERENCES public.lease_packets(id),
  payment_id uuid REFERENCES public.payments(id),
  category text NOT NULL CHECK (category IN (
    'payment_processing', 'signing', 'messaging_email', 'messaging_whatsapp',
    'cpe', 'storage', 'notary_participation', 'notary_promo_top_up',
    'notary_igv', 'refund_fee', 'chargeback_fee', 'other_approved_direct_cost'
  )),
  provider text,
  amount_centimos integer NOT NULL CHECK (amount_centimos <> 0),
  currency text NOT NULL DEFAULT 'PEN' CHECK (currency = 'PEN'),
  cost_status text NOT NULL DEFAULT 'actual'
    CHECK (cost_status IN ('estimated', 'actual', 'reversal')),
  tax_treatment text NOT NULL DEFAULT 'pending_review',
  source_kind text NOT NULL,
  source_id text NOT NULL,
  evidence_reference text,
  allocation_method text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id),
  approved_by uuid REFERENCES public.profiles(id),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_packet_cost_event_source
  ON public.packet_cost_events(packet_id, category, source_kind, source_id);
CREATE INDEX IF NOT EXISTS idx_packet_cost_events_packet
  ON public.packet_cost_events(packet_id, occurred_at);

ALTER TABLE public.payment_commercial_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commercial_financial_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.packet_cost_events ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.payment_commercial_snapshots TO service_role;
GRANT ALL ON public.commercial_financial_events TO service_role;
GRANT ALL ON public.packet_cost_events TO service_role;

CREATE OR REPLACE FUNCTION public.protect_locked_commercial_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.locked_at IS NOT NULL THEN
    RAISE EXCEPTION 'Captured commercial snapshots are immutable';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_locked_commercial_snapshot
  ON public.payment_commercial_snapshots;
CREATE TRIGGER trg_protect_locked_commercial_snapshot
  BEFORE UPDATE OR DELETE ON public.payment_commercial_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.protect_locked_commercial_snapshot();

CREATE OR REPLACE FUNCTION public.prevent_commercial_ledger_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'Commercial ledger events are append-only; record a reversal instead';
END;
$$;

DROP TRIGGER IF EXISTS trg_commercial_financial_events_append_only
  ON public.commercial_financial_events;
CREATE TRIGGER trg_commercial_financial_events_append_only
  BEFORE UPDATE OR DELETE ON public.commercial_financial_events
  FOR EACH ROW EXECUTE FUNCTION public.prevent_commercial_ledger_mutation();

DROP TRIGGER IF EXISTS trg_packet_cost_events_append_only
  ON public.packet_cost_events;
CREATE TRIGGER trg_packet_cost_events_append_only
  BEFORE UPDATE OR DELETE ON public.packet_cost_events
  FOR EACH ROW EXECUTE FUNCTION public.prevent_commercial_ledger_mutation();

-- -----------------------------------------------------------------------------
-- 5. Packet service-window and soft-archive state
-- -----------------------------------------------------------------------------

ALTER TABLE public.lease_packets
  DROP CONSTRAINT IF EXISTS lease_packets_status_check;

ALTER TABLE public.lease_packets
  ADD CONSTRAINT lease_packets_status_check
  CHECK (status IN (
    'draft', 'signing', 'all_signed', 'pending_notary',
    'under_review', 'awaiting_notary_seal', 'needs_correction',
    'certified', 'rejected', 'archived'
  ));

ALTER TABLE public.lease_packets
  ADD COLUMN IF NOT EXISTS service_window_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS service_window_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archive_reason text,
  ADD COLUMN IF NOT EXISTS archive_policy_version text,
  ADD COLUMN IF NOT EXISTS archival_hold_until timestamptz,
  ADD COLUMN IF NOT EXISTS archival_hold_reason text,
  ADD COLUMN IF NOT EXISTS archival_hold_approved_by uuid REFERENCES public.profiles(id);

CREATE INDEX IF NOT EXISTS idx_lease_packets_service_window
  ON public.lease_packets(service_window_ends_at, status)
  WHERE service_window_ends_at IS NOT NULL AND archived_at IS NULL;

-- -----------------------------------------------------------------------------
-- 6. Commercial pricing preview and atomic payment claim
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.preview_private_promo(
  p_realtor_id uuid,
  p_code_hash text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_price RECORD;
  v_promo RECORD;
  v_used integer;
  v_due integer;
  v_subtotal integer;
BEGIN
  SELECT * INTO v_price
  FROM public.pricing_config
  WHERE product_code = 'lease_packet_standard'
    AND active = true
    AND effective_from <= now()
    AND (effective_to IS NULL OR effective_to > now())
  ORDER BY effective_from DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No active packet price';
  END IF;

  SELECT * INTO v_promo
  FROM public.private_promo_codes
  WHERE code_hash = lower(btrim(p_code_hash))
    AND active = true
    AND valid_from <= now()
    AND valid_until > now()
    AND (bound_realtor_id IS NULL OR bound_realtor_id = p_realtor_id);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Promotion code is invalid or expired';
  END IF;

  SELECT count(*) INTO v_used
  FROM public.private_promo_redemptions
  WHERE promo_id = v_promo.id AND status IN ('reserved', 'redeemed');

  IF v_used >= v_promo.max_redemptions THEN
    RAISE EXCEPTION 'Promotion code has already been used';
  END IF;

  IF v_promo.discount_centimos >= v_price.amount_centimos THEN
    RAISE EXCEPTION 'Promotion must leave a positive payable amount';
  END IF;

  v_due := v_price.amount_centimos - v_promo.discount_centimos;
  v_subtotal := floor((v_due * 100.0 + 59) / 118.0)::integer;

  RETURN jsonb_build_object(
    'promo_id', v_promo.id,
    'code_hint', v_promo.code_hint,
    'standard_amount_centimos', v_price.amount_centimos,
    'discount_centimos', v_promo.discount_centimos,
    'amount_centimos', v_due,
    'subtotal_centimos', v_subtotal,
    'igv_centimos', v_due - v_subtotal,
    'currency', v_price.currency,
    'valid_until', v_promo.valid_until
  );
END;
$$;

REVOKE ALL ON FUNCTION public.preview_private_promo(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.preview_private_promo(uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.claim_commercial_payment_attempt(
  p_packet_id uuid,
  p_realtor_id uuid,
  p_payment_provider text,
  p_idempotency_key text,
  p_comprobante_type text,
  p_purchaser_tipo_doc text,
  p_purchaser_num_doc text,
  p_purchaser_razon_social text,
  p_purchaser_address jsonb DEFAULT NULL,
  p_promo_code_hash text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_packet RECORD;
  v_existing RECORD;
  v_existing_snapshot RECORD;
  v_price RECORD;
  v_promo_id uuid := NULL;
  v_promo_code_hint text := NULL;
  v_promo_discount_centimos integer := NULL;
  v_promo_max_redemptions integer := NULL;
  v_used integer;
  v_discount integer := 0;
  v_due integer;
  v_subtotal integer;
  v_payment_id uuid;
BEGIN
  SELECT * INTO v_packet
  FROM public.lease_packets
  WHERE id = p_packet_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Packet not found: %', p_packet_id; END IF;
  IF v_packet.created_by != p_realtor_id THEN RAISE EXCEPTION 'Packet not owned by realtor'; END IF;
  IF v_packet.status != 'draft' THEN RAISE EXCEPTION 'Packet is not in draft status: %', v_packet.status; END IF;

  SELECT * INTO v_existing
  FROM public.payments
  WHERE packet_id = p_packet_id
    AND status IN ('prepared', 'processing', 'requires_action', 'completed')
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    IF v_existing.realtor_id != p_realtor_id THEN RAISE EXCEPTION 'Existing payment belongs to different realtor'; END IF;
    IF v_existing.payment_provider != p_payment_provider THEN RAISE EXCEPTION 'Existing payment belongs to different provider'; END IF;

    IF v_existing.status = 'prepared' THEN
      UPDATE public.payments
      SET comprobante_type = p_comprobante_type,
          purchaser_tipo_doc = p_purchaser_tipo_doc,
          purchaser_num_doc = p_purchaser_num_doc,
          purchaser_razon_social = p_purchaser_razon_social,
          purchaser_address = p_purchaser_address,
          cpe_snapshot_version = 1,
          updated_at = now()
      WHERE id = v_existing.id;
    ELSIF COALESCE(v_existing.comprobante_type, '') != COALESCE(p_comprobante_type, '')
       OR COALESCE(v_existing.purchaser_tipo_doc, '') != COALESCE(p_purchaser_tipo_doc, '')
       OR COALESCE(v_existing.purchaser_num_doc, '') != COALESCE(p_purchaser_num_doc, '')
       OR COALESCE(v_existing.purchaser_razon_social, '') != COALESCE(p_purchaser_razon_social, '')
       OR v_existing.purchaser_address IS DISTINCT FROM p_purchaser_address
    THEN
      RAISE EXCEPTION 'Cannot change purchaser data after payment status %', v_existing.status;
    END IF;

    SELECT * INTO v_existing_snapshot
    FROM public.payment_commercial_snapshots
    WHERE payment_id = v_existing.id;

    RETURN jsonb_build_object(
      'payment_id', v_existing.id,
      'existing_status', v_existing.status,
      'amount_centimos', v_existing.amount_centimos,
      'standard_amount_centimos', COALESCE(v_existing_snapshot.standard_gross_centimos, v_existing.amount_centimos),
      'discount_centimos', COALESCE(v_existing_snapshot.promo_discount_centimos, 0),
      'promo_code_hint', v_existing.promo_code_hint,
      'currency', v_existing.currency,
      'claimed', false
    );
  END IF;

  SELECT * INTO v_price
  FROM public.pricing_config
  WHERE product_code = 'lease_packet_standard'
    AND active = true
    AND effective_from <= now()
    AND (effective_to IS NULL OR effective_to > now())
  ORDER BY effective_from DESC
  LIMIT 1;

  IF NOT FOUND THEN RAISE EXCEPTION 'No active packet price'; END IF;

  IF NULLIF(btrim(p_promo_code_hash), '') IS NOT NULL THEN
    SELECT id, code_hint, discount_centimos, max_redemptions
    INTO v_promo_id, v_promo_code_hint, v_promo_discount_centimos, v_promo_max_redemptions
    FROM public.private_promo_codes
    WHERE code_hash = lower(btrim(p_promo_code_hash))
      AND active = true
      AND valid_from <= now()
      AND valid_until > now()
      AND (bound_realtor_id IS NULL OR bound_realtor_id = p_realtor_id)
    FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Promotion code is invalid or expired'; END IF;

    SELECT count(*) INTO v_used
    FROM public.private_promo_redemptions
    WHERE promo_id = v_promo_id AND status IN ('reserved', 'redeemed');

    IF v_used >= v_promo_max_redemptions THEN RAISE EXCEPTION 'Promotion code has already been used'; END IF;
    v_discount := v_promo_discount_centimos;
  END IF;

  v_due := v_price.amount_centimos - v_discount;
  IF v_due <= 0 THEN RAISE EXCEPTION 'Promotion must leave a positive payable amount'; END IF;
  v_subtotal := floor((v_due * 100.0 + 59) / 118.0)::integer;
  v_payment_id := gen_random_uuid();

  INSERT INTO public.payments (
    id, packet_id, realtor_id, amount, amount_centimos, currency, status,
    payment_provider, idempotency_key, comprobante_type, purchaser_tipo_doc,
    purchaser_num_doc, purchaser_razon_social, purchaser_address,
    cpe_snapshot_version, pricing_config_id, standard_amount_centimos,
    promo_discount_centimos, promo_code_hint, updated_at
  ) VALUES (
    v_payment_id, p_packet_id, p_realtor_id, v_due / 100.0, v_due,
    v_price.currency, 'prepared', p_payment_provider, p_idempotency_key,
    p_comprobante_type, p_purchaser_tipo_doc, p_purchaser_num_doc,
    p_purchaser_razon_social, p_purchaser_address, 1, v_price.id,
    v_price.amount_centimos, v_discount,
    v_promo_code_hint,
    now()
  );

  INSERT INTO public.payment_commercial_snapshots (
    payment_id, packet_id, pricing_config_id, promo_id, product_code,
    policy_version, standard_gross_centimos, promo_discount_centimos,
    gross_due_centimos, tax_included, tax_rate_bps, tax_centimos,
    value_of_sale_centimos, service_window_days, included_services,
    excluded_services
  ) VALUES (
    v_payment_id, p_packet_id, v_price.id, v_promo_id, v_price.product_code,
    v_price.policy_version, v_price.amount_centimos, v_discount, v_due,
    v_price.tax_included, v_price.tax_rate_bps, v_due - v_subtotal,
    v_subtotal, v_price.service_window_days, v_price.included_services,
    v_price.excluded_services
  );

  IF v_promo_id IS NOT NULL THEN
    INSERT INTO public.private_promo_redemptions (
      promo_id, payment_id, packet_id, realtor_id, discount_centimos
    ) VALUES (
      v_promo_id, v_payment_id, p_packet_id, p_realtor_id, v_discount
    );
  END IF;

  INSERT INTO public.packet_audit_log (packet_id, actor_id, action, metadata)
  VALUES (
    p_packet_id, p_realtor_id, 'commercial_payment_prepared',
    jsonb_build_object(
      'payment_id', v_payment_id,
      'policy_version', v_price.policy_version,
      'standard_amount_centimos', v_price.amount_centimos,
      'promo_discount_centimos', v_discount,
      'amount_centimos', v_due,
      'promo_code_hint', v_promo_code_hint
    )
  );

  RETURN jsonb_build_object(
    'payment_id', v_payment_id,
    'existing_status', 'prepared',
    'amount_centimos', v_due,
    'standard_amount_centimos', v_price.amount_centimos,
    'discount_centimos', v_discount,
    'promo_code_hint', v_promo_code_hint,
    'currency', v_price.currency,
    'claimed', true
  );
END;
$$;

REVOKE ALL ON FUNCTION public.claim_commercial_payment_attempt(uuid, uuid, text, text, text, text, text, text, jsonb, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_commercial_payment_attempt(uuid, uuid, text, text, text, text, text, text, jsonb, text) TO service_role;

-- -----------------------------------------------------------------------------
-- 7. Atomic capture + recognition + CPE enqueue + cost snapshot
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.process_commercial_payment_success(
  p_payment_id uuid,
  p_payment_provider text,
  p_provider_payment_id text,
  p_provider_amount_centimos integer,
  p_provider_currency text,
  p_payment_method text,
  p_actor_id uuid,
  p_processing_fee_centimos integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment RECORD;
  v_snapshot RECORD;
  v_paid_at timestamptz;
BEGIN
  SELECT * INTO v_payment
  FROM public.payments
  WHERE id = p_payment_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Payment not found: %', p_payment_id; END IF;
  IF p_processing_fee_centimos IS NOT NULL AND p_processing_fee_centimos < 0 THEN
    RAISE EXCEPTION 'Processing fee cannot be negative';
  END IF;

  SELECT * INTO v_snapshot
  FROM public.payment_commercial_snapshots
  WHERE payment_id = p_payment_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Payment missing commercial snapshot'; END IF;

  IF v_payment.status = 'completed' THEN
    IF v_payment.payment_provider != p_payment_provider
       OR v_payment.payment_provider_ref != p_provider_payment_id THEN
      RETURN jsonb_build_object('outcome', 'already_completed_conflict');
    END IF;
    v_paid_at := v_payment.paid_at;
  ELSE
    IF v_payment.payment_provider != p_payment_provider THEN
      RETURN jsonb_build_object('outcome', 'provider_mismatch');
    END IF;
    IF v_payment.status NOT IN ('prepared', 'processing', 'requires_action') THEN
      RETURN jsonb_build_object('outcome', 'invalid_status');
    END IF;
    IF v_payment.amount_centimos != p_provider_amount_centimos THEN
      RETURN jsonb_build_object('outcome', 'amount_mismatch');
    END IF;
    IF v_payment.currency != p_provider_currency THEN
      RETURN jsonb_build_object('outcome', 'currency_mismatch');
    END IF;

    v_paid_at := now();
    UPDATE public.payments
    SET status = 'completed',
        payment_provider_ref = p_provider_payment_id,
        payment_method = p_payment_method,
        paid_at = v_paid_at,
        recognized_at = v_paid_at,
        processing_fee_centimos = p_processing_fee_centimos,
        updated_at = now()
    WHERE id = p_payment_id;

    UPDATE public.payment_commercial_snapshots
    SET locked_at = COALESCE(locked_at, v_paid_at)
    WHERE payment_id = p_payment_id;

    UPDATE public.private_promo_redemptions
    SET status = 'redeemed', redeemed_at = v_paid_at
    WHERE payment_id = p_payment_id AND status = 'reserved';

    UPDATE public.lease_packets
    SET service_window_started_at = COALESCE(service_window_started_at, v_paid_at),
        service_window_ends_at = COALESCE(
          service_window_ends_at,
          v_paid_at + make_interval(days => v_snapshot.service_window_days)
        ),
        updated_at = now()
    WHERE id = v_payment.packet_id;

    INSERT INTO public.packet_audit_log (packet_id, actor_id, action, metadata)
    VALUES (
      v_payment.packet_id, p_actor_id, 'payment_completed',
      jsonb_build_object(
        'payment_provider', p_payment_provider,
        'provider_payment_id', p_provider_payment_id,
        'amount_centimos', v_payment.amount_centimos,
        'standard_amount_centimos', v_snapshot.standard_gross_centimos,
        'promo_discount_centimos', v_snapshot.promo_discount_centimos,
        'currency', v_payment.currency,
        'payment_method', p_payment_method,
        'recognized_at', v_paid_at
      )
    );
  END IF;

  IF p_processing_fee_centimos IS NOT NULL
     AND v_payment.processing_fee_centimos IS NULL THEN
    UPDATE public.payments
    SET processing_fee_centimos = p_processing_fee_centimos,
        updated_at = now()
    WHERE id = p_payment_id;
  END IF;

  INSERT INTO public.commercial_financial_events (
    packet_id, payment_id, event_type, source_kind, source_id,
    standard_gross_centimos, promo_discount_centimos,
    gross_amount_centimos, tax_amount_centimos, net_amount_centimos,
    currency, occurred_at, metadata
  ) VALUES (
    v_payment.packet_id, p_payment_id, 'revenue_recognized',
    'payment', p_payment_id::text,
    v_snapshot.standard_gross_centimos, v_snapshot.promo_discount_centimos,
    v_snapshot.gross_due_centimos, v_snapshot.tax_centimos,
    v_snapshot.value_of_sale_centimos, v_payment.currency, v_paid_at,
    jsonb_build_object('policy_version', v_snapshot.policy_version)
  ) ON CONFLICT DO NOTHING;

  IF p_processing_fee_centimos IS NOT NULL AND p_processing_fee_centimos > 0 THEN
    INSERT INTO public.packet_cost_events (
      packet_id, payment_id, category, provider, amount_centimos,
      cost_status, tax_treatment, source_kind, source_id,
      allocation_method, occurred_at, metadata
    ) SELECT
      v_payment.packet_id, p_payment_id, 'payment_processing',
      p_payment_provider, p_processing_fee_centimos, 'actual',
      'provider_reported', 'provider_payment', p_provider_payment_id,
      'direct_transaction', v_paid_at,
      jsonb_build_object('payment_method', p_payment_method)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.packet_cost_events c
      WHERE c.payment_id = p_payment_id
        AND c.category = 'payment_processing'
        AND c.cost_status = 'actual'
    )
    ON CONFLICT DO NOTHING;
  END IF;

  IF v_payment.cpe_snapshot_version >= 1
     AND v_payment.comprobante_type IS NOT NULL
     AND v_payment.purchaser_num_doc IS NOT NULL
     AND v_payment.purchaser_razon_social IS NOT NULL THEN
    INSERT INTO public.notification_outbox (
      packet_id, event_type, recipient_key, payload, status, available_at
    ) VALUES (
      v_payment.packet_id, 'cpe_prepare', 'payment:' || v_payment.id,
      jsonb_build_object(
        'source_kind', 'payment', 'payment_id', v_payment.id,
        'user_id', v_payment.realtor_id
      ),
      'pending', now()
    ) ON CONFLICT (packet_id, event_type, recipient_key) DO NOTHING;
  END IF;

  RETURN jsonb_build_object(
    'outcome', CASE WHEN v_payment.status = 'completed'
      THEN 'already_completed_same_payment' ELSE 'completed' END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.process_commercial_payment_success(uuid, text, text, integer, text, text, uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_commercial_payment_success(uuid, text, text, integer, text, text, uuid, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.release_promo_on_terminal_payment()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('failed', 'cancelled') AND OLD.status IS DISTINCT FROM NEW.status THEN
    UPDATE public.private_promo_redemptions
    SET status = 'released', released_at = now()
    WHERE payment_id = NEW.id AND status = 'reserved';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_release_promo_on_terminal_payment ON public.payments;
CREATE TRIGGER trg_release_promo_on_terminal_payment
  AFTER UPDATE OF status ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.release_promo_on_terminal_payment();

-- -----------------------------------------------------------------------------
-- 8. Policy-enforced refund claiming and financial reversal events
-- -----------------------------------------------------------------------------

ALTER TABLE public.payment_refunds
  ADD COLUMN IF NOT EXISTS policy_version text,
  ADD COLUMN IF NOT EXISTS policy_reason text,
  ADD COLUMN IF NOT EXISTS approval_evidence text,
  ADD COLUMN IF NOT EXISTS policy_approved_by uuid REFERENCES public.profiles(id);

CREATE OR REPLACE FUNCTION public.claim_policy_payment_refund(
  p_payment_id uuid,
  p_request_id uuid,
  p_requested_by uuid,
  p_amount_centimos integer,
  p_reason_code text,
  p_reason_description text,
  p_idempotency_key text,
  p_policy_reason text,
  p_approval_evidence text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment RECORD;
  v_result jsonb;
BEGIN
  IF NOT public.is_finance_authorized('refund', p_requested_by) THEN
    RAISE EXCEPTION 'Finance refund authority required';
  END IF;
  IF p_policy_reason NOT IN (
    'duplicate_charge', 'incorrect_amount', 'unauthorized_payment',
    'veradoc_failure', 'mandatory_remedy'
  ) THEN
    RAISE EXCEPTION 'Refund is not eligible under the no-routine-refunds policy';
  END IF;
  IF length(btrim(COALESCE(p_approval_evidence, ''))) < 10 THEN
    RAISE EXCEPTION 'Approval evidence is required';
  END IF;

  SELECT * INTO v_payment FROM public.payments WHERE id = p_payment_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payment not found'; END IF;
  IF v_payment.paid_at IS NULL OR now() > v_payment.paid_at + interval '90 days' THEN
    RAISE EXCEPTION 'Mercado Pago refund window has expired';
  END IF;

  v_result := public.claim_payment_refund(
    p_payment_id, p_request_id, p_requested_by, p_amount_centimos,
    p_reason_code, p_reason_description, p_idempotency_key
  );

  UPDATE public.payment_refunds
  SET policy_version = 'commercial_2026_09_v1',
      policy_reason = p_policy_reason,
      approval_evidence = btrim(p_approval_evidence),
      policy_approved_by = p_requested_by,
      updated_at = now()
  WHERE id = (v_result ->> 'refund_id')::uuid;

  RETURN v_result || jsonb_build_object(
    'policy_version', 'commercial_2026_09_v1',
    'policy_reason', p_policy_reason
  );
END;
$$;

REVOKE ALL ON FUNCTION public.claim_policy_payment_refund(uuid, uuid, uuid, integer, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_policy_payment_refund(uuid, uuid, uuid, integer, text, text, text, text, text) TO service_role;

-- Add financial reversal recording to the existing refund completion contract.
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
  v_snapshot RECORD;
  v_cumulative bigint;
  v_new_status text;
  v_refund_subtotal integer;
BEGIN
  SELECT * INTO v_refund
  FROM public.payment_refunds WHERE id = p_refund_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Refund not found: %', p_refund_id; END IF;
  IF v_refund.status = 'succeeded' THEN
    RETURN jsonb_build_object('outcome', 'already_succeeded');
  END IF;
  IF v_refund.amount_centimos != p_provider_amount_centimos THEN
    RAISE EXCEPTION 'Provider amount mismatch: expected=%, got=%',
      v_refund.amount_centimos, p_provider_amount_centimos;
  END IF;

  UPDATE public.payment_refunds
  SET status = 'succeeded', provider_refund_id = p_provider_refund_id,
      provider_response = p_provider_response, refunded_at = now(), updated_at = now()
  WHERE id = p_refund_id;

  SELECT * INTO v_payment
  FROM public.payments WHERE id = v_refund.payment_id FOR UPDATE;
  SELECT * INTO v_snapshot
  FROM public.payment_commercial_snapshots WHERE payment_id = v_refund.payment_id;

  SELECT COALESCE(sum(amount_centimos), 0) INTO v_cumulative
  FROM public.payment_refunds
  WHERE payment_id = v_refund.payment_id AND status = 'succeeded';

  v_new_status := CASE WHEN v_cumulative >= v_payment.amount_centimos
    THEN 'refunded' ELSE 'partially_refunded' END;
  UPDATE public.payments SET status = v_new_status, updated_at = now()
  WHERE id = v_refund.payment_id;

  v_refund_subtotal := floor((v_refund.amount_centimos * 100.0 + 59) / 118.0)::integer;
  INSERT INTO public.commercial_financial_events (
    packet_id, payment_id, event_type, source_kind, source_id,
    standard_gross_centimos, promo_discount_centimos,
    gross_amount_centimos, tax_amount_centimos, net_amount_centimos,
    currency, occurred_at, metadata
  ) VALUES (
    v_refund.packet_id, v_refund.payment_id, 'refund_recognized',
    'refund', v_refund.id::text,
    0, 0, -v_refund.amount_centimos,
    -(v_refund.amount_centimos - v_refund_subtotal), -v_refund_subtotal,
    v_refund.currency, now(),
    jsonb_build_object(
      'policy_version', v_refund.policy_version,
      'policy_reason', v_refund.policy_reason,
      'provider_refund_id', p_provider_refund_id
    )
  ) ON CONFLICT DO NOTHING;

  INSERT INTO public.packet_audit_log (packet_id, actor_id, action, metadata)
  VALUES (
    v_refund.packet_id, v_refund.requested_by, 'payment_refunded',
    jsonb_build_object(
      'refund_id', v_refund.id,
      'amount_centimos', v_refund.amount_centimos,
      'reason_code', v_refund.reason_code,
      'policy_reason', v_refund.policy_reason,
      'provider_refund_id', p_provider_refund_id
    )
  );

  INSERT INTO public.notification_outbox (
    packet_id, event_type, recipient_key, payload, status, available_at
  ) VALUES (
    v_refund.packet_id, 'cpe_prepare', 'refund:' || v_refund.id,
    jsonb_build_object(
      'source_kind', 'refund', 'refund_id', v_refund.id,
      'payment_id', v_refund.payment_id, 'user_id', v_refund.realtor_id
    ),
    'pending', now()
  ) ON CONFLICT (packet_id, event_type, recipient_key) DO NOTHING;

  RETURN jsonb_build_object('outcome', 'completed', 'payment_status', v_new_status);
END;
$$;

REVOKE ALL ON FUNCTION public.complete_payment_refund(uuid, text, integer, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_payment_refund(uuid, text, integer, jsonb) TO service_role;

-- -----------------------------------------------------------------------------
-- 9. Contract-aligned notary terms, preparation, approval, and payment
-- -----------------------------------------------------------------------------

ALTER TABLE public.notary_payout_rates
  ALTER COLUMN amount_per_certification DROP NOT NULL;
ALTER TABLE public.notary_payout_rates
  DROP CONSTRAINT IF EXISTS notary_payout_rates_amount_per_certification_check;
ALTER TABLE public.notary_payout_rates
  ADD COLUMN IF NOT EXISTS participation_bps integer NOT NULL DEFAULT 4000
    CHECK (participation_bps > 0 AND participation_bps <= 10000),
  ADD COLUMN IF NOT EXISTS formula_version text NOT NULL DEFAULT 'mnd_percentage_v1',
  ADD COLUMN IF NOT EXISTS protect_standard_price_for_promos boolean NOT NULL DEFAULT true;

ALTER TABLE public.notary_monthly_payouts
  DROP CONSTRAINT IF EXISTS notary_monthly_payouts_status_check;
ALTER TABLE public.notary_monthly_payouts
  ADD CONSTRAINT notary_monthly_payouts_status_check
  CHECK (status IN ('prepared', 'confirmed', 'paid', 'disputed', 'void'));
ALTER TABLE public.notary_monthly_payouts
  ALTER COLUMN confirmed_by DROP NOT NULL,
  ALTER COLUMN confirmed_at DROP NOT NULL,
  ALTER COLUMN status SET DEFAULT 'prepared';
ALTER TABLE public.notary_monthly_payouts
  ADD COLUMN IF NOT EXISTS prepared_by uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS prepared_at timestamptz,
  ADD COLUMN IF NOT EXISTS notary_comprobante_reference text,
  ADD COLUMN IF NOT EXISTS notary_comprobante_received_at timestamptz,
  ADD COLUMN IF NOT EXISTS formula_version text NOT NULL DEFAULT 'mnd_percentage_v1',
  ADD COLUMN IF NOT EXISTS contractual_amount_centimos integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS promo_top_up_centimos integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS notary_igv_centimos integer NOT NULL DEFAULT 0;

UPDATE public.notary_monthly_payouts
SET prepared_by = COALESCE(prepared_by, confirmed_by),
    prepared_at = COALESCE(prepared_at, confirmed_at, created_at)
WHERE prepared_by IS NULL OR prepared_at IS NULL;

ALTER TABLE public.notary_payout_items
  ADD COLUMN IF NOT EXISTS payment_id uuid REFERENCES public.payments(id),
  ADD COLUMN IF NOT EXISTS packet_id uuid REFERENCES public.lease_packets(id),
  ADD COLUMN IF NOT EXISTS standard_gross_centimos integer,
  ADD COLUMN IF NOT EXISTS actual_gross_centimos integer,
  ADD COLUMN IF NOT EXISTS tax_centimos integer,
  ADD COLUMN IF NOT EXISTS processing_fee_centimos integer,
  ADD COLUMN IF NOT EXISTS actual_mnd_centimos integer,
  ADD COLUMN IF NOT EXISTS protected_mnd_centimos integer,
  ADD COLUMN IF NOT EXISTS contractual_participation_centimos integer,
  ADD COLUMN IF NOT EXISTS promo_top_up_centimos integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_before_igv_centimos integer,
  ADD COLUMN IF NOT EXISTS formula_version text NOT NULL DEFAULT 'mnd_percentage_v1';

CREATE OR REPLACE FUNCTION public.set_notary_percentage_terms(
  p_notary_id uuid,
  p_participation_percent numeric,
  p_effective_from date,
  p_contract_reference text DEFAULT NULL,
  p_protect_promos boolean DEFAULT true
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_rate_id uuid;
  v_bps integer;
  v_effective_to date;
BEGIN
  IF v_actor IS NULL OR NOT public.is_finance_authorized('prepare_payout', v_actor) THEN
    RAISE EXCEPTION 'Finance payout authority required';
  END IF;
  v_bps := round(p_participation_percent * 100)::integer;
  IF v_bps <= 0 OR v_bps > 10000 THEN RAISE EXCEPTION 'Invalid participation percentage'; END IF;
  IF NOT public.is_active_notary(p_notary_id) THEN RAISE EXCEPTION 'Active notary not found'; END IF;

  UPDATE public.notary_payout_rates
  SET effective_to = p_effective_from - 1
  WHERE notary_id = p_notary_id
    AND effective_from < p_effective_from
    AND (effective_to IS NULL OR effective_to >= p_effective_from);

  SELECT min(effective_from) - 1 INTO v_effective_to
  FROM public.notary_payout_rates
  WHERE notary_id = p_notary_id AND effective_from > p_effective_from;

  INSERT INTO public.notary_payout_rates (
    notary_id, amount_per_certification, participation_bps,
    formula_version, protect_standard_price_for_promos,
    effective_from, effective_to, contract_reference, created_by
  ) VALUES (
    p_notary_id, NULL, v_bps, 'mnd_percentage_v1', p_protect_promos,
    p_effective_from, v_effective_to,
    NULLIF(btrim(p_contract_reference), ''), v_actor
  )
  ON CONFLICT (notary_id, effective_from) DO UPDATE
  SET amount_per_certification = NULL,
      participation_bps = EXCLUDED.participation_bps,
      formula_version = EXCLUDED.formula_version,
      protect_standard_price_for_promos = EXCLUDED.protect_standard_price_for_promos,
      effective_to = EXCLUDED.effective_to,
      contract_reference = EXCLUDED.contract_reference,
      created_by = EXCLUDED.created_by,
      created_at = now()
  RETURNING id INTO v_rate_id;

  RETURN v_rate_id;
END;
$$;

REVOKE ALL ON FUNCTION public.set_notary_percentage_terms(uuid, numeric, date, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_notary_percentage_terms(uuid, numeric, date, text, boolean) TO authenticated;

-- Configure the contracted partner when that profile already exists.
INSERT INTO public.notary_payout_rates (
  notary_id, amount_per_certification, participation_bps, formula_version,
  protect_standard_price_for_promos, effective_from, contract_reference, created_by
)
SELECT id, NULL, 4000, 'mnd_percentage_v1', true, DATE '2026-08-31',
       'Contrato Notario VeraDoc SACS — 2026-08-31', id
FROM public.profiles
WHERE lower(email) = 'notario@notariagrovermorales.com'
  AND role = 'notary'
ON CONFLICT (notary_id, effective_from) DO UPDATE
SET amount_per_certification = NULL,
    participation_bps = 4000,
    formula_version = 'mnd_percentage_v1',
    protect_standard_price_for_promos = true,
    contract_reference = EXCLUDED.contract_reference;

CREATE OR REPLACE FUNCTION public.prepare_notary_monthly_payout_v2(
  p_notary_id uuid,
  p_period_month date,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_month date := date_trunc('month', p_period_month)::date;
  v_end date := (date_trunc('month', p_period_month) + interval '1 month')::date;
  v_payout_id uuid;
  v_missing integer;
  v_count integer;
  v_contractual integer;
  v_top_up integer;
  v_total integer;
BEGIN
  IF v_actor IS NULL OR NOT public.is_finance_authorized('prepare_payout', v_actor) THEN
    RAISE EXCEPTION 'Finance payout preparation authority required';
  END IF;
  IF NOT public.is_active_notary(p_notary_id) THEN RAISE EXCEPTION 'Payout target must be an active notary'; END IF;
  IF v_month >= date_trunc('month', current_date)::date THEN
    RAISE EXCEPTION 'Cannot prepare the current or a future payout month';
  END IF;

  SELECT id INTO v_payout_id
  FROM public.notary_monthly_payouts
  WHERE notary_id = p_notary_id AND period_month = v_month
  FOR UPDATE;

  IF v_payout_id IS NOT NULL THEN
    RETURN jsonb_build_object('payout_id', v_payout_id, 'idempotent', true);
  END IF;

  SELECT count(*) INTO v_missing
  FROM public.notary_certifications c
  WHERE c.notary_id = p_notary_id
    AND c.publication_status = 'published'
    AND COALESCE(c.published_at, c.certified_at) >= v_month
    AND COALESCE(c.published_at, c.certified_at) < v_end
    AND NOT EXISTS (
      SELECT 1
      FROM public.payments p
      JOIN public.payment_commercial_snapshots s ON s.payment_id = p.id
      JOIN public.notary_payout_rates r ON r.notary_id = c.notary_id
        AND r.effective_from <= COALESCE(c.published_at, c.certified_at)::date
        AND (r.effective_to IS NULL OR r.effective_to >= COALESCE(c.published_at, c.certified_at)::date)
      WHERE p.packet_id = c.packet_id
        AND p.paid_at IS NOT NULL
        AND p.processing_fee_centimos IS NOT NULL
    );

  IF v_missing > 0 THEN
    RAISE EXCEPTION '% completed act(s) are missing a commercial snapshot, contracted terms, or reconciled payment fee', v_missing;
  END IF;

  INSERT INTO public.notary_monthly_payouts (
    notary_id, period_month, status, prepared_by, prepared_at,
    confirmed_by, confirmed_at, notes, formula_version
  ) VALUES (
    p_notary_id, v_month, 'prepared', v_actor, now(),
    NULL, NULL, NULLIF(btrim(p_notes), ''), 'mnd_percentage_v1'
  ) RETURNING id INTO v_payout_id;

  INSERT INTO public.notary_payout_items (
    payout_id, certification_id, rate_id, payment_id, packet_id,
    unit_amount, standard_gross_centimos, actual_gross_centimos,
    tax_centimos, processing_fee_centimos, actual_mnd_centimos,
    protected_mnd_centimos, contractual_participation_centimos,
    promo_top_up_centimos, total_before_igv_centimos, formula_version
  )
  SELECT
    v_payout_id, c.id, x.rate_id, x.payment_id, c.packet_id,
    x.total_before_igv / 100.0,
    x.standard_gross, x.actual_gross, x.tax_centimos, x.processing_fee,
    x.actual_mnd, x.protected_mnd, x.contractual_participation,
    x.promo_top_up, x.total_before_igv, x.formula_version
  FROM public.notary_certifications c
  CROSS JOIN LATERAL (
    SELECT
      p.id AS payment_id,
      r.id AS rate_id,
      r.formula_version,
      s.standard_gross_centimos AS standard_gross,
      s.gross_due_centimos AS actual_gross,
      s.tax_centimos,
      p.processing_fee_centimos AS processing_fee,
      greatest(s.value_of_sale_centimos - p.processing_fee_centimos, 0) AS actual_mnd,
      greatest(
        floor((s.standard_gross_centimos * 100.0 + 59) / 118.0)::integer
          - p.processing_fee_centimos,
        0
      ) AS protected_mnd,
      round(
        greatest(s.value_of_sale_centimos - p.processing_fee_centimos, 0)
          * r.participation_bps / 10000.0
      )::integer AS contractual_participation,
      CASE WHEN s.promo_discount_centimos > 0 AND r.protect_standard_price_for_promos
        THEN greatest(
          round(
            greatest(
              floor((s.standard_gross_centimos * 100.0 + 59) / 118.0)::integer
                - p.processing_fee_centimos,
              0
            ) * r.participation_bps / 10000.0
          )::integer
          - round(
              greatest(s.value_of_sale_centimos - p.processing_fee_centimos, 0)
                * r.participation_bps / 10000.0
            )::integer,
          0
        ) ELSE 0 END AS promo_top_up,
      round(
        greatest(s.value_of_sale_centimos - p.processing_fee_centimos, 0)
          * r.participation_bps / 10000.0
      )::integer
      + CASE WHEN s.promo_discount_centimos > 0 AND r.protect_standard_price_for_promos
          THEN greatest(
            round(
              greatest(
                floor((s.standard_gross_centimos * 100.0 + 59) / 118.0)::integer
                  - p.processing_fee_centimos,
                0
              ) * r.participation_bps / 10000.0
            )::integer
            - round(
                greatest(s.value_of_sale_centimos - p.processing_fee_centimos, 0)
                  * r.participation_bps / 10000.0
              )::integer,
            0
          ) ELSE 0 END AS total_before_igv
    FROM public.payments p
    JOIN public.payment_commercial_snapshots s ON s.payment_id = p.id
    JOIN public.notary_payout_rates r ON r.notary_id = c.notary_id
      AND r.effective_from <= COALESCE(c.published_at, c.certified_at)::date
      AND (r.effective_to IS NULL OR r.effective_to >= COALESCE(c.published_at, c.certified_at)::date)
    WHERE p.packet_id = c.packet_id
      AND p.paid_at IS NOT NULL
      AND p.processing_fee_centimos IS NOT NULL
    ORDER BY p.paid_at DESC, r.effective_from DESC
    LIMIT 1
  ) x
  WHERE c.notary_id = p_notary_id
    AND c.publication_status = 'published'
    AND COALESCE(c.published_at, c.certified_at) >= v_month
    AND COALESCE(c.published_at, c.certified_at) < v_end
  ON CONFLICT (certification_id) DO NOTHING;

  SELECT count(*), COALESCE(sum(contractual_participation_centimos), 0),
         COALESCE(sum(promo_top_up_centimos), 0),
         COALESCE(sum(total_before_igv_centimos), 0)
  INTO v_count, v_contractual, v_top_up, v_total
  FROM public.notary_payout_items WHERE payout_id = v_payout_id;

  UPDATE public.notary_monthly_payouts
  SET certification_count = v_count,
      gross_amount = v_total / 100.0,
      contractual_amount_centimos = v_contractual,
      promo_top_up_centimos = v_top_up,
      updated_at = now()
  WHERE id = v_payout_id;

  INSERT INTO public.packet_cost_events (
    packet_id, payment_id, category, provider, amount_centimos,
    cost_status, tax_treatment, source_kind, source_id,
    allocation_method, occurred_at, created_by, approved_by, metadata
  )
  SELECT i.packet_id, i.payment_id, 'notary_participation', 'notary',
         i.contractual_participation_centimos, 'actual', 'notary_invoice_pending',
         'notary_payout_item', i.id::text, 'contract_40_percent_mnd',
         COALESCE(c.published_at, c.certified_at), v_actor, v_actor,
         jsonb_build_object('payout_id', v_payout_id, 'formula_version', i.formula_version)
  FROM public.notary_payout_items i
  JOIN public.notary_certifications c ON c.id = i.certification_id
  WHERE i.payout_id = v_payout_id AND i.contractual_participation_centimos > 0
  ON CONFLICT DO NOTHING;

  INSERT INTO public.packet_cost_events (
    packet_id, payment_id, category, provider, amount_centimos,
    cost_status, tax_treatment, source_kind, source_id,
    allocation_method, occurred_at, created_by, approved_by, metadata
  )
  SELECT i.packet_id, i.payment_id, 'notary_promo_top_up', 'veradoc',
         i.promo_top_up_centimos, 'actual', 'notary_invoice_pending',
         'notary_payout_item', i.id::text, 'veradoc_funded_promo_protection',
         COALESCE(c.published_at, c.certified_at), v_actor, v_actor,
         jsonb_build_object('payout_id', v_payout_id, 'formula_version', i.formula_version)
  FROM public.notary_payout_items i
  JOIN public.notary_certifications c ON c.id = i.certification_id
  WHERE i.payout_id = v_payout_id AND i.promo_top_up_centimos > 0
  ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object(
    'payout_id', v_payout_id, 'status', 'prepared',
    'certification_count', v_count,
    'contractual_amount_centimos', v_contractual,
    'promo_top_up_centimos', v_top_up,
    'total_before_igv_centimos', v_total,
    'idempotent', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.prepare_notary_monthly_payout_v2(uuid, date, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.prepare_notary_monthly_payout_v2(uuid, date, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.approve_notary_monthly_payout(
  p_payout_id uuid,
  p_notary_comprobante_reference text,
  p_notary_igv_centimos integer DEFAULT 0,
  p_notes text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_payout RECORD;
BEGIN
  IF v_actor IS NULL OR NOT public.is_finance_authorized('approve_payout', v_actor) THEN
    RAISE EXCEPTION 'Finance payout approval authority required';
  END IF;
  IF NULLIF(btrim(p_notary_comprobante_reference), '') IS NULL THEN
    RAISE EXCEPTION 'Notary comprobante reference is required';
  END IF;
  IF p_notary_igv_centimos < 0 THEN RAISE EXCEPTION 'Notary IGV cannot be negative'; END IF;

  SELECT * INTO v_payout
  FROM public.notary_monthly_payouts WHERE id = p_payout_id FOR UPDATE;
  IF NOT FOUND OR v_payout.status != 'prepared' THEN RAISE EXCEPTION 'Prepared payout not found'; END IF;
  IF v_payout.prepared_by = v_actor THEN
    RAISE EXCEPTION 'Payout approver must differ from preparer';
  END IF;

  UPDATE public.notary_monthly_payouts
  SET status = 'confirmed', confirmed_by = v_actor, confirmed_at = now(),
      notary_comprobante_reference = btrim(p_notary_comprobante_reference),
      notary_comprobante_received_at = now(),
      notary_igv_centimos = p_notary_igv_centimos,
      notes = COALESCE(NULLIF(btrim(p_notes), ''), notes), updated_at = now()
  WHERE id = p_payout_id;

  IF p_notary_igv_centimos > 0 THEN
    INSERT INTO public.packet_cost_events (
      packet_id, payment_id, category, provider, amount_centimos,
      cost_status, tax_treatment, source_kind, source_id,
      evidence_reference, allocation_method, occurred_at,
      created_by, approved_by, metadata
    )
    SELECT
      i.packet_id, i.payment_id, 'notary_igv', 'notary',
      round(
        p_notary_igv_centimos * i.total_before_igv_centimos::numeric
        / NULLIF(v_payout.contractual_amount_centimos + v_payout.promo_top_up_centimos, 0)
      )::integer,
      'actual', 'input_igv_pending_credit', 'notary_payout_item', i.id::text,
      btrim(p_notary_comprobante_reference), 'proportional_to_notary_participation',
      now(), v_actor, v_actor,
      jsonb_build_object('payout_id', p_payout_id)
    FROM public.notary_payout_items i
    WHERE i.payout_id = p_payout_id
      AND i.total_before_igv_centimos > 0
    ON CONFLICT DO NOTHING;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.approve_notary_monthly_payout(uuid, text, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_notary_monthly_payout(uuid, text, integer, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_notary_payout_paid(
  p_payout_id uuid,
  p_payment_reference text,
  p_notes text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_payout RECORD;
BEGIN
  IF v_actor IS NULL OR NOT public.is_finance_authorized('record_payout', v_actor) THEN
    RAISE EXCEPTION 'Finance payout recording authority required';
  END IF;
  IF NULLIF(btrim(p_payment_reference), '') IS NULL THEN
    RAISE EXCEPTION 'Payment reference is required';
  END IF;

  SELECT * INTO v_payout
  FROM public.notary_monthly_payouts WHERE id = p_payout_id FOR UPDATE;
  IF NOT FOUND OR v_payout.status != 'confirmed' THEN RAISE EXCEPTION 'Confirmed payout not found'; END IF;
  IF v_payout.confirmed_by = v_actor THEN
    RAISE EXCEPTION 'Payment recorder must differ from payout approver';
  END IF;
  IF NULLIF(btrim(v_payout.notary_comprobante_reference), '') IS NULL THEN
    RAISE EXCEPTION 'Notary comprobante evidence is required before payment';
  END IF;

  UPDATE public.notary_monthly_payouts
  SET status = 'paid', paid_by = v_actor, paid_at = now(),
      payment_reference = btrim(p_payment_reference),
      notes = COALESCE(NULLIF(btrim(p_notes), ''), notes), updated_at = now()
  WHERE id = p_payout_id;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_notary_payout_paid(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_notary_payout_paid(uuid, text, text) TO authenticated;

-- -----------------------------------------------------------------------------
-- 10. Manual direct-cost evidence
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.record_packet_direct_cost(
  p_packet_id uuid,
  p_payment_id uuid,
  p_category text,
  p_provider text,
  p_amount_centimos integer,
  p_cost_status text,
  p_evidence_reference text,
  p_allocation_method text,
  p_source_id text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_id uuid;
BEGIN
  IF v_actor IS NULL OR NOT public.is_finance_authorized('record_cost', v_actor) THEN
    RAISE EXCEPTION 'Finance cost authority required';
  END IF;
  IF p_category NOT IN (
    'payment_processing', 'signing', 'messaging_email', 'messaging_whatsapp',
    'cpe', 'storage', 'refund_fee', 'chargeback_fee', 'other_approved_direct_cost'
  ) THEN RAISE EXCEPTION 'Unsupported manual cost category'; END IF;
  IF p_amount_centimos = 0 THEN RAISE EXCEPTION 'Cost amount cannot be zero'; END IF;
  IF p_cost_status NOT IN ('estimated', 'actual', 'reversal') THEN RAISE EXCEPTION 'Invalid cost status'; END IF;
  IF length(btrim(COALESCE(p_evidence_reference, ''))) < 3 THEN RAISE EXCEPTION 'Cost evidence reference required'; END IF;
  IF NULLIF(btrim(p_source_id), '') IS NULL THEN RAISE EXCEPTION 'Cost source id required'; END IF;

  INSERT INTO public.packet_cost_events (
    packet_id, payment_id, category, provider, amount_centimos,
    cost_status, source_kind, source_id, evidence_reference,
    allocation_method, created_by, approved_by
  ) VALUES (
    p_packet_id, p_payment_id, p_category, NULLIF(btrim(p_provider), ''),
    p_amount_centimos, p_cost_status, 'manual', btrim(p_source_id),
    btrim(p_evidence_reference), NULLIF(btrim(p_allocation_method), ''),
    v_actor, v_actor
  ) RETURNING id INTO v_id;

  IF p_category = 'payment_processing' AND p_payment_id IS NOT NULL AND p_cost_status = 'actual' THEN
    UPDATE public.payments
    SET processing_fee_centimos = p_amount_centimos, updated_at = now()
    WHERE id = p_payment_id AND packet_id = p_packet_id;
  END IF;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_packet_direct_cost(uuid, uuid, text, text, integer, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_packet_direct_cost(uuid, uuid, text, text, integer, text, text, text, text) TO authenticated;

-- -----------------------------------------------------------------------------
-- 11. Idempotent service-window reminders and 90-day soft archival
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.schedule_commercial_lifecycle()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reminders integer := 0;
  v_archived integer := 0;
  v_tokens integer := 0;
BEGIN
  WITH candidates AS (
    SELECT lp.id, lp.created_by, lp.service_window_ends_at, reminder.day_number
    FROM public.lease_packets lp
    CROSS JOIN (VALUES (60, interval '30 days'), (75, interval '15 days'), (85, interval '5 days'))
      AS reminder(day_number, before_end)
    WHERE lp.service_window_ends_at IS NOT NULL
      AND lp.archived_at IS NULL
      AND lp.status NOT IN ('certified', 'rejected', 'archived')
      AND (lp.archival_hold_until IS NULL OR lp.archival_hold_until <= now())
      AND now() >= lp.service_window_ends_at - reminder.before_end
      AND now() < lp.service_window_ends_at
  ), inserted AS (
    INSERT INTO public.notification_outbox (
      packet_id, event_type, recipient_key, payload, status, available_at
    )
    SELECT id, 'packet_service_window_reminder_' || day_number,
           'realtor:' || created_by,
           jsonb_build_object(
             'role', 'realtor', 'user_id', created_by,
             'day_number', day_number,
             'service_window_ends_at', service_window_ends_at
           ),
           'pending', now()
    FROM candidates
    ON CONFLICT (packet_id, event_type, recipient_key) DO NOTHING
    RETURNING id
  ) SELECT count(*) INTO v_reminders FROM inserted;

  WITH eligible AS (
    SELECT id, created_by, status AS prior_status
    FROM public.lease_packets
    WHERE service_window_ends_at IS NOT NULL
      AND service_window_ends_at <= now()
      AND archived_at IS NULL
      AND status NOT IN (
        'certified', 'rejected', 'archived',
        'pending_notary', 'under_review', 'awaiting_notary_seal'
      )
      AND (archival_hold_until IS NULL OR archival_hold_until <= now())
    FOR UPDATE SKIP LOCKED
  ), archived AS (
    UPDATE public.lease_packets lp
    SET status = 'archived', archived_at = now(),
        archive_reason = 'abandoned_90_day',
        archive_policy_version = 'commercial_2026_09_v1',
        updated_at = now()
    FROM eligible e
    WHERE lp.id = e.id
    RETURNING lp.id, lp.created_by, e.prior_status
  ), audited AS (
    INSERT INTO public.packet_audit_log (packet_id, actor_id, action, metadata)
    SELECT id, NULL, 'packet_archived',
           jsonb_build_object(
             'reason', 'abandoned_90_day',
             'policy_version', 'commercial_2026_09_v1',
             'prior_status', prior_status
           )
    FROM archived
    RETURNING packet_id
  ), notified AS (
    INSERT INTO public.notification_outbox (
      packet_id, event_type, recipient_key, payload, status, available_at
    )
    SELECT a.id, 'packet_archived_90_day', 'realtor:' || a.created_by,
           jsonb_build_object(
             'role', 'realtor', 'user_id', a.created_by,
             'archive_reason', 'abandoned_90_day'
           ),
           'pending', now()
    FROM archived a
    ON CONFLICT (packet_id, event_type, recipient_key) DO NOTHING
    RETURNING packet_id
  ) SELECT count(*) INTO v_archived FROM archived;

  UPDATE public.signing_tokens st
  SET status = 'expired', expires_at = least(expires_at, now())
  FROM public.lease_packets lp
  WHERE st.packet_id = lp.id
    AND lp.status = 'archived'
    AND lp.archive_reason = 'abandoned_90_day'
    AND st.status IN ('pending', 'otp_verified');
  GET DIAGNOSTICS v_tokens = ROW_COUNT;

  RETURN jsonb_build_object(
    'reminders_enqueued', v_reminders,
    'packets_archived', v_archived,
    'tokens_expired', v_tokens
  );
END;
$$;

REVOKE ALL ON FUNCTION public.schedule_commercial_lifecycle() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.schedule_commercial_lifecycle() TO service_role;

CREATE OR REPLACE FUNCTION public.set_packet_archival_hold(
  p_packet_id uuid,
  p_hold_until timestamptz,
  p_reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
BEGIN
  IF v_actor IS NULL OR NOT public.is_finance_authorized('hold_archival', v_actor) THEN
    RAISE EXCEPTION 'Archival hold authority required';
  END IF;
  IF p_hold_until <= now() OR length(btrim(COALESCE(p_reason, ''))) < 5 THEN
    RAISE EXCEPTION 'A future hold date and reason are required';
  END IF;

  UPDATE public.lease_packets
  SET archival_hold_until = p_hold_until,
      archival_hold_reason = btrim(p_reason),
      archival_hold_approved_by = v_actor,
      updated_at = now()
  WHERE id = p_packet_id AND archived_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Active packet not found'; END IF;

  INSERT INTO public.packet_audit_log (packet_id, actor_id, action, metadata)
  VALUES (
    p_packet_id, v_actor, 'packet_archival_hold_set',
    jsonb_build_object('hold_until', p_hold_until, 'reason', btrim(p_reason))
  );
END;
$$;

REVOKE ALL ON FUNCTION public.set_packet_archival_hold(uuid, timestamptz, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_packet_archival_hold(uuid, timestamptz, text) TO authenticated;

-- -----------------------------------------------------------------------------
-- 12. Operational finance summary (service-role only)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.packet_financial_summary
WITH (security_invoker = true)
AS
SELECT
  s.packet_id,
  s.payment_id,
  s.policy_version,
  s.standard_gross_centimos,
  s.promo_discount_centimos,
  s.gross_due_centimos AS gross_collected_centimos,
  s.tax_centimos AS included_igv_centimos,
  COALESCE(fin.net_amount_centimos, 0) AS adjusted_net_revenue_centimos,
  COALESCE(cost.direct_cost_centimos, 0) AS direct_cost_centimos,
  COALESCE(cost.notary_igv_centimos, 0) AS notary_igv_centimos,
  COALESCE(cost.recorded_categories, '{}'::text[]) AS recorded_cost_categories,
  array_remove(ARRAY[
    CASE WHEN p.payment_provider <> 'demo' AND p.processing_fee_centimos IS NULL
      THEN 'payment_processing' END,
    CASE WHEN EXISTS (
      SELECT 1 FROM public.packet_signers ps
      WHERE ps.packet_id = s.packet_id AND ps.status IN ('signed', 'complete')
    ) AND NOT ('signing' = ANY(COALESCE(cost.recorded_categories, '{}'::text[])))
      THEN 'signing' END,
    CASE WHEN EXISTS (
      SELECT 1 FROM public.notification_outbox no
      WHERE no.packet_id = s.packet_id AND no.status = 'sent'
    ) AND NOT (
      'messaging_email' = ANY(COALESCE(cost.recorded_categories, '{}'::text[]))
      OR 'messaging_whatsapp' = ANY(COALESCE(cost.recorded_categories, '{}'::text[]))
    ) THEN 'messaging' END,
    CASE WHEN EXISTS (
      SELECT 1 FROM public.invoices inv WHERE inv.packet_id = s.packet_id
    ) AND NOT ('cpe' = ANY(COALESCE(cost.recorded_categories, '{}'::text[])))
      THEN 'cpe' END,
    CASE WHEN EXISTS (
      SELECT 1 FROM public.packet_documents pd WHERE pd.packet_id = s.packet_id
    ) AND NOT ('storage' = ANY(COALESCE(cost.recorded_categories, '{}'::text[])))
      THEN 'storage' END,
    CASE WHEN EXISTS (
      SELECT 1 FROM public.notary_certifications nc
      WHERE nc.packet_id = s.packet_id AND nc.publication_status = 'published'
    ) AND NOT ('notary_participation' = ANY(COALESCE(cost.recorded_categories, '{}'::text[])))
      THEN 'notary_participation' END
  ], NULL)::text[] AS missing_cost_categories,
  COALESCE(fin.net_amount_centimos, 0) - COALESCE(cost.direct_cost_centimos, 0)
    AS platform_contribution_margin_centimos,
  p.processing_fee_centimos,
  (p.processing_fee_centimos IS NULL AND p.payment_provider <> 'demo') AS processing_fee_missing,
  p.recognized_at,
  lp.service_window_ends_at,
  lp.archived_at
FROM public.payment_commercial_snapshots s
JOIN public.payments p ON p.id = s.payment_id
JOIN public.lease_packets lp ON lp.id = s.packet_id
LEFT JOIN LATERAL (
  SELECT sum(e.net_amount_centimos)::integer AS net_amount_centimos
  FROM public.commercial_financial_events e
  WHERE e.payment_id = s.payment_id
) fin ON true
LEFT JOIN LATERAL (
  SELECT
    sum(CASE WHEN c.category <> 'notary_igv' THEN c.amount_centimos ELSE 0 END)::integer
      AS direct_cost_centimos,
    sum(CASE WHEN c.category = 'notary_igv' THEN c.amount_centimos ELSE 0 END)::integer
      AS notary_igv_centimos,
    array_agg(DISTINCT c.category) FILTER (WHERE c.category IS NOT NULL)
      AS recorded_categories
  FROM public.packet_cost_events c
  WHERE c.payment_id = s.payment_id
) cost ON true;

REVOKE ALL ON public.packet_financial_summary FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.packet_financial_summary TO service_role;

-- Backfill legacy completed payments conservatively from actual stored amounts.
-- They retain legacy policy labels and do not acquire S/199 history.
INSERT INTO public.payment_commercial_snapshots (
  payment_id, packet_id, pricing_config_id, product_code, policy_version,
  standard_gross_centimos, promo_discount_centimos, gross_due_centimos,
  tax_included, tax_rate_bps, tax_centimos, value_of_sale_centimos,
  service_window_days, included_services, excluded_services, locked_at
)
SELECT
  p.id, p.packet_id, pc.id, pc.product_code, 'legacy_backfill_v1',
  p.amount_centimos, 0, p.amount_centimos, true, 1800,
  p.amount_centimos - floor((p.amount_centimos * 100.0 + 59) / 118.0)::integer,
  floor((p.amount_centimos * 100.0 + 59) / 118.0)::integer,
  90, '[]'::jsonb, '[]'::jsonb, p.paid_at
FROM public.payments p
CROSS JOIN LATERAL (
  SELECT id, product_code
  FROM public.pricing_config
  WHERE product_code = 'lease_packet_standard'
  ORDER BY effective_from ASC
  LIMIT 1
) pc
WHERE p.amount_centimos IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.payment_commercial_snapshots s WHERE s.payment_id = p.id
  );

UPDATE public.payments p
SET pricing_config_id = s.pricing_config_id,
    standard_amount_centimos = s.standard_gross_centimos,
    promo_discount_centimos = s.promo_discount_centimos,
    recognized_at = CASE WHEN p.paid_at IS NOT NULL THEN p.paid_at ELSE p.recognized_at END
FROM public.payment_commercial_snapshots s
WHERE s.payment_id = p.id
  AND (p.pricing_config_id IS NULL OR p.standard_amount_centimos IS NULL OR p.recognized_at IS NULL);

INSERT INTO public.commercial_financial_events (
  packet_id, payment_id, event_type, source_kind, source_id,
  standard_gross_centimos, promo_discount_centimos,
  gross_amount_centimos, tax_amount_centimos, net_amount_centimos,
  currency, occurred_at, metadata
)
SELECT
  p.packet_id, p.id, 'revenue_recognized', 'payment', p.id::text,
  s.standard_gross_centimos, s.promo_discount_centimos,
  s.gross_due_centimos, s.tax_centimos, s.value_of_sale_centimos,
  p.currency, p.paid_at,
  jsonb_build_object('policy_version', s.policy_version, 'backfilled', true)
FROM public.payments p
JOIN public.payment_commercial_snapshots s ON s.payment_id = p.id
WHERE p.paid_at IS NOT NULL
  AND p.status IN ('completed', 'partially_refunded', 'refunded', 'charged_back', 'in_mediation')
ON CONFLICT DO NOTHING;

UPDATE public.lease_packets lp
SET service_window_started_at = COALESCE(lp.service_window_started_at, p.paid_at),
    service_window_ends_at = COALESCE(lp.service_window_ends_at, p.paid_at + interval '90 days')
FROM public.payments p
WHERE p.packet_id = lp.id
  AND p.paid_at IS NOT NULL
  AND lp.service_window_started_at IS NULL;

COMMIT;
