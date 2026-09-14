-- =============================================================================
-- 00017_notary_seal_workflow_compat.sql
-- Additive compatibility migration for the physical-sello notary workflow.
-- Retains the legacy idx_packet_documents_packet_type unique index.
-- Compatible writers must be deployed before 00018 drops it.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. lease_packets: add awaiting_notary_seal status + workflow version
-- ---------------------------------------------------------------------------

ALTER TABLE public.lease_packets
  DROP CONSTRAINT IF EXISTS lease_packets_status_check;

ALTER TABLE public.lease_packets
  ADD CONSTRAINT lease_packets_status_check
  CHECK (status IN (
    'draft', 'signing', 'all_signed', 'pending_notary',
    'under_review', 'awaiting_notary_seal',
    'needs_correction', 'certified', 'rejected'
  ));

ALTER TABLE public.lease_packets
  ADD COLUMN IF NOT EXISTS notary_workflow_version text NOT NULL DEFAULT 'legacy_v1'
    CHECK (notary_workflow_version IN ('legacy_v1', 'physical_seal_v1'));

-- ---------------------------------------------------------------------------
-- 2. packet_documents: add metadata columns + new document types
-- ---------------------------------------------------------------------------

ALTER TABLE public.packet_documents
  DROP CONSTRAINT IF EXISTS packet_documents_document_type_check;

ALTER TABLE public.packet_documents
  ADD CONSTRAINT packet_documents_document_type_check
  CHECK (document_type IN (
    'lease_original', 'signed_pdf', 'evidence_report',
    'certified_lease', 'notarial_scan', 'certification_report'
  ));

ALTER TABLE public.packet_documents
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'accepted'
    CHECK (status IN ('pending_validation', 'accepted', 'rejected', 'superseded'));

ALTER TABLE public.packet_documents
  ADD COLUMN IF NOT EXISTS supersedes_document_id uuid
    REFERENCES public.packet_documents(id);

ALTER TABLE public.packet_documents
  ADD COLUMN IF NOT EXISTS source_document_id uuid
    REFERENCES public.packet_documents(id);

ALTER TABLE public.packet_documents
  ADD COLUMN IF NOT EXISTS page_count integer
    CHECK (page_count > 0);

ALTER TABLE public.packet_documents
  ADD COLUMN IF NOT EXISTS file_size_bytes bigint
    CHECK (file_size_bytes > 0);

ALTER TABLE public.packet_documents
  ADD COLUMN IF NOT EXISTS original_filename text;

ALTER TABLE public.packet_documents
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_packet_documents_source
  ON public.packet_documents(source_document_id)
  WHERE source_document_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_packet_documents_supersedes
  ON public.packet_documents(supersedes_document_id)
  WHERE supersedes_document_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_packet_documents_status
  ON public.packet_documents(packet_id, document_type, status);

-- ---------------------------------------------------------------------------
-- 3. notary_attestations
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.notary_attestations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  packet_id uuid NOT NULL
    REFERENCES public.lease_packets(id) ON DELETE CASCADE,
  notary_id uuid NOT NULL
    REFERENCES public.profiles(id),
  source_signed_document_id uuid NOT NULL
    REFERENCES public.packet_documents(id),
  notarial_scan_document_id uuid NOT NULL
    REFERENCES public.packet_documents(id),
  source_document_hash text NOT NULL,
  notarial_scan_hash text NOT NULL,
  attestation_data jsonb NOT NULL DEFAULT '{}',
  attestation_text_version text NOT NULL,
  attestation_text text NOT NULL,
  attestation_text_hash text NOT NULL,
  ip_address inet,
  user_agent text,
  attested_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_notary_attestations_one_per_scan
  ON public.notary_attestations(notarial_scan_document_id);

CREATE INDEX IF NOT EXISTS idx_notary_attestations_packet
  ON public.notary_attestations(packet_id, attested_at DESC);

ALTER TABLE public.notary_attestations ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.notary_attestations TO authenticated;
GRANT ALL ON public.notary_attestations TO service_role;

