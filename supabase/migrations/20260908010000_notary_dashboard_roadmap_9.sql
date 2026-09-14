-- =============================================================================
-- Roadmap 9: auditable notary review, durable decisions, queue priority,
-- SUNARP/property-authority evidence, and contracted monthly payouts.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Queue and correction context
-- -----------------------------------------------------------------------------

ALTER TABLE public.notary_assignments
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS priority_reason text,
  ADD COLUMN IF NOT EXISTS prioritized_by uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS prioritized_at timestamptz,
  ADD COLUMN IF NOT EXISTS correction_scope text,
  ADD COLUMN IF NOT EXISTS decision_version integer NOT NULL DEFAULT 0;

ALTER TABLE public.notary_assignments
  DROP CONSTRAINT IF EXISTS notary_assignments_priority_check;
ALTER TABLE public.notary_assignments
  ADD CONSTRAINT notary_assignments_priority_check
  CHECK (priority IN ('urgent', 'high', 'normal', 'low'));

ALTER TABLE public.notary_assignments
  DROP CONSTRAINT IF EXISTS notary_assignments_correction_scope_check;
ALTER TABLE public.notary_assignments
  ADD CONSTRAINT notary_assignments_correction_scope_check
  CHECK (
    correction_scope IS NULL OR correction_scope IN (
      'identity_recheck', 'contract_revision', 'document_metadata',
      'notary_observation'
    )
  );

CREATE INDEX IF NOT EXISTS idx_notary_assignments_priority_queue
  ON public.notary_assignments(notary_id, priority, assigned_at)
  WHERE decision IS NULL;

-- -----------------------------------------------------------------------------
-- 2. Structured property-authority / SUNARP review evidence
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.property_authority_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  packet_id uuid NOT NULL REFERENCES public.lease_packets(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'SUNARP',
  title_number text NOT NULL,
  registry_zone text,
  registry_office text,
  query_reference text,
  verification_status text NOT NULL
    CHECK (verification_status IN ('verified', 'observation', 'not_found')),
  owner_names text[] NOT NULL DEFAULT '{}',
  checked_at timestamptz NOT NULL,
  checked_by uuid NOT NULL REFERENCES public.profiles(id),
  source_url text CHECK (source_url IS NULL OR source_url ~ '^https://'),
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_property_authority_checks_packet
  ON public.property_authority_checks(packet_id, checked_at DESC);

ALTER TABLE public.property_authority_checks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Assigned notary reads property authority checks"
  ON public.property_authority_checks;
CREATE POLICY "Assigned notary reads property authority checks"
  ON public.property_authority_checks FOR SELECT TO authenticated
  USING (packet_id IN (SELECT public.packets_as_notary()));

DROP POLICY IF EXISTS "Assigned notary records property authority checks"
  ON public.property_authority_checks;
CREATE POLICY "Assigned notary records property authority checks"
  ON public.property_authority_checks FOR INSERT TO authenticated
  WITH CHECK (
    checked_by = auth.uid()
    AND packet_id IN (SELECT public.packets_as_notary())
  );

DROP POLICY IF EXISTS "Admin reads property authority checks"
  ON public.property_authority_checks;
CREATE POLICY "Admin reads property authority checks"
  ON public.property_authority_checks FOR SELECT TO authenticated
  USING (public.is_active_admin());

GRANT SELECT, INSERT ON public.property_authority_checks TO authenticated;
GRANT ALL ON public.property_authority_checks TO service_role;

-- -----------------------------------------------------------------------------
-- 3. Durable notary workflow jobs
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.notary_workflow_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  packet_id uuid NOT NULL REFERENCES public.lease_packets(id) ON DELETE CASCADE,
  certification_id uuid REFERENCES public.notary_certifications(id) ON DELETE CASCADE,
  job_type text NOT NULL CHECK (job_type IN (
    'generate_legacy_certificate',
    'create_registry_entry',
    'prepare_physical_certificate',
    'finalize_physical_certification'
  )),
  idempotency_key text NOT NULL UNIQUE,
  payload jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  attempt_count integer NOT NULL DEFAULT 0,
  available_at timestamptz NOT NULL DEFAULT now(),
  processing_started_at timestamptz,
  claim_token uuid,
  last_error text,
  result jsonb NOT NULL DEFAULT '{}',
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notary_workflow_jobs_claim
  ON public.notary_workflow_jobs(status, available_at)
  WHERE status IN ('pending', 'processing', 'failed');

ALTER TABLE public.notary_workflow_jobs ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.notary_workflow_jobs TO service_role;

CREATE OR REPLACE FUNCTION public.claim_notary_workflow_jobs(
  p_limit integer DEFAULT 5
)
RETURNS TABLE(
  id uuid,
  packet_id uuid,
  certification_id uuid,
  job_type text,
  payload jsonb,
  attempt_count integer,
  claim_token uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token uuid := gen_random_uuid();
  v_stale_threshold timestamptz := now() - interval '10 minutes';
BEGIN
  RETURN QUERY
  WITH claimable AS (
    SELECT j.id
    FROM public.notary_workflow_jobs j
    WHERE (
      (j.status = 'pending' AND j.available_at <= now())
      OR (j.status = 'failed' AND j.available_at <= now() AND j.attempt_count < 5)
      OR (
        j.status = 'processing'
        AND j.processing_started_at < v_stale_threshold
        AND j.attempt_count < 5
      )
    )
    ORDER BY j.available_at, j.created_at
    LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 5), 25))
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.notary_workflow_jobs AS j
  SET status = 'processing',
      processing_started_at = now(),
      claim_token = v_token,
      attempt_count = j.attempt_count + 1,
      updated_at = now()
  FROM claimable
  WHERE j.id = claimable.id
  RETURNING j.id, j.packet_id, j.certification_id, j.job_type,
            j.payload, j.attempt_count, v_token;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_notary_workflow_jobs(integer) FROM public;
