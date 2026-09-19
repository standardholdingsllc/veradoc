-- =============================================================================
-- P-001: owned upload reservations
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'veradoc_packet_rpc_owner') THEN
    CREATE ROLE veradoc_packet_rpc_owner NOLOGIN BYPASSRLS;
  END IF;
END
$$;

-- Supabase's migration role is `postgres`, but it is not a PostgreSQL
-- superuser and cannot transfer function ownership without membership in the
-- target role. Keep the owner non-login while allowing future migrations to
-- maintain these functions.
GRANT veradoc_packet_rpc_owner TO postgres;

-- CREATE is required transiently for PostgreSQL function ownership transfer.
-- It is revoked at the end of this migration before the transaction commits.
GRANT USAGE, CREATE ON SCHEMA public TO veradoc_packet_rpc_owner;
GRANT USAGE ON SCHEMA auth TO veradoc_packet_rpc_owner;
GRANT SELECT ON public.profiles, public.notary_coverage, public.registry_entries TO veradoc_packet_rpc_owner;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lease_packets TO veradoc_packet_rpc_owner;
GRANT SELECT, INSERT ON public.packet_signers, public.packet_documents, public.packet_audit_log TO veradoc_packet_rpc_owner;
GRANT SELECT ON public.payments, public.notary_assignments, public.notary_certifications TO veradoc_packet_rpc_owner;

ALTER TABLE public.lease_packets
  ADD COLUMN IF NOT EXISTS creation_state text NOT NULL DEFAULT 'finalized',
  ADD COLUMN IF NOT EXISTS upload_reservation_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS cleanup_claim_token uuid,
  ADD COLUMN IF NOT EXISTS cleanup_claim_expires_at timestamptz;

ALTER TABLE public.lease_packets
  DROP CONSTRAINT IF EXISTS lease_packets_creation_state_check;

ALTER TABLE public.lease_packets
  ADD CONSTRAINT lease_packets_creation_state_check
  CHECK (creation_state IN ('uploading', 'uploaded', 'cleanup_pending', 'finalized'));

CREATE INDEX IF NOT EXISTS idx_lease_packets_expired_creation
  ON public.lease_packets(upload_reservation_expires_at)
  WHERE creation_state IN ('uploading', 'uploaded');

CREATE INDEX IF NOT EXISTS idx_lease_packets_cleanup_claim
  ON public.lease_packets(cleanup_claim_expires_at)
  WHERE creation_state = 'cleanup_pending';