CREATE POLICY "Notary reads own attestations"
  ON public.notary_attestations FOR SELECT
  TO authenticated
  USING (notary_id = auth.uid());

CREATE POLICY "Admin reads all attestations"
  ON public.notary_attestations FOR SELECT
  TO authenticated
  USING (public.is_active_admin());

-- ---------------------------------------------------------------------------
-- 4. Extend notary_certifications for preparation/publication
-- ---------------------------------------------------------------------------

ALTER TABLE public.notary_certifications
  ADD COLUMN IF NOT EXISTS publication_status text NOT NULL DEFAULT 'published'
    CHECK (publication_status IN ('prepared', 'published', 'void'));

ALTER TABLE public.notary_certifications
  ADD COLUMN IF NOT EXISTS prepared_at timestamptz;

ALTER TABLE public.notary_certifications
  ADD COLUMN IF NOT EXISTS published_at timestamptz;

ALTER TABLE public.notary_certifications
  ADD COLUMN IF NOT EXISTS notarial_scan_document_id uuid
    REFERENCES public.packet_documents(id);

ALTER TABLE public.notary_certifications
  ADD COLUMN IF NOT EXISTS certification_report_document_id uuid
    REFERENCES public.packet_documents(id);

ALTER TABLE public.notary_certifications
  ADD COLUMN IF NOT EXISTS attestation_id uuid
    REFERENCES public.notary_attestations(id);

-- Backfill existing certification rows as published
UPDATE public.notary_certifications
  SET published_at = certified_at
  WHERE publication_status = 'published' AND published_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_notary_certifications_one_active_per_packet
  ON public.notary_certifications(packet_id)
  WHERE publication_status IN ('prepared', 'published');

-- ---------------------------------------------------------------------------
-- 5. Protect registry idempotency
-- ---------------------------------------------------------------------------

-- Audit for duplicates first: fail if any exist
DO $$
DECLARE
  dup_count integer;
BEGIN
  SELECT count(*) INTO dup_count
  FROM (
    SELECT packet_id FROM public.registry_entries
    GROUP BY packet_id HAVING count(*) > 1
  ) dupes;
  IF dup_count > 0 THEN
    RAISE WARNING 'Found % packets with duplicate registry entries; review before adding unique constraint', dup_count;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_registry_entries_one_per_packet
  ON public.registry_entries(packet_id);

-- ---------------------------------------------------------------------------
-- 6. notification_outbox
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.notification_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  packet_id uuid NOT NULL
    REFERENCES public.lease_packets(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  recipient_key text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'sent', 'failed')),
  attempt_count integer NOT NULL DEFAULT 0,
  available_at timestamptz NOT NULL DEFAULT now(),
  processing_started_at timestamptz,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_outbox_idempotent
  ON public.notification_outbox(packet_id, event_type, recipient_key);

CREATE INDEX IF NOT EXISTS idx_notification_outbox_pending
  ON public.notification_outbox(status, available_at)
  WHERE status IN ('pending', 'failed');

ALTER TABLE public.notification_outbox ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.notification_outbox TO service_role;