GRANT EXECUTE ON FUNCTION public.claim_notary_workflow_jobs(integer) TO service_role;

-- -----------------------------------------------------------------------------
-- 4. Authenticated, auditable checklist and queue RPCs
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.update_notary_checklist_item(
  p_packet_id uuid,
  p_item_key text,
  p_checked boolean,
  p_context jsonb DEFAULT '{}'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_allowed_keys constant text[] := ARRAY[
    'revisarDocumento', 'revisarPdfFirmado', 'revisarIdentidad',
    'revisarWhatsapp', 'revisarConsentimiento', 'revisarFirmaIofe',
    'revisarCadena', 'revisarTimestamp', 'revisarHashes',
    'revisarPropiedad', 'revisarRegistro', 'revisarSesion',
    'determinacion'
  ];
  v_previous boolean := false;
  v_data jsonb;
BEGIN
  IF v_actor IS NULL OR NOT public.is_active_notary(v_actor) THEN
    RAISE EXCEPTION 'Only an active notary may update the checklist';
  END IF;

  IF p_checked IS NULL THEN
    RAISE EXCEPTION 'Checklist state is required';
  END IF;
  IF p_item_key IS NULL OR NOT (p_item_key = ANY(v_allowed_keys)) THEN
    RAISE EXCEPTION 'Unsupported checklist item: %', p_item_key;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.notary_assignments a
    JOIN public.lease_packets lp ON lp.id = a.packet_id
    WHERE a.packet_id = p_packet_id
      AND a.notary_id = v_actor
      AND a.decision IS NULL
      AND lp.status IN ('under_review', 'awaiting_notary_seal')
  ) THEN
    RAISE EXCEPTION 'Packet is not actively reviewable by this notary: %', p_packet_id;
  END IF;

  SELECT COALESCE((checklist_data -> p_item_key ->> 'checked')::boolean, false)
    INTO v_previous
  FROM public.notary_review_checklists
  WHERE packet_id = p_packet_id;

  INSERT INTO public.notary_review_checklists (
    packet_id, notary_id, checklist_data, checklist_version, updated_at
  ) VALUES (
    p_packet_id,
    v_actor,
    jsonb_build_object(
      p_item_key,
      CASE WHEN p_checked
        THEN jsonb_build_object('checked', true, 'checkedAt', now())
        ELSE jsonb_build_object('checked', false)
      END
    ),
    1,
    now()
  )
  ON CONFLICT (packet_id) DO UPDATE
  SET notary_id = v_actor,
      checklist_data = CASE
        WHEN public.notary_review_checklists.notary_id = v_actor
          THEN jsonb_set(
            public.notary_review_checklists.checklist_data,
            ARRAY[p_item_key],
            CASE WHEN p_checked
              THEN jsonb_build_object('checked', true, 'checkedAt', now())
              ELSE jsonb_build_object('checked', false)
            END,
            true
          )
        ELSE jsonb_build_object(
          p_item_key,
          CASE WHEN p_checked
            THEN jsonb_build_object('checked', true, 'checkedAt', now())
            ELSE jsonb_build_object('checked', false)
          END
        )
      END,
      checklist_version = 1,
      updated_at = now()
  RETURNING checklist_data INTO v_data;

  INSERT INTO public.packet_audit_log (packet_id, actor_id, action, metadata)
  VALUES (
    p_packet_id,
    v_actor,
    CASE WHEN p_checked
      THEN 'checklist_item_checked'
      ELSE 'checklist_item_unchecked'
    END,
    jsonb_build_object(
      'item_key', p_item_key,
      'checked', p_checked,
      'previous_checked', v_previous,
      'checklist_version', 1,
      'context', COALESCE(p_context, '{}')
    )
  );

  RETURN v_data;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_notary_checklist_item(uuid, text, boolean, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.update_notary_checklist_item(uuid, text, boolean, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_notary_assignment_priority(
  p_packet_id uuid,
  p_priority text,
  p_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_previous text;
BEGIN
  IF v_actor IS NULL OR NOT public.is_active_notary(v_actor) THEN
    RAISE EXCEPTION 'Only an active notary may prioritize assigned work';
  END IF;
  IF p_priority IS NULL OR p_priority NOT IN ('urgent', 'high', 'normal', 'low') THEN
    RAISE EXCEPTION 'Invalid priority: %', p_priority;
  END IF;

  SELECT priority INTO v_previous
  FROM public.notary_assignments
  WHERE packet_id = p_packet_id AND notary_id = v_actor AND decision IS NULL
  FOR UPDATE;

  IF v_previous IS NULL THEN
    RAISE EXCEPTION 'Notary is not assigned to packet %', p_packet_id;
  END IF;

  UPDATE public.notary_assignments
  SET priority = p_priority,
      priority_reason = NULLIF(btrim(p_reason), ''),
      prioritized_by = v_actor,
      prioritized_at = now()
  WHERE packet_id = p_packet_id AND notary_id = v_actor;

  INSERT INTO public.packet_audit_log (packet_id, actor_id, action, metadata)
  VALUES (
    p_packet_id,
    v_actor,
    'notary_queue_priority_changed',
    jsonb_build_object(
      'previous_priority', v_previous,
      'priority', p_priority,
      'reason', NULLIF(btrim(p_reason), '')
    )
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_notary_assignment_priority(uuid, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.set_notary_assignment_priority(uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.record_property_authority_check(
  p_packet_id uuid,
  p_title_number text,
  p_verification_status text,
  p_checked_at timestamptz,
  p_registry_zone text DEFAULT NULL,
  p_registry_office text DEFAULT NULL,
  p_query_reference text DEFAULT NULL,
  p_owner_names text[] DEFAULT '{}',
  p_source_url text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'
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
  IF v_actor IS NULL OR NOT public.is_active_notary(v_actor) THEN
    RAISE EXCEPTION 'Only an active notary may record property-authority evidence';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.notary_assignments
    WHERE packet_id = p_packet_id AND notary_id = v_actor
  ) THEN
    RAISE EXCEPTION 'Notary is not assigned to packet %', p_packet_id;
  END IF;
  IF NULLIF(btrim(p_title_number), '') IS NULL THEN
    RAISE EXCEPTION 'SUNARP title number is required';
  END IF;
  IF p_verification_status IS NULL
     OR p_verification_status NOT IN ('verified', 'observation', 'not_found') THEN
    RAISE EXCEPTION 'Invalid property-authority status: %', p_verification_status;
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.notary_assignments a
    JOIN public.lease_packets lp ON lp.id = a.packet_id
    WHERE a.packet_id = p_packet_id
      AND a.notary_id = v_actor
      AND a.decision IS NULL
      AND lp.status IN ('under_review', 'awaiting_notary_seal')
  ) THEN
    RAISE EXCEPTION 'Packet is not actively reviewable by this notary: %', p_packet_id;
  END IF;
  IF NULLIF(btrim(p_source_url), '') IS NOT NULL
     AND btrim(p_source_url) !~ '^https://' THEN
    RAISE EXCEPTION 'Property-authority source URL must use HTTPS';
  END IF;

  INSERT INTO public.property_authority_checks (
    packet_id, provider, title_number, registry_zone, registry_office,
    query_reference, verification_status, owner_names, checked_at,
    checked_by, source_url, notes, metadata
  ) VALUES (
    p_packet_id, 'SUNARP', btrim(p_title_number), NULLIF(btrim(p_registry_zone), ''),
    NULLIF(btrim(p_registry_office), ''), NULLIF(btrim(p_query_reference), ''),
    p_verification_status, COALESCE(p_owner_names, '{}'), p_checked_at,
    v_actor, NULLIF(btrim(p_source_url), ''), NULLIF(btrim(p_notes), ''),
    COALESCE(p_metadata, '{}')
  )
  RETURNING id INTO v_id;

  INSERT INTO public.packet_audit_log (packet_id, actor_id, action, metadata)
  VALUES (
    p_packet_id,
    v_actor,
    'property_authority_checked',
    jsonb_build_object(
      'check_id', v_id,
      'provider', 'SUNARP',
      'title_number', btrim(p_title_number),
      'verification_status', p_verification_status,
      'checked_at', p_checked_at,
      'query_reference', NULLIF(btrim(p_query_reference), '')
    )
  );

  RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_property_authority_check(
  uuid, text, text, timestamptz, text, text, text, text[], text, text, jsonb
) FROM public;
GRANT EXECUTE ON FUNCTION public.record_property_authority_check(
  uuid, text, text, timestamptz, text, text, text, text[], text, text, jsonb
) TO authenticated;

-- The two-argument form binds the actor to auth.uid(). The old actor-parameter
-- form stays service-role-only for existing background workflows.
CREATE OR REPLACE FUNCTION public.start_notary_review(
  p_packet_id uuid,
  p_workflow_version text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_status text;
  v_enabled boolean;
BEGIN
  IF v_actor IS NULL OR NOT public.is_active_notary(v_actor) THEN
    RAISE EXCEPTION 'Only an active notary may start a review';
  END IF;

  SELECT status INTO v_status
  FROM public.lease_packets WHERE id = p_packet_id FOR UPDATE;
  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Packet not found: %', p_packet_id;
  END IF;
  IF v_status != 'pending_notary' THEN
    RAISE EXCEPTION 'Packet must be pending_notary, got: %', v_status;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.notary_assignments
    WHERE packet_id = p_packet_id AND notary_id = v_actor
  ) THEN
    RAISE EXCEPTION 'Notary is not assigned to packet %', p_packet_id;
  END IF;
  IF p_workflow_version IS NULL
     OR p_workflow_version NOT IN ('legacy_v1', 'physical_seal_v1') THEN
    RAISE EXCEPTION 'Invalid workflow version: %', p_workflow_version;
  END IF;
  IF p_workflow_version = 'physical_seal_v1' THEN
    SELECT physical_seal_v1_enabled INTO v_enabled
    FROM public.notary_workflow_settings WHERE notary_id = v_actor;
    IF NOT COALESCE(v_enabled, false) THEN
      RAISE EXCEPTION 'Physical seal workflow is not enabled for this notary';
    END IF;
  END IF;

  UPDATE public.lease_packets
  SET status = 'under_review', notary_workflow_version = p_workflow_version
  WHERE id = p_packet_id;

  UPDATE public.notary_assignments
  SET review_started_at = now(), decision = NULL, decided_at = NULL,
      observations = NULL, correction_scope = NULL
  WHERE packet_id = p_packet_id AND notary_id = v_actor;

  INSERT INTO public.packet_audit_log (packet_id, actor_id, action, metadata)
  VALUES (
    p_packet_id,
    v_actor,
    'notary_started_review',
    jsonb_build_object('workflow_version', p_workflow_version, 'previous_status', v_status)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.start_notary_review(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.start_notary_review(uuid, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.start_notary_review(uuid, uuid, text) FROM authenticated;

-- -----------------------------------------------------------------------------
-- 5. One authoritative legacy decision RPC
-- -----------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.complete_notary_decision(uuid, uuid, text, text, jsonb);

CREATE OR REPLACE FUNCTION public.submit_notary_decision(
  p_packet_id uuid,
  p_decision text,
  p_observations text DEFAULT NULL,
  p_correction_scope text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_packet record;
  v_assignment record;
  v_checklist jsonb;
  v_checklist_version integer;
  v_certification_id uuid;
  v_next_version integer;
BEGIN
  IF v_actor IS NULL OR NOT public.is_active_notary(v_actor) THEN
    RAISE EXCEPTION 'Only an active notary may submit a decision';
  END IF;
  IF p_decision IS NULL OR p_decision NOT IN (
    'certified', 'certified_with_observations', 'needs_correction', 'rejected'
  ) THEN
    RAISE EXCEPTION 'Invalid decision: %', p_decision;
  END IF;

  SELECT id, status, notary_workflow_version INTO v_packet
  FROM public.lease_packets WHERE id = p_packet_id FOR UPDATE;
  IF v_packet IS NULL THEN
    RAISE EXCEPTION 'Packet not found: %', p_packet_id;
  END IF;

  SELECT * INTO v_assignment
  FROM public.notary_assignments
  WHERE packet_id = p_packet_id AND notary_id = v_actor
  FOR UPDATE;
  IF v_assignment IS NULL THEN
    RAISE EXCEPTION 'Notary is not assigned to packet %', p_packet_id;
  END IF;
  IF v_assignment.decision IS NOT NULL THEN
    RAISE EXCEPTION 'A notary decision has already been submitted for packet %', p_packet_id;
  END IF;

  v_next_version := COALESCE(v_assignment.decision_version, 0) + 1;

  IF p_decision IN ('certified', 'certified_with_observations') THEN
    IF v_packet.status != 'under_review' THEN
      RAISE EXCEPTION 'Packet must be under_review to certify, got: %', v_packet.status;
    END IF;
    IF COALESCE(v_packet.notary_workflow_version, 'legacy_v1') != 'legacy_v1' THEN
      RAISE EXCEPTION 'Physical-seal certification uses its dedicated publication workflow';
    END IF;
    IF p_decision = 'certified_with_observations'
       AND NULLIF(btrim(p_observations), '') IS NULL THEN
      RAISE EXCEPTION 'Observations are required';
    END IF;

    SELECT checklist_data, checklist_version
      INTO v_checklist, v_checklist_version
    FROM public.notary_review_checklists
    WHERE packet_id = p_packet_id AND notary_id = v_actor;
    IF v_checklist IS NULL THEN
      RAISE EXCEPTION 'No checklist found for packet %', p_packet_id;
    END IF;
    PERFORM public.validate_notary_checklist(v_checklist, COALESCE(v_checklist_version, 1));

    SELECT id INTO v_certification_id
    FROM public.notary_certifications
    WHERE packet_id = p_packet_id
      AND notary_id = v_actor
      AND publication_status IN ('prepared', 'published')
    ORDER BY prepared_at DESC NULLS LAST, certified_at DESC
    LIMIT 1;

    IF v_certification_id IS NULL THEN
      INSERT INTO public.notary_certifications (
        packet_id, notary_id, certification_type, observations,
        checklist_data, checklist_version, publication_status, prepared_at
      ) VALUES (
        p_packet_id, v_actor, p_decision, NULLIF(btrim(p_observations), ''),
        v_checklist, COALESCE(v_checklist_version, 1), 'prepared', now()
      )
      RETURNING id INTO v_certification_id;
    END IF;

    UPDATE public.notary_assignments
    SET decision = p_decision,
        decided_at = now(),
        observations = NULLIF(btrim(p_observations), ''),
        correction_scope = NULL,
        decision_version = v_next_version
    WHERE id = v_assignment.id;

    INSERT INTO public.notary_workflow_jobs (
      packet_id, certification_id, job_type, idempotency_key, payload
    ) VALUES (
      p_packet_id,
      v_certification_id,
      'generate_legacy_certificate',
      'legacy-certificate:' || v_certification_id,
      jsonb_build_object('notary_id', v_actor, 'decision_version', v_next_version)
    )
    ON CONFLICT (idempotency_key) DO NOTHING;
  ELSE
    IF v_packet.status NOT IN ('under_review', 'awaiting_notary_seal') THEN
      RAISE EXCEPTION 'Packet is not in an actionable notary state: %', v_packet.status;
    END IF;
    IF NULLIF(btrim(p_observations), '') IS NULL THEN
      RAISE EXCEPTION 'A detailed reason is required';
    END IF;
    IF p_decision = 'needs_correction' AND (
      p_correction_scope IS NULL OR p_correction_scope NOT IN (
        'identity_recheck', 'contract_revision', 'document_metadata',
        'notary_observation'
      )
    ) THEN
      RAISE EXCEPTION 'A valid correction scope is required';
    END IF;

    UPDATE public.lease_packets
    SET status = CASE p_decision
      WHEN 'needs_correction' THEN 'needs_correction'
      ELSE 'rejected'
    END
    WHERE id = p_packet_id;

    UPDATE public.notary_assignments
    SET decision = p_decision,
        decided_at = now(),
        observations = btrim(p_observations),
        correction_scope = CASE WHEN p_decision = 'needs_correction'
          THEN p_correction_scope ELSE NULL END,
        decision_version = v_next_version
    WHERE id = v_assignment.id;

    INSERT INTO public.notification_outbox (
      packet_id, event_type, recipient_key, payload
    )
    SELECT
      p_packet_id,
      CASE p_decision
        WHEN 'needs_correction' THEN 'packet_needs_correction_realtor'
        ELSE 'packet_rejected_realtor'
      END,
      'decision:' || v_next_version || ':realtor:' || lp.created_by,
      jsonb_build_object(
        'role', 'realtor',
        'user_id', lp.created_by,
        'reason', btrim(p_observations),
        'correction_scope', CASE WHEN p_decision = 'needs_correction'
          THEN p_correction_scope ELSE NULL END,
        'decision_version', v_next_version
      )
    FROM public.lease_packets lp WHERE lp.id = p_packet_id
    ON CONFLICT (packet_id, event_type, recipient_key) DO NOTHING;

    INSERT INTO public.notification_outbox (
      packet_id, event_type, recipient_key, payload
    )
    SELECT
      p_packet_id,
      CASE
        WHEN p_decision = 'needs_correction' AND ps.role_in_lease = 'landlord'
          THEN 'packet_needs_correction_landlord'
        WHEN p_decision = 'needs_correction'
          THEN 'packet_needs_correction_renter'
        WHEN ps.role_in_lease = 'landlord'
          THEN 'packet_rejected_landlord'
        ELSE 'packet_rejected_renter'
      END,
      'decision:' || v_next_version || ':' || ps.role_in_lease || ':' || ps.id,
      jsonb_build_object(
        'role', ps.role_in_lease,
        'signer_id', ps.id,
        'reason', btrim(p_observations),
        'correction_scope', CASE WHEN p_decision = 'needs_correction'
          THEN p_correction_scope ELSE NULL END,
        'decision_version', v_next_version
      )
    FROM public.packet_signers ps WHERE ps.packet_id = p_packet_id
    ON CONFLICT (packet_id, event_type, recipient_key) DO NOTHING;
  END IF;

  INSERT INTO public.packet_audit_log (packet_id, actor_id, action, metadata)
  VALUES (
    p_packet_id,
    v_actor,
    'notary_decision_submitted',
    jsonb_build_object(
      'decision', p_decision,
      'observations', NULLIF(btrim(p_observations), ''),
      'correction_scope', p_correction_scope,
      'decision_version', v_next_version,
      'certification_id', v_certification_id,
      'durable_processing', p_decision IN ('certified', 'certified_with_observations')
    )
  );

  RETURN jsonb_build_object(
    'decision', p_decision,
    'decision_version', v_next_version,
    'certification_id', v_certification_id,
    'queued', p_decision IN ('certified', 'certified_with_observations')
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.submit_notary_decision(uuid, text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.submit_notary_decision(uuid, text, text, text) TO authenticated;

-- Called only by the service-role worker after the certificate document exists.
CREATE OR REPLACE FUNCTION public.finalize_legacy_certification_job(
  p_job_id uuid,
  p_claim_token uuid,
  p_certification_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job record;
  v_cert record;
  v_registry_id uuid;
  v_certified_at timestamptz := now();
BEGIN
  SELECT * INTO v_job
  FROM public.notary_workflow_jobs
  WHERE id = p_job_id AND claim_token = p_claim_token AND status = 'processing'
  FOR UPDATE;
  IF v_job IS NULL OR v_job.job_type != 'create_registry_entry' THEN
    RAISE EXCEPTION 'Registry job claim is invalid or stale';
  END IF;

  SELECT * INTO v_cert
  FROM public.notary_certifications
  WHERE id = p_certification_id AND packet_id = v_job.packet_id
  FOR UPDATE;
  IF v_cert IS NULL THEN
    RAISE EXCEPTION 'Certification not found: %', p_certification_id;
  END IF;
  IF v_cert.publication_status = 'published' THEN
    SELECT id INTO v_registry_id FROM public.registry_entries
    WHERE packet_id = v_job.packet_id;
  ELSE
    IF NOT EXISTS (
      SELECT 1 FROM public.packet_documents
      WHERE packet_id = v_job.packet_id
        AND document_type = 'certified_lease'
        AND status = 'accepted'
    ) THEN
      RAISE EXCEPTION 'Certified document is not available';
    END IF;

    INSERT INTO public.registry_entries (
      packet_id, property_address, property_unit, district, province,
      landlord_dni, renter_dni, lease_start_date, lease_end_date,
      certified_at, status
    )
    SELECT
      lp.id, COALESCE(lp.property_address, ''), lp.property_unit,
      lp.district, lp.province,
      COALESCE((
        SELECT ps.signer_dni FROM public.packet_signers ps
        WHERE ps.packet_id = lp.id AND ps.role_in_lease = 'landlord' LIMIT 1
      ), ''),
      COALESCE((
        SELECT ps.signer_dni FROM public.packet_signers ps
        WHERE ps.packet_id = lp.id AND ps.role_in_lease = 'renter' LIMIT 1
      ), ''),
      lp.lease_start_date, lp.lease_end_date, v_certified_at, 'active'
    FROM public.lease_packets lp WHERE lp.id = v_job.packet_id
    ON CONFLICT (packet_id) DO UPDATE
      SET certified_at = EXCLUDED.certified_at
    RETURNING id INTO v_registry_id;

    UPDATE public.notary_certifications
    SET publication_status = 'published',
        published_at = v_certified_at,
        certified_at = v_certified_at
    WHERE id = p_certification_id;

    UPDATE public.lease_packets
    SET status = 'certified', certified_at = v_certified_at
    WHERE id = v_job.packet_id;

    INSERT INTO public.notification_outbox (
      packet_id, event_type, recipient_key, payload
    )
    SELECT v_job.packet_id, 'packet_certified_realtor',
      'realtor:' || lp.created_by,
      jsonb_build_object('role', 'realtor', 'user_id', lp.created_by)
    FROM public.lease_packets lp WHERE lp.id = v_job.packet_id
    ON CONFLICT (packet_id, event_type, recipient_key) DO NOTHING;

    INSERT INTO public.notification_outbox (
      packet_id, event_type, recipient_key, payload
    )
    SELECT v_job.packet_id,
      CASE ps.role_in_lease
        WHEN 'landlord' THEN 'packet_certified_landlord'
        ELSE 'packet_certified_renter'
      END,
      ps.role_in_lease || ':' || ps.id,
      jsonb_build_object('role', ps.role_in_lease, 'signer_id', ps.id)
    FROM public.packet_signers ps
    WHERE ps.packet_id = v_job.packet_id
    ON CONFLICT (packet_id, event_type, recipient_key) DO NOTHING;

    INSERT INTO public.packet_audit_log (packet_id, actor_id, action, metadata)
    VALUES (
      v_job.packet_id,
      v_cert.notary_id,
      'notary_certification_published',
      jsonb_build_object(
        'certification_id', p_certification_id,
        'registry_entry_id', v_registry_id,
        'job_id', p_job_id
      )
    );
  END IF;

  UPDATE public.notary_workflow_jobs
  SET status = 'completed',
      completed_at = now(),
      result = jsonb_build_object(
        'certification_id', p_certification_id,
        'registry_entry_id', v_registry_id
      ),
      updated_at = now()
  WHERE id = p_job_id AND claim_token = p_claim_token;

  RETURN jsonb_build_object(
    'certification_id', p_certification_id,
    'registry_entry_id', v_registry_id
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.finalize_legacy_certification_job(uuid, uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.finalize_legacy_certification_job(uuid, uuid, uuid) TO service_role;

-- -----------------------------------------------------------------------------
-- 6. Contracted rates and admin-confirmed monthly payouts
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.notary_payout_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notary_id uuid NOT NULL REFERENCES public.profiles(id),
  amount_per_certification numeric(12, 2) NOT NULL
    CHECK (amount_per_certification > 0),
  currency text NOT NULL DEFAULT 'PEN' CHECK (currency = 'PEN'),
  effective_from date NOT NULL,
  effective_to date,
  contract_reference text,
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (effective_to IS NULL OR effective_to >= effective_from),
  UNIQUE (notary_id, effective_from)
);

CREATE INDEX IF NOT EXISTS idx_notary_payout_rates_effective
  ON public.notary_payout_rates(notary_id, effective_from DESC, effective_to);

CREATE TABLE IF NOT EXISTS public.notary_monthly_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notary_id uuid NOT NULL REFERENCES public.profiles(id),
  period_month date NOT NULL,
  certification_count integer NOT NULL DEFAULT 0,
  gross_amount numeric(12, 2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'PEN' CHECK (currency = 'PEN'),
  status text NOT NULL DEFAULT 'confirmed'
    CHECK (status IN ('confirmed', 'paid', 'void')),
  confirmed_by uuid NOT NULL REFERENCES public.profiles(id),
  confirmed_at timestamptz NOT NULL DEFAULT now(),
  paid_by uuid REFERENCES public.profiles(id),
  paid_at timestamptz,
  payment_reference text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (notary_id, period_month),
  CHECK (period_month = date_trunc('month', period_month)::date)
);

CREATE TABLE IF NOT EXISTS public.notary_payout_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_id uuid NOT NULL REFERENCES public.notary_monthly_payouts(id) ON DELETE CASCADE,
  certification_id uuid NOT NULL UNIQUE REFERENCES public.notary_certifications(id),
  rate_id uuid NOT NULL REFERENCES public.notary_payout_rates(id),
  unit_amount numeric(12, 2) NOT NULL CHECK (unit_amount > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notary_payout_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notary_monthly_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notary_payout_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Notary reads own payout rates"
  ON public.notary_payout_rates FOR SELECT TO authenticated
  USING (notary_id = auth.uid() OR public.is_active_admin());
CREATE POLICY "Notary reads own monthly payouts"
  ON public.notary_monthly_payouts FOR SELECT TO authenticated
  USING (notary_id = auth.uid() OR public.is_active_admin());
CREATE POLICY "Notary reads own payout items"
  ON public.notary_payout_items FOR SELECT TO authenticated
  USING (
    payout_id IN (
      SELECT p.id FROM public.notary_monthly_payouts p
      WHERE p.notary_id = auth.uid()
    )
    OR public.is_active_admin()
  );

GRANT SELECT ON public.notary_payout_rates TO authenticated;
GRANT SELECT ON public.notary_monthly_payouts TO authenticated;
GRANT SELECT ON public.notary_payout_items TO authenticated;
GRANT ALL ON public.notary_payout_rates TO service_role;
GRANT ALL ON public.notary_monthly_payouts TO service_role;
GRANT ALL ON public.notary_payout_items TO service_role;

CREATE OR REPLACE FUNCTION public.set_notary_contracted_rate(
  p_notary_id uuid,
  p_amount numeric,
  p_effective_from date,
  p_contract_reference text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_rate_id uuid;
  v_effective_to date;
BEGIN
  IF v_actor IS NULL OR NOT public.is_active_admin() THEN
    RAISE EXCEPTION 'Only an active admin may configure notary rates';
  END IF;
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Rate must be greater than zero';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_notary_id AND role = 'notary' AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Active notary not found: %', p_notary_id;
  END IF;

  UPDATE public.notary_payout_rates
  SET effective_to = p_effective_from - 1
  WHERE notary_id = p_notary_id
    AND effective_from < p_effective_from
    AND (effective_to IS NULL OR effective_to >= p_effective_from);

  SELECT min(effective_from) - 1 INTO v_effective_to
  FROM public.notary_payout_rates
  WHERE notary_id = p_notary_id AND effective_from > p_effective_from;

  INSERT INTO public.notary_payout_rates (
    notary_id, amount_per_certification, effective_from, effective_to,
    contract_reference, created_by
  ) VALUES (
    p_notary_id, round(p_amount, 2), p_effective_from, v_effective_to,
    NULLIF(btrim(p_contract_reference), ''), v_actor
  )
  ON CONFLICT (notary_id, effective_from) DO UPDATE
  SET amount_per_certification = EXCLUDED.amount_per_certification,
      effective_to = EXCLUDED.effective_to,
      contract_reference = EXCLUDED.contract_reference,
      created_by = EXCLUDED.created_by,
      created_at = now()
  RETURNING id INTO v_rate_id;

  RETURN v_rate_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_notary_contracted_rate(uuid, numeric, date, text) FROM public;
GRANT EXECUTE ON FUNCTION public.set_notary_contracted_rate(uuid, numeric, date, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.confirm_notary_monthly_payout(
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
  v_missing_rates integer;
  v_count integer;
  v_total numeric(12, 2);
BEGIN
  IF v_actor IS NULL OR NOT public.is_active_admin() THEN
    RAISE EXCEPTION 'Only an active admin may confirm payouts';
  END IF;
  IF NOT public.is_active_notary(p_notary_id) THEN
    RAISE EXCEPTION 'Payout target must be an active notary';
  END IF;
  IF v_month >= date_trunc('month', current_date)::date THEN
    RAISE EXCEPTION 'Cannot confirm the current or a future payout month';
  END IF;

  SELECT id INTO v_payout_id
  FROM public.notary_monthly_payouts
  WHERE notary_id = p_notary_id AND period_month = v_month
  FOR UPDATE;

  IF v_payout_id IS NOT NULL THEN
    SELECT certification_count, gross_amount INTO v_count, v_total
    FROM public.notary_monthly_payouts WHERE id = v_payout_id;
    RETURN jsonb_build_object(
      'payout_id', v_payout_id, 'certification_count', v_count,
      'gross_amount', v_total, 'idempotent', true
    );
  END IF;

  SELECT count(*) INTO v_missing_rates
  FROM public.notary_certifications c
  WHERE c.notary_id = p_notary_id
    AND c.publication_status = 'published'
    AND COALESCE(c.published_at, c.certified_at) >= v_month
    AND COALESCE(c.published_at, c.certified_at) < v_end
    AND NOT EXISTS (
      SELECT 1 FROM public.notary_payout_rates r
      WHERE r.notary_id = c.notary_id
        AND r.effective_from <= COALESCE(c.published_at, c.certified_at)::date
        AND (r.effective_to IS NULL OR r.effective_to >= COALESCE(c.published_at, c.certified_at)::date)
    );

  IF v_missing_rates > 0 THEN
    RAISE EXCEPTION '% certification(s) have no contracted rate', v_missing_rates;
  END IF;

  INSERT INTO public.notary_monthly_payouts (
    notary_id, period_month, confirmed_by, notes
  ) VALUES (
    p_notary_id, v_month, v_actor, NULLIF(btrim(p_notes), '')
  ) RETURNING id INTO v_payout_id;

  INSERT INTO public.notary_payout_items (
    payout_id, certification_id, rate_id, unit_amount
  )
  SELECT
    v_payout_id,
    c.id,
    rate.id,
    rate.amount_per_certification
  FROM public.notary_certifications c
  CROSS JOIN LATERAL (
    SELECT r.id, r.amount_per_certification
    FROM public.notary_payout_rates r
    WHERE r.notary_id = c.notary_id
      AND r.effective_from <= COALESCE(c.published_at, c.certified_at)::date
      AND (r.effective_to IS NULL OR r.effective_to >= COALESCE(c.published_at, c.certified_at)::date)
    ORDER BY r.effective_from DESC
    LIMIT 1
  ) rate
  WHERE c.notary_id = p_notary_id
    AND c.publication_status = 'published'
    AND COALESCE(c.published_at, c.certified_at) >= v_month
    AND COALESCE(c.published_at, c.certified_at) < v_end
  ON CONFLICT (certification_id) DO NOTHING;

  SELECT count(*), COALESCE(sum(unit_amount), 0)
    INTO v_count, v_total
  FROM public.notary_payout_items WHERE payout_id = v_payout_id;

  UPDATE public.notary_monthly_payouts
  SET certification_count = v_count,
      gross_amount = v_total,
      updated_at = now()
  WHERE id = v_payout_id;

  RETURN jsonb_build_object(
    'payout_id', v_payout_id, 'certification_count', v_count,
    'gross_amount', v_total, 'idempotent', false
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.confirm_notary_monthly_payout(uuid, date, text) FROM public;
GRANT EXECUTE ON FUNCTION public.confirm_notary_monthly_payout(uuid, date, text) TO authenticated;

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
BEGIN
  IF v_actor IS NULL OR NOT public.is_active_admin() THEN
    RAISE EXCEPTION 'Only an active admin may mark payouts as paid';
  END IF;
  IF NULLIF(btrim(p_payment_reference), '') IS NULL THEN
    RAISE EXCEPTION 'Payment reference is required';
  END IF;

  UPDATE public.notary_monthly_payouts
  SET status = 'paid',
      paid_by = v_actor,
      paid_at = now(),
      payment_reference = btrim(p_payment_reference),
      notes = COALESCE(NULLIF(btrim(p_notes), ''), notes),
      updated_at = now()
  WHERE id = p_payout_id AND status = 'confirmed';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Confirmed payout not found: %', p_payout_id;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.mark_notary_payout_paid(uuid, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.mark_notary_payout_paid(uuid, text, text) TO authenticated;