CREATE OR REPLACE FUNCTION public.reserve_lease_packet_upload(
  p_packet_id uuid,
  p_document_hash text
)
RETURNS TABLE (
  packet_id uuid,
  creation_state text,
  document_hash text,
  upload_reservation_expires_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_packet public.lease_packets%ROWTYPE;
BEGIN
  IF v_actor IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = v_actor AND role = 'realtor' AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;
  IF p_packet_id IS NULL OR p_document_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'invalid_reservation' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_packet
  FROM public.lease_packets
  WHERE id = p_packet_id
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.lease_packets (
      id, created_by, status, creation_state, document_hash,
      upload_reservation_expires_at
    ) VALUES (
      p_packet_id, v_actor, 'draft', 'uploading', p_document_hash,
      now() + interval '24 hours'
    )
    RETURNING * INTO v_packet;
  ELSE
    IF v_packet.created_by <> v_actor
       OR v_packet.document_hash IS DISTINCT FROM p_document_hash
       OR v_packet.creation_state IN ('cleanup_pending', 'finalized') THEN
      RAISE EXCEPTION 'reservation_conflict' USING ERRCODE = 'P0001';
    END IF;

    UPDATE public.lease_packets
    SET upload_reservation_expires_at = now() + interval '24 hours',
        updated_at = now()
    WHERE id = p_packet_id
    RETURNING * INTO v_packet;
  END IF;

  RETURN QUERY SELECT
    v_packet.id,
    v_packet.creation_state,
    v_packet.document_hash,
    v_packet.upload_reservation_expires_at;
END;
$$;

ALTER FUNCTION public.reserve_lease_packet_upload(uuid, text) OWNER TO veradoc_packet_rpc_owner;
REVOKE ALL ON FUNCTION public.reserve_lease_packet_upload(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reserve_lease_packet_upload(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_lease_packet_uploaded(
  p_packet_id uuid,
  p_actor_id uuid,
  p_document_hash text
)
RETURNS TABLE (packet_id uuid, creation_state text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_packet public.lease_packets%ROWTYPE;
BEGIN
  IF p_actor_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_actor_id AND role = 'realtor' AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_packet
  FROM public.lease_packets
  WHERE id = p_packet_id
  FOR UPDATE;

  IF NOT FOUND OR v_packet.created_by <> p_actor_id THEN
    RAISE EXCEPTION 'reservation_conflict' USING ERRCODE = 'P0001';
  END IF;
  IF v_packet.document_hash IS DISTINCT FROM p_document_hash
     OR v_packet.creation_state NOT IN ('uploading', 'uploaded')
     OR v_packet.upload_reservation_expires_at <= now() THEN
    RAISE EXCEPTION 'reservation_conflict' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.lease_packets
  SET creation_state = 'uploaded', updated_at = now()
  WHERE id = p_packet_id;

  RETURN QUERY SELECT p_packet_id, 'uploaded'::text;
END;
$$;

ALTER FUNCTION public.mark_lease_packet_uploaded(uuid, uuid, text) OWNER TO veradoc_packet_rpc_owner;
REVOKE ALL ON FUNCTION public.mark_lease_packet_uploaded(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_lease_packet_uploaded(uuid, uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.finalize_lease_packet(
  p_packet_id uuid,
  p_property_address text,
  p_property_unit text,
  p_district text,
  p_province text,
  p_department text,
  p_rental_amount numeric,
  p_deposit_amount numeric,
  p_lease_start date,
  p_lease_end date,
  p_signers jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_packet public.lease_packets%ROWTYPE;
  v_signer jsonb;
  v_path text := 'packets/' || p_packet_id::text || '/lease_original.pdf';
BEGIN
  IF v_actor IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = v_actor AND role = 'realtor' AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;
  IF NULLIF(btrim(p_property_address), '') IS NULL
     OR NULLIF(btrim(p_district), '') IS NULL
     OR NULLIF(btrim(p_province), '') IS NULL
     OR NULLIF(btrim(p_department), '') IS NULL
     OR p_rental_amount <= 0 OR p_deposit_amount < 0
     OR p_lease_start IS NULL OR p_lease_end IS NULL OR p_lease_end <= p_lease_start
     OR jsonb_typeof(p_signers) <> 'array' OR jsonb_array_length(p_signers) = 0 THEN
    RAISE EXCEPTION 'invalid_packet' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_packet
  FROM public.lease_packets
  WHERE id = p_packet_id
  FOR UPDATE;

  IF NOT FOUND OR v_packet.created_by <> v_actor THEN
    RAISE EXCEPTION 'packet_not_found' USING ERRCODE = 'P0001';
  END IF;
  IF v_packet.creation_state = 'finalized' THEN
    RETURN jsonb_build_object('packet_id', p_packet_id, 'idempotent', true);
  END IF;
  IF v_packet.creation_state <> 'uploaded'
     OR v_packet.upload_reservation_expires_at <= now() THEN
    RAISE EXCEPTION 'packet_not_ready' USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (SELECT 1 FROM public.packet_documents WHERE packet_id = p_packet_id)
     OR EXISTS (SELECT 1 FROM public.packet_signers WHERE packet_id = p_packet_id)
     OR EXISTS (SELECT 1 FROM public.payments WHERE packet_id = p_packet_id)
     OR EXISTS (SELECT 1 FROM public.notary_assignments WHERE packet_id = p_packet_id)
     OR EXISTS (SELECT 1 FROM public.notary_certifications WHERE packet_id = p_packet_id)
     OR EXISTS (SELECT 1 FROM public.registry_entries WHERE packet_id = p_packet_id)
     OR EXISTS (SELECT 1 FROM public.packet_audit_log WHERE packet_id = p_packet_id) THEN
    RAISE EXCEPTION 'packet_not_ready' USING ERRCODE = 'P0001';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.notary_coverage
    WHERE active = true AND lower(btrim(province)) = lower(btrim(p_province))
  ) THEN
    RAISE EXCEPTION 'coverage_unavailable' USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.registry_entries
    WHERE property_address = p_property_address
      AND (property_unit = NULLIF(p_property_unit, '') OR (property_unit IS NULL AND NULLIF(p_property_unit, '') IS NULL))
      AND status = 'active'
      AND lease_start_date < p_lease_end
      AND lease_end_date > p_lease_start
  ) THEN
    RAISE EXCEPTION 'duplicate_lease' USING ERRCODE = 'P0001';
  END IF;

  FOR v_signer IN SELECT value FROM jsonb_array_elements(p_signers)
  LOOP
    IF v_signer->>'role_in_lease' NOT IN ('landlord', 'renter')
       OR NULLIF(btrim(v_signer->>'signer_email'), '') IS NULL
       OR NULLIF(btrim(v_signer->>'signer_full_name'), '') IS NULL
       OR (v_signer->>'signer_dni') !~ '^\d{8}$'
       OR (v_signer->>'signer_whatsapp') !~ '^\+51\d{9}$' THEN
      RAISE EXCEPTION 'invalid_signer' USING ERRCODE = '22023';
    END IF;
  END LOOP;

  UPDATE public.lease_packets
  SET property_address = p_property_address,
      property_unit = NULLIF(p_property_unit, ''),
      district = p_district,
      province = p_province,
      department = p_department,
      rental_amount = p_rental_amount,
      deposit_amount = p_deposit_amount,
      lease_start_date = p_lease_start,
      lease_end_date = p_lease_end,
      creation_state = 'finalized',
      upload_reservation_expires_at = NULL,
      cleanup_claim_token = NULL,
      cleanup_claim_expires_at = NULL,
      updated_at = now()
  WHERE id = p_packet_id;

  INSERT INTO public.packet_signers (
    packet_id, role_in_lease, signer_email, signer_full_name, signer_dni,
    signer_whatsapp, status
  )
  SELECT
    p_packet_id,
    value->>'role_in_lease',
    value->>'signer_email',
    value->>'signer_full_name',
    value->>'signer_dni',
    value->>'signer_whatsapp',
    'invited'
  FROM jsonb_array_elements(p_signers);

  INSERT INTO public.packet_documents (
    packet_id, document_type, storage_path, file_hash, uploaded_by
  ) VALUES (
    p_packet_id, 'lease_original', v_path, v_packet.document_hash, v_actor
  );

  INSERT INTO public.packet_audit_log (packet_id, actor_id, action, metadata)
  VALUES
    (p_packet_id, v_actor, 'packet_created', jsonb_build_object(
      'property_address', p_property_address
    )),
    (p_packet_id, v_actor, 'document_hash_recorded', jsonb_build_object(
      'stage', 'initial_upload',
      'algorithm', 'SHA-256',
      'hash', v_packet.document_hash,
      'storage_path', v_path,
      'document_type', 'lease_original'
    ));

  RETURN jsonb_build_object('packet_id', p_packet_id, 'idempotent', false);
END;
$$;

ALTER FUNCTION public.finalize_lease_packet(uuid, text, text, text, text, text, numeric, numeric, date, date, jsonb) OWNER TO veradoc_packet_rpc_owner;
REVOKE ALL ON FUNCTION public.finalize_lease_packet(uuid, text, text, text, text, text, numeric, numeric, date, date, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finalize_lease_packet(uuid, text, text, text, text, text, numeric, numeric, date, date, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.claim_lease_upload_cleanup(
  p_limit integer DEFAULT 20
)
RETURNS TABLE (packet_id uuid, storage_path text, claim_token uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_limit < 1 OR p_limit > 100 THEN
    RAISE EXCEPTION 'invalid_limit' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  WITH candidates AS (
    SELECT lp.id
    FROM public.lease_packets lp
    WHERE (
      (lp.creation_state IN ('uploading', 'uploaded') AND lp.upload_reservation_expires_at <= now())
      OR (lp.creation_state = 'cleanup_pending' AND lp.cleanup_claim_expires_at <= now())
    )
      AND NOT EXISTS (SELECT 1 FROM public.packet_documents d WHERE d.packet_id = lp.id)
      AND NOT EXISTS (SELECT 1 FROM public.packet_signers s WHERE s.packet_id = lp.id)
      AND NOT EXISTS (SELECT 1 FROM public.payments p WHERE p.packet_id = lp.id)
      AND NOT EXISTS (SELECT 1 FROM public.notary_assignments a WHERE a.packet_id = lp.id)
      AND NOT EXISTS (SELECT 1 FROM public.notary_certifications c WHERE c.packet_id = lp.id)
      AND NOT EXISTS (SELECT 1 FROM public.registry_entries r WHERE r.packet_id = lp.id)
      AND NOT EXISTS (SELECT 1 FROM public.packet_audit_log l WHERE l.packet_id = lp.id)
    ORDER BY COALESCE(lp.upload_reservation_expires_at, lp.cleanup_claim_expires_at)
    FOR UPDATE SKIP LOCKED
    LIMIT p_limit
  ), claimed AS (
    UPDATE public.lease_packets lp
    SET creation_state = 'cleanup_pending',
        cleanup_claim_token = gen_random_uuid(),
        cleanup_claim_expires_at = now() + interval '10 minutes',
        updated_at = now()
    FROM candidates c
    WHERE lp.id = c.id
    RETURNING lp.id, lp.cleanup_claim_token
  )
  SELECT
    claimed.id,
    'packets/' || claimed.id::text || '/lease_original.pdf',
    claimed.cleanup_claim_token
  FROM claimed;
END;
$$;

ALTER FUNCTION public.claim_lease_upload_cleanup(integer) OWNER TO veradoc_packet_rpc_owner;
REVOKE ALL ON FUNCTION public.claim_lease_upload_cleanup(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_lease_upload_cleanup(integer) TO service_role;

CREATE OR REPLACE FUNCTION public.complete_lease_upload_cleanup(
  p_packet_id uuid,
  p_claim_token uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_packet public.lease_packets%ROWTYPE;
BEGIN
  SELECT * INTO v_packet
  FROM public.lease_packets
  WHERE id = p_packet_id
  FOR UPDATE;

  IF NOT FOUND
     OR v_packet.creation_state <> 'cleanup_pending'
     OR v_packet.cleanup_claim_token IS DISTINCT FROM p_claim_token
     OR v_packet.cleanup_claim_expires_at <= now() THEN
    RETURN false;
  END IF;

  IF EXISTS (SELECT 1 FROM public.packet_documents WHERE packet_id = p_packet_id)
     OR EXISTS (SELECT 1 FROM public.packet_signers WHERE packet_id = p_packet_id)
     OR EXISTS (SELECT 1 FROM public.payments WHERE packet_id = p_packet_id)
     OR EXISTS (SELECT 1 FROM public.notary_assignments WHERE packet_id = p_packet_id)
     OR EXISTS (SELECT 1 FROM public.notary_certifications WHERE packet_id = p_packet_id)
     OR EXISTS (SELECT 1 FROM public.registry_entries WHERE packet_id = p_packet_id)
     OR EXISTS (SELECT 1 FROM public.packet_audit_log WHERE packet_id = p_packet_id) THEN
    RETURN false;
  END IF;

  DELETE FROM public.lease_packets WHERE id = p_packet_id;
  RETURN true;
END;
$$;

ALTER FUNCTION public.complete_lease_upload_cleanup(uuid, uuid) OWNER TO veradoc_packet_rpc_owner;
REVOKE ALL ON FUNCTION public.complete_lease_upload_cleanup(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_lease_upload_cleanup(uuid, uuid) TO service_role;

-- Direct authenticated grants are intentionally retained in this compatibility
-- migration. They are revoked only after the reservation-first application has
-- been deployed; see the separately applied hardening migration.

REVOKE CREATE ON SCHEMA public FROM veradoc_packet_rpc_owner;