-- ---------------------------------------------------------------------------
-- 7. notary_workflow_settings (rollout configuration)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.notary_workflow_settings (
  notary_id uuid PRIMARY KEY
    REFERENCES public.profiles(id),
  physical_seal_v1_enabled boolean NOT NULL DEFAULT false,
  enabled_by uuid REFERENCES public.profiles(id),
  enabled_at timestamptz,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.notary_workflow_settings ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.notary_workflow_settings TO authenticated;
GRANT ALL ON public.notary_workflow_settings TO service_role;

CREATE POLICY "Notary reads own workflow settings"
  ON public.notary_workflow_settings FOR SELECT
  TO authenticated
  USING (notary_id = auth.uid());

CREATE POLICY "Admin reads all workflow settings"
  ON public.notary_workflow_settings FOR SELECT
  TO authenticated
  USING (public.is_active_admin());

CREATE POLICY "Admin manages workflow settings"
  ON public.notary_workflow_settings FOR ALL
  TO authenticated
  USING (public.is_active_admin())
  WITH CHECK (public.is_active_admin());

-- ---------------------------------------------------------------------------
-- 8. Update transition_packet_status RPC
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.transition_packet_status(
  p_packet_id uuid,
  p_new_status text,
  p_actor_id uuid,
  p_action text,
  p_metadata jsonb DEFAULT '{}'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_status text;
  v_workflow text;
  v_valid_transitions jsonb;
  v_allowed jsonb;
BEGIN
  SELECT status, notary_workflow_version
    INTO v_current_status, v_workflow
  FROM public.lease_packets
  WHERE id = p_packet_id
  FOR UPDATE;

  IF v_current_status IS NULL THEN
    RAISE EXCEPTION 'Packet not found: %', p_packet_id;
  END IF;

  IF v_workflow = 'physical_seal_v1' THEN
    v_valid_transitions := '{
      "draft": ["signing"],
      "signing": ["all_signed", "needs_correction"],
      "all_signed": ["pending_notary"],
      "pending_notary": ["under_review"],
      "under_review": ["awaiting_notary_seal", "needs_correction", "rejected"],
      "awaiting_notary_seal": ["certified", "needs_correction", "rejected"],
      "needs_correction": ["signing", "pending_notary"]
    }'::jsonb;
  ELSE
    v_valid_transitions := '{
      "draft": ["signing"],
      "signing": ["all_signed", "needs_correction"],
      "all_signed": ["pending_notary"],
      "pending_notary": ["under_review"],
      "under_review": ["certified", "needs_correction", "rejected"],
      "needs_correction": ["signing", "pending_notary"]
    }'::jsonb;
  END IF;

  v_allowed := v_valid_transitions -> v_current_status;

  IF v_allowed IS NULL OR NOT v_allowed ? p_new_status THEN
    RAISE EXCEPTION 'Invalid transition from % to % (workflow: %)',
      v_current_status, p_new_status, v_workflow;
  END IF;

  UPDATE public.lease_packets
  SET status = p_new_status
  WHERE id = p_packet_id;

  INSERT INTO public.packet_audit_log (packet_id, actor_id, action, metadata)
  VALUES (p_packet_id, p_actor_id, p_action, p_metadata);
END;
$$;

-- ---------------------------------------------------------------------------
-- 9. approve_evidence_for_seal RPC
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.approve_evidence_for_seal(
  p_packet_id uuid,
  p_actor_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
  v_workflow text;
  v_assigned uuid;
  v_signed_pdf_exists boolean;
BEGIN
  SELECT status, notary_workflow_version INTO v_status, v_workflow
  FROM public.lease_packets WHERE id = p_packet_id FOR UPDATE;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Packet not found: %', p_packet_id;
  END IF;

  IF v_status != 'under_review' THEN
    RAISE EXCEPTION 'Packet must be under_review, got: %', v_status;
  END IF;

  IF v_workflow != 'physical_seal_v1' THEN
    RAISE EXCEPTION 'Packet workflow must be physical_seal_v1, got: %', v_workflow;
  END IF;

  SELECT notary_id INTO v_assigned
  FROM public.notary_assignments WHERE packet_id = p_packet_id;

  IF v_assigned IS NULL OR v_assigned != p_actor_id THEN
    RAISE EXCEPTION 'Actor % is not the assigned notary for packet %', p_actor_id, p_packet_id;
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.packet_documents
    WHERE packet_id = p_packet_id
      AND document_type = 'signed_pdf'
      AND status = 'accepted'
  ) INTO v_signed_pdf_exists;

  IF NOT v_signed_pdf_exists THEN
    RAISE EXCEPTION 'No accepted signed_pdf for packet %', p_packet_id;
  END IF;

  UPDATE public.lease_packets
  SET status = 'awaiting_notary_seal'
  WHERE id = p_packet_id;

  INSERT INTO public.packet_audit_log (packet_id, actor_id, action, metadata)
  VALUES (p_packet_id, p_actor_id, 'notary_approved_evidence_for_seal',
    jsonb_build_object('previous_status', 'under_review'));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.approve_evidence_for_seal(uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.approve_evidence_for_seal(uuid, uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- 10. prepare_notarized_certification RPC
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.prepare_notarized_certification(
  p_packet_id uuid,
  p_notary_id uuid,
  p_notarial_scan_document_id uuid,
  p_observations text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
  v_workflow text;
  v_assigned uuid;
  v_doc_status text;
  v_doc_type text;
  v_doc_packet uuid;
  v_source_id uuid;
  v_source_type text;
  v_source_status text;
  v_attestation_exists boolean;
  v_cert_type text;
  v_cert_id uuid;
  v_existing_cert_id uuid;
  v_checklist jsonb;
BEGIN
  SELECT status, notary_workflow_version INTO v_status, v_workflow
  FROM public.lease_packets WHERE id = p_packet_id FOR UPDATE;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Packet not found: %', p_packet_id;
  END IF;
  IF v_status != 'awaiting_notary_seal' THEN
    RAISE EXCEPTION 'Packet must be awaiting_notary_seal, got: %', v_status;
  END IF;
  IF v_workflow != 'physical_seal_v1' THEN
    RAISE EXCEPTION 'Packet workflow must be physical_seal_v1, got: %', v_workflow;
  END IF;

  SELECT notary_id INTO v_assigned
  FROM public.notary_assignments WHERE packet_id = p_packet_id;
  IF v_assigned IS NULL OR v_assigned != p_notary_id THEN
    RAISE EXCEPTION 'Notary % is not assigned to packet %', p_notary_id, p_packet_id;
  END IF;

  SELECT status, document_type, packet_id, source_document_id
    INTO v_doc_status, v_doc_type, v_doc_packet, v_source_id
  FROM public.packet_documents WHERE id = p_notarial_scan_document_id;

  IF v_doc_type != 'notarial_scan' OR v_doc_status != 'accepted' THEN
    RAISE EXCEPTION 'Document must be an accepted notarial_scan';
  END IF;
  IF v_doc_packet != p_packet_id THEN
    RAISE EXCEPTION 'Document does not belong to this packet';
  END IF;

  IF v_source_id IS NOT NULL THEN
    SELECT document_type, status INTO v_source_type, v_source_status
    FROM public.packet_documents WHERE id = v_source_id;
    IF v_source_type != 'signed_pdf' OR v_source_status != 'accepted' THEN
      RAISE EXCEPTION 'Notarial scan source must be the accepted signed_pdf';
    END IF;
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.notary_attestations
    WHERE notarial_scan_document_id = p_notarial_scan_document_id
      AND notary_id = p_notary_id
  ) INTO v_attestation_exists;
  IF NOT v_attestation_exists THEN
    RAISE EXCEPTION 'Attestation required for this notarial scan before preparation';
  END IF;

  SELECT checklist_data INTO v_checklist
  FROM public.notary_review_checklists
  WHERE packet_id = p_packet_id AND notary_id = p_notary_id;

  v_cert_type := CASE WHEN p_observations IS NOT NULL
    THEN 'certified_with_observations' ELSE 'certified' END;

  -- Idempotency: return existing prepared certification
  SELECT id INTO v_existing_cert_id
  FROM public.notary_certifications
  WHERE packet_id = p_packet_id
    AND publication_status = 'prepared';

  IF v_existing_cert_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'newly_prepared', false,
      'certification_id', v_existing_cert_id
    );
  END IF;

  INSERT INTO public.notary_certifications (
    packet_id, notary_id, certification_type, observations,
    checklist_data, publication_status, prepared_at,
    notarial_scan_document_id, attestation_id
  ) VALUES (
    p_packet_id, p_notary_id, v_cert_type, p_observations,
    COALESCE(v_checklist, '{}'), 'prepared', now(),
    p_notarial_scan_document_id,
    (SELECT id FROM public.notary_attestations
     WHERE notarial_scan_document_id = p_notarial_scan_document_id
       AND notary_id = p_notary_id
     LIMIT 1)
  ) RETURNING id INTO v_cert_id;

  INSERT INTO public.packet_audit_log (packet_id, actor_id, action, metadata)
  VALUES (p_packet_id, p_notary_id, 'notary_certification_prepared',
    jsonb_build_object(
      'certification_id', v_cert_id,
      'notarial_scan_document_id', p_notarial_scan_document_id,
      'certification_type', v_cert_type
    ));

  RETURN jsonb_build_object(
    'newly_prepared', true,
    'certification_id', v_cert_id
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.prepare_notarized_certification(uuid, uuid, uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.prepare_notarized_certification(uuid, uuid, uuid, text) TO service_role;

-- ---------------------------------------------------------------------------
-- 11. finalize_notarized_certification RPC
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.finalize_notarized_certification(
  p_packet_id uuid,
  p_notary_id uuid,
  p_certification_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
  v_workflow text;
  v_assigned uuid;
  v_cert_pub_status text;
  v_cert_packet uuid;
  v_cert_notary uuid;
  v_scan_doc_id uuid;
  v_report_doc_id uuid;
  v_attestation_id uuid;
  v_scan_status text;
  v_report_status text;
  v_registry_id uuid;
  v_cert_type text;
  v_observations text;
  v_checklist jsonb;
BEGIN
  -- Lock and validate packet
  SELECT status, notary_workflow_version INTO v_status, v_workflow
  FROM public.lease_packets WHERE id = p_packet_id FOR UPDATE;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Packet not found: %', p_packet_id;
  END IF;

  -- Idempotency
  IF v_status = 'certified' THEN
    SELECT id INTO v_registry_id FROM public.registry_entries
    WHERE packet_id = p_packet_id LIMIT 1;
    RETURN jsonb_build_object(
      'newly_finalized', false,
      'certification_id', p_certification_id,
      'registry_entry_id', v_registry_id
    );
  END IF;

  IF v_status != 'awaiting_notary_seal' THEN
    RAISE EXCEPTION 'Packet must be awaiting_notary_seal, got: %', v_status;
  END IF;
  IF v_workflow != 'physical_seal_v1' THEN
    RAISE EXCEPTION 'Packet workflow must be physical_seal_v1, got: %', v_workflow;
  END IF;

  -- Validate assignment
  SELECT notary_id INTO v_assigned
  FROM public.notary_assignments WHERE packet_id = p_packet_id;
  IF v_assigned IS NULL OR v_assigned != p_notary_id THEN
    RAISE EXCEPTION 'Notary % is not assigned to packet %', p_notary_id, p_packet_id;
  END IF;

  -- Validate prepared certification
  SELECT publication_status, packet_id, notary_id,
         notarial_scan_document_id, certification_report_document_id,
         attestation_id, certification_type, observations, checklist_data
    INTO v_cert_pub_status, v_cert_packet, v_cert_notary,
         v_scan_doc_id, v_report_doc_id,
         v_attestation_id, v_cert_type, v_observations, v_checklist
  FROM public.notary_certifications WHERE id = p_certification_id;

  IF v_cert_pub_status IS NULL THEN
    RAISE EXCEPTION 'Certification not found: %', p_certification_id;
  END IF;
  IF v_cert_pub_status != 'prepared' THEN
    RAISE EXCEPTION 'Certification must be prepared, got: %', v_cert_pub_status;
  END IF;
  IF v_cert_packet != p_packet_id OR v_cert_notary != p_notary_id THEN
    RAISE EXCEPTION 'Certification does not match packet/notary';
  END IF;

  -- Validate documents exist and are accepted
  IF v_scan_doc_id IS NULL THEN
    RAISE EXCEPTION 'No notarial scan linked to certification';
  END IF;
  SELECT status INTO v_scan_status
  FROM public.packet_documents WHERE id = v_scan_doc_id;
  IF v_scan_status != 'accepted' THEN
    RAISE EXCEPTION 'Notarial scan must be accepted, got: %', v_scan_status;
  END IF;

  IF v_report_doc_id IS NULL THEN
    RAISE EXCEPTION 'No certification report linked to certification';
  END IF;
  SELECT status INTO v_report_status
  FROM public.packet_documents WHERE id = v_report_doc_id;
  IF v_report_status != 'accepted' THEN
    RAISE EXCEPTION 'Certification report must be accepted, got: %', v_report_status;
  END IF;

  -- Validate attestation
  IF v_attestation_id IS NULL THEN
    RAISE EXCEPTION 'No attestation linked to certification';
  END IF;
  IF NOT EXISTS(
    SELECT 1 FROM public.notary_attestations WHERE id = v_attestation_id
  ) THEN
    RAISE EXCEPTION 'Attestation not found: %', v_attestation_id;
  END IF;

  -- Finalize packet
  UPDATE public.lease_packets
  SET status = 'certified', certified_at = now()
  WHERE id = p_packet_id;

  -- Update assignment
  UPDATE public.notary_assignments
  SET decision = v_cert_type,
      decided_at = now(),
      observations = v_observations
  WHERE packet_id = p_packet_id AND notary_id = p_notary_id;

  -- Publish certification
  UPDATE public.notary_certifications
  SET publication_status = 'published', published_at = now()
  WHERE id = p_certification_id;

  -- Idempotent registry insert
  INSERT INTO public.registry_entries (
    packet_id, property_address, property_unit, district, province,
    landlord_dni, renter_dni,
    lease_start_date, lease_end_date, certified_at, status
  )
  SELECT
    lp.id, lp.property_address, lp.property_unit, lp.district, lp.province,
    COALESCE(
      (SELECT ps.signer_dni FROM public.packet_signers ps
       WHERE ps.packet_id = p_packet_id AND ps.role_in_lease = 'landlord' LIMIT 1), ''),
    COALESCE(
      (SELECT ps.signer_dni FROM public.packet_signers ps
       WHERE ps.packet_id = p_packet_id AND ps.role_in_lease = 'renter' LIMIT 1), ''),
    lp.lease_start_date, lp.lease_end_date, now(), 'active'
  FROM public.lease_packets lp WHERE lp.id = p_packet_id
  ON CONFLICT (packet_id) DO NOTHING
  RETURNING id INTO v_registry_id;

  IF v_registry_id IS NULL THEN
    SELECT id INTO v_registry_id FROM public.registry_entries
    WHERE packet_id = p_packet_id;
  END IF;

  -- Outbox: queue notifications for each party
  INSERT INTO public.notification_outbox (packet_id, event_type, recipient_key, payload)
  SELECT p_packet_id, 'packet_certified_realtor', 'realtor:' || lp.created_by,
    jsonb_build_object('role', 'realtor', 'user_id', lp.created_by)
  FROM public.lease_packets lp WHERE lp.id = p_packet_id
  ON CONFLICT (packet_id, event_type, recipient_key) DO NOTHING;

  INSERT INTO public.notification_outbox (packet_id, event_type, recipient_key, payload)
  SELECT p_packet_id,
    CASE ps.role_in_lease
      WHEN 'landlord' THEN 'packet_certified_landlord'
      WHEN 'renter' THEN 'packet_certified_renter'
    END,
    ps.role_in_lease || ':' || ps.id,
    jsonb_build_object('role', ps.role_in_lease, 'signer_id', ps.id)
  FROM public.packet_signers ps
  WHERE ps.packet_id = p_packet_id
  ON CONFLICT (packet_id, event_type, recipient_key) DO NOTHING;

  -- Final audit event
  INSERT INTO public.packet_audit_log (packet_id, actor_id, action, metadata)
  VALUES (p_packet_id, p_notary_id, 'notary_finalized_certification',
    jsonb_build_object(
      'certification_id', p_certification_id,
      'registry_entry_id', v_registry_id,
      'notarial_scan_document_id', v_scan_doc_id,
      'certification_report_document_id', v_report_doc_id,
      'attestation_id', v_attestation_id,
      'certification_type', v_cert_type
    ));

  RETURN jsonb_build_object(
    'newly_finalized', true,
    'certification_id', p_certification_id,
    'registry_entry_id', v_registry_id
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.finalize_notarized_certification(uuid, uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.finalize_notarized_certification(uuid, uuid, uuid) TO service_role;
