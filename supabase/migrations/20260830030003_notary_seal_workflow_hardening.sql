-- =============================================================================
-- 00019_notary_seal_workflow_hardening.sql
-- Hardening migration: schema additions, helper functions, RPC rewrites,
-- RLS lockdown for participant pre-publication access, outbox claim protocol.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Schema additions
-- ---------------------------------------------------------------------------

ALTER TABLE public.notary_review_checklists
  ADD COLUMN IF NOT EXISTS checklist_version int NOT NULL DEFAULT 1;

ALTER TABLE public.notary_certifications
  ADD COLUMN IF NOT EXISTS checklist_version int NOT NULL DEFAULT 1;

ALTER TABLE public.packet_documents
  ADD COLUMN IF NOT EXISTS certification_id uuid
    REFERENCES public.notary_certifications(id);

ALTER TABLE public.notification_outbox
  ADD COLUMN IF NOT EXISTS claim_token uuid;

-- ---------------------------------------------------------------------------
-- 2. Helper: is_active_notary
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_active_notary(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.profiles
    WHERE id = p_user_id
      AND role = 'notary'
      AND status = 'active'
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_active_notary(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.is_active_notary(uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- 3. Helper: validate_notary_checklist
--    Version 1: all 13 mandatory keys must have checked = true.
--    Extra keys are tolerated (forward compatibility).
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.validate_notary_checklist(
  p_checklist jsonb,
  p_version int
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mandatory_keys text[];
  v_key text;
  v_item jsonb;
BEGIN
  IF p_version = 1 THEN
    v_mandatory_keys := ARRAY[
      'revisarDocumento', 'revisarPdfFirmado', 'revisarIdentidad',
      'revisarWhatsapp', 'revisarConsentimiento', 'revisarFirmaIofe',
      'revisarCadena', 'revisarTimestamp', 'revisarHashes',
      'revisarPropiedad', 'revisarRegistro', 'revisarSesion',
      'determinacion'
    ];
  ELSE
    RAISE EXCEPTION 'Unsupported checklist version: %', p_version;
  END IF;

  FOREACH v_key IN ARRAY v_mandatory_keys LOOP
    v_item := p_checklist -> v_key;
    IF v_item IS NULL THEN
      RAISE EXCEPTION 'Checklist key missing: %', v_key;
    END IF;
    IF NOT (v_item ->> 'checked')::boolean THEN
      RAISE EXCEPTION 'Checklist key not checked: %', v_key;
    END IF;
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.validate_notary_checklist(jsonb, int) FROM public;
GRANT EXECUTE ON FUNCTION public.validate_notary_checklist(jsonb, int) TO service_role;

-- ---------------------------------------------------------------------------
-- 4. Helper: participant_can_see_document (SECURITY DEFINER)
--    Publication-gated visibility for participants.
--    Outer RLS policies still require packet membership.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.participant_can_see_document(p_doc_row public.packet_documents)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_packet_status text;
  v_published_cert_exists boolean;
BEGIN
  IF p_doc_row.status != 'accepted' THEN
    RETURN false;
  END IF;

  IF p_doc_row.document_type IN ('lease_original', 'signed_pdf', 'evidence_report') THEN
    RETURN true;
  END IF;

  SELECT status INTO v_packet_status
  FROM public.lease_packets
  WHERE id = p_doc_row.packet_id;

  IF p_doc_row.document_type = 'certified_lease' THEN
    RETURN v_packet_status = 'certified';
  END IF;

  IF p_doc_row.document_type = 'notarial_scan' THEN
    RETURN v_packet_status = 'certified'
      AND EXISTS(
        SELECT 1 FROM public.notary_certifications
        WHERE packet_id = p_doc_row.packet_id
          AND publication_status = 'published'
          AND notarial_scan_document_id = p_doc_row.id
      );
  END IF;

  IF p_doc_row.document_type = 'certification_report' THEN
    RETURN v_packet_status = 'certified'
      AND EXISTS(
        SELECT 1 FROM public.notary_certifications
        WHERE packet_id = p_doc_row.packet_id
          AND publication_status = 'published'
          AND certification_report_document_id = p_doc_row.id
      );
  END IF;

  RETURN false;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.participant_can_see_document(public.packet_documents) FROM public;
GRANT EXECUTE ON FUNCTION public.participant_can_see_document(public.packet_documents) TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. RLS lockdown on packet_documents
-- ---------------------------------------------------------------------------

-- Realtor INSERT: restrict to lease_original only
DROP POLICY IF EXISTS "Realtor uploads docs to own packets" ON public.packet_documents;
CREATE POLICY "Realtor uploads docs to own packets"
  ON public.packet_documents FOR INSERT
  TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid()
    AND document_type = 'lease_original'
    AND packet_id IN (SELECT public.packets_as_realtor())
  );

-- Realtor SELECT: membership + publication gate
DROP POLICY IF EXISTS "Realtor reads docs on own packets" ON public.packet_documents;
CREATE POLICY "Realtor reads docs on own packets"
  ON public.packet_documents FOR SELECT
  TO authenticated
  USING (
    packet_id IN (SELECT public.packets_as_realtor())
    AND public.participant_can_see_document(packet_documents)
  );

-- Signer SELECT: membership + publication gate
DROP POLICY IF EXISTS "Signers read docs on their packets" ON public.packet_documents;
CREATE POLICY "Signers read docs on their packets"
  ON public.packet_documents FOR SELECT
  TO authenticated
  USING (
    packet_id IN (SELECT public.packets_as_signer())
    AND public.participant_can_see_document(packet_documents)
  );

-- Notary and admin SELECT policies remain unchanged (full access).

-- ---------------------------------------------------------------------------
-- 6. RLS lockdown on notary_certifications for participants
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Signers read certs on their packets" ON public.notary_certifications;
CREATE POLICY "Signers read certs on their packets"
  ON public.notary_certifications FOR SELECT
  TO authenticated
  USING (
    packet_id IN (SELECT public.packets_as_signer())
    AND publication_status = 'published'
  );

-- Realtor can see published certifications
DROP POLICY IF EXISTS "Realtor reads certs on own packets" ON public.notary_certifications;
CREATE POLICY "Realtor reads certs on own packets"
  ON public.notary_certifications FOR SELECT
  TO authenticated
  USING (
    packet_id IN (SELECT public.packets_as_realtor())
    AND publication_status = 'published'
  );

-- ---------------------------------------------------------------------------
-- 7. approve_evidence_for_seal RPC (rewrite)
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
  v_evidence_report_exists boolean;
  v_checklist jsonb;
  v_checklist_version int;
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

  IF NOT public.is_active_notary(p_actor_id) THEN
    RAISE EXCEPTION 'Actor % is not an active notary', p_actor_id;
  END IF;

  SELECT notary_id INTO v_assigned
  FROM public.notary_assignments WHERE packet_id = p_packet_id;
  IF v_assigned IS NULL OR v_assigned != p_actor_id THEN
    RAISE EXCEPTION 'Actor % is not the assigned notary for packet %', p_actor_id, p_packet_id;
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.packet_documents
    WHERE packet_id = p_packet_id AND document_type = 'signed_pdf' AND status = 'accepted'
  ) INTO v_signed_pdf_exists;
  IF NOT v_signed_pdf_exists THEN
    RAISE EXCEPTION 'No accepted signed_pdf for packet %', p_packet_id;
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.packet_documents
    WHERE packet_id = p_packet_id AND document_type = 'evidence_report' AND status = 'accepted'
  ) INTO v_evidence_report_exists;
  IF NOT v_evidence_report_exists THEN
    RAISE EXCEPTION 'No accepted evidence_report for packet %', p_packet_id;
  END IF;

  SELECT checklist_data, checklist_version INTO v_checklist, v_checklist_version
  FROM public.notary_review_checklists
  WHERE packet_id = p_packet_id AND notary_id = p_actor_id;

  IF v_checklist IS NULL THEN
    RAISE EXCEPTION 'No checklist found for packet %', p_packet_id;
  END IF;

  PERFORM public.validate_notary_checklist(v_checklist, COALESCE(v_checklist_version, 1));

  UPDATE public.lease_packets SET status = 'awaiting_notary_seal'
  WHERE id = p_packet_id;

  INSERT INTO public.packet_audit_log (packet_id, actor_id, action, metadata)
  VALUES (p_packet_id, p_actor_id, 'notary_approved_evidence_for_seal',
    jsonb_build_object('previous_status', 'under_review'));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.approve_evidence_for_seal(uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.approve_evidence_for_seal(uuid, uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- 8. start_notary_review RPC (new)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.start_notary_review(
  p_packet_id uuid,
  p_actor_id uuid,
  p_workflow_version text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
  v_current_workflow text;
  v_assigned uuid;
  v_notary_enabled boolean;
BEGIN
  SELECT status, notary_workflow_version INTO v_status, v_current_workflow
  FROM public.lease_packets WHERE id = p_packet_id FOR UPDATE;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Packet not found: %', p_packet_id;
  END IF;
  IF v_status != 'pending_notary' THEN
    RAISE EXCEPTION 'Packet must be pending_notary, got: %', v_status;
  END IF;

  IF NOT public.is_active_notary(p_actor_id) THEN
    RAISE EXCEPTION 'Actor % is not an active notary', p_actor_id;
  END IF;

  SELECT notary_id INTO v_assigned
  FROM public.notary_assignments WHERE packet_id = p_packet_id;
  IF v_assigned IS NULL OR v_assigned != p_actor_id THEN
    RAISE EXCEPTION 'Actor % is not the assigned notary for packet %', p_actor_id, p_packet_id;
  END IF;

  IF p_workflow_version NOT IN ('legacy_v1', 'physical_seal_v1') THEN
    RAISE EXCEPTION 'Invalid workflow version: %', p_workflow_version;
  END IF;

  IF p_workflow_version = 'physical_seal_v1' THEN
    SELECT physical_seal_v1_enabled INTO v_notary_enabled
    FROM public.notary_workflow_settings
    WHERE notary_id = p_actor_id;

    IF NOT COALESCE(v_notary_enabled, false) THEN
      RAISE EXCEPTION 'Notary % does not have physical_seal_v1 enabled', p_actor_id;
    END IF;
  END IF;

  UPDATE public.lease_packets
  SET status = 'under_review',
      notary_workflow_version = p_workflow_version
  WHERE id = p_packet_id;

  UPDATE public.notary_assignments
  SET review_started_at = now()
  WHERE packet_id = p_packet_id AND notary_id = p_actor_id;

  INSERT INTO public.packet_audit_log (packet_id, actor_id, action, metadata)
  VALUES (p_packet_id, p_actor_id, 'notary_started_review',
    jsonb_build_object(
      'workflow_version', p_workflow_version,
      'previous_status', 'pending_notary'
    ));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.start_notary_review(uuid, uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.start_notary_review(uuid, uuid, text) TO service_role;

-- Prevent workflow version changes after leaving pending_notary
CREATE OR REPLACE FUNCTION public.enforce_workflow_version_immutability()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.notary_workflow_version IS DISTINCT FROM NEW.notary_workflow_version
     AND OLD.status != 'pending_notary' THEN
    RAISE EXCEPTION 'Cannot change workflow version after packet leaves pending_notary';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_workflow_version ON public.lease_packets;
CREATE TRIGGER trg_enforce_workflow_version
  BEFORE UPDATE ON public.lease_packets
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_workflow_version_immutability();

-- ---------------------------------------------------------------------------
-- 9. replace_packet_document RPC (new)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.replace_packet_document(
  p_packet_id uuid,
  p_document_type text,
  p_storage_path text,
  p_file_hash text,
  p_uploaded_by uuid,
  p_file_size_bytes bigint DEFAULT NULL,
  p_page_count int DEFAULT NULL,
  p_original_filename text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}',
  p_source_document_id uuid DEFAULT NULL,
  p_certification_id uuid DEFAULT NULL,
  p_document_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_packet_status text;
  v_workflow text;
  v_existing_id uuid;
  v_existing_storage_path text;
  v_existing_version int;
  v_next_version int;
  v_new_id uuid;
  v_assigned_notary uuid;
BEGIN
  -- Lock the packet row to serialize all document replacements
  SELECT status, notary_workflow_version INTO v_packet_status, v_workflow
  FROM public.lease_packets WHERE id = p_packet_id FOR UPDATE;

  IF v_packet_status IS NULL THEN
    RAISE EXCEPTION 'Packet not found: %', p_packet_id;
  END IF;

  -- Allow-list document types
  IF p_document_type NOT IN ('evidence_report', 'certified_lease', 'notarial_scan', 'certification_report') THEN
    RAISE EXCEPTION 'Document type not replaceable: %', p_document_type;
  END IF;

  -- Physical artifact validation
  IF p_document_type IN ('notarial_scan', 'certification_report') THEN
    IF v_workflow != 'physical_seal_v1' THEN
      RAISE EXCEPTION 'Physical artifacts require physical_seal_v1 workflow';
    END IF;
    IF v_packet_status NOT IN ('awaiting_notary_seal', 'under_review') THEN
      RAISE EXCEPTION 'Cannot replace physical artifacts in status: %', v_packet_status;
    END IF;

    SELECT notary_id INTO v_assigned_notary
    FROM public.notary_assignments WHERE packet_id = p_packet_id;
    IF v_assigned_notary IS NULL OR v_assigned_notary != p_uploaded_by THEN
      RAISE EXCEPTION 'Only the assigned notary can replace physical artifacts';
    END IF;
    IF NOT public.is_active_notary(p_uploaded_by) THEN
      RAISE EXCEPTION 'Notary is not active';
    END IF;
  END IF;

  -- Source lineage validation by type
  IF p_document_type = 'notarial_scan' AND p_source_document_id IS NOT NULL THEN
    IF NOT EXISTS(
      SELECT 1 FROM public.packet_documents
      WHERE id = p_source_document_id
        AND packet_id = p_packet_id
        AND document_type = 'signed_pdf'
        AND status = 'accepted'
    ) THEN
      RAISE EXCEPTION 'Source document must be an accepted signed_pdf for this packet';
    END IF;
  END IF;

  IF p_document_type = 'certification_report' AND p_source_document_id IS NOT NULL THEN
    IF NOT EXISTS(
      SELECT 1 FROM public.packet_documents
      WHERE id = p_source_document_id
        AND packet_id = p_packet_id
        AND document_type = 'notarial_scan'
        AND status = 'accepted'
    ) THEN
      RAISE EXCEPTION 'Source document for certification_report must be an accepted notarial_scan';
    END IF;
  END IF;

  -- Certification ownership validation (runs before replay to prevent bypass)
  IF p_document_type = 'certification_report' AND p_certification_id IS NOT NULL THEN
    IF NOT EXISTS(
      SELECT 1 FROM public.notary_certifications
      WHERE id = p_certification_id
        AND packet_id = p_packet_id
        AND publication_status = 'prepared'
        AND notarial_scan_document_id = p_source_document_id
    ) THEN
      RAISE EXCEPTION 'Certification % is not a prepared certification for this packet/scan', p_certification_id;
    END IF;
  END IF;

  -- Hash-idempotent replay: must match hash, source, and certification binding
  SELECT id, storage_path INTO v_existing_id, v_existing_storage_path
  FROM public.packet_documents
  WHERE packet_id = p_packet_id
    AND document_type = p_document_type
    AND status = 'accepted'
    AND file_hash = p_file_hash
    AND source_document_id IS NOT DISTINCT FROM p_source_document_id
    AND certification_id IS NOT DISTINCT FROM p_certification_id;

  IF v_existing_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'old_document_id', null,
      'new_document_id', v_existing_id,
      'idempotent', true,
      'storage_path_to_delete', p_storage_path,
      'accepted_storage_path', v_existing_storage_path
    );
  END IF;

  -- Find and supersede existing accepted document
  SELECT id, version INTO v_existing_id, v_existing_version
  FROM public.packet_documents
  WHERE packet_id = p_packet_id
    AND document_type = p_document_type
    AND status = 'accepted';

  IF v_existing_id IS NOT NULL THEN
    UPDATE public.packet_documents SET status = 'superseded'
    WHERE id = v_existing_id;
  END IF;

  v_next_version := COALESCE(
    (SELECT max(version) + 1 FROM public.packet_documents
     WHERE packet_id = p_packet_id AND document_type = p_document_type),
    1
  );

  v_new_id := COALESCE(p_document_id, gen_random_uuid());

  INSERT INTO public.packet_documents (
    id, packet_id, document_type, storage_path, file_hash,
    uploaded_by, status, version, supersedes_document_id,
    source_document_id, page_count, file_size_bytes,
    original_filename, metadata, certification_id
  ) VALUES (
    v_new_id, p_packet_id, p_document_type, p_storage_path, p_file_hash,
    p_uploaded_by, 'accepted', v_next_version, v_existing_id,
    p_source_document_id, p_page_count, p_file_size_bytes,
    p_original_filename, p_metadata, p_certification_id
  );

  -- For certification_report: link to certification in same transaction
  -- (ownership already validated before replay detection)
  IF p_document_type = 'certification_report' AND p_certification_id IS NOT NULL THEN
    UPDATE public.notary_certifications
    SET certification_report_document_id = v_new_id
    WHERE id = p_certification_id;
  END IF;

  INSERT INTO public.packet_audit_log (packet_id, actor_id, action, metadata)
  VALUES (p_packet_id, p_uploaded_by, 'document_replaced',
    jsonb_build_object(
      'document_type', p_document_type,
      'old_document_id', v_existing_id,
      'new_document_id', v_new_id,
      'file_hash', p_file_hash,
      'version', v_next_version
    ));

  RETURN jsonb_build_object(
    'old_document_id', v_existing_id,
    'new_document_id', v_new_id,
    'idempotent', false
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.replace_packet_document(uuid, text, text, text, uuid, bigint, int, text, jsonb, uuid, uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.replace_packet_document(uuid, text, text, text, uuid, bigint, int, text, jsonb, uuid, uuid, uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- 10. prepare_notarized_certification RPC (rewrite)
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
  v_scan record;
  v_source record;
  v_attestation record;
  v_cert_type text;
  v_cert_id uuid;
  v_existing_cert record;
  v_checklist jsonb;
  v_checklist_version int;
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

  IF NOT public.is_active_notary(p_notary_id) THEN
    RAISE EXCEPTION 'Notary % is not active', p_notary_id;
  END IF;

  SELECT notary_id INTO v_assigned
  FROM public.notary_assignments WHERE packet_id = p_packet_id;
  IF v_assigned IS NULL OR v_assigned != p_notary_id THEN
    RAISE EXCEPTION 'Notary % is not assigned to packet %', p_notary_id, p_packet_id;
  END IF;

  -- Validate scan
  SELECT id, status, document_type, packet_id, source_document_id, file_hash, metadata
    INTO v_scan
  FROM public.packet_documents WHERE id = p_notarial_scan_document_id;

  IF v_scan IS NULL OR v_scan.document_type != 'notarial_scan' OR v_scan.status != 'accepted' THEN
    RAISE EXCEPTION 'Document must be an accepted notarial_scan';
  END IF;
  IF v_scan.packet_id != p_packet_id THEN
    RAISE EXCEPTION 'Document does not belong to this packet';
  END IF;
  IF v_scan.source_document_id IS NULL THEN
    RAISE EXCEPTION 'Notarial scan must have source_document_id (strict lineage)';
  END IF;

  -- Validate source
  SELECT id, document_type, status, file_hash
    INTO v_source
  FROM public.packet_documents WHERE id = v_scan.source_document_id;

  IF v_source IS NULL OR v_source.document_type != 'signed_pdf' OR v_source.status != 'accepted' THEN
    RAISE EXCEPTION 'Notarial scan source must be the accepted signed_pdf';
  END IF;

  -- Validate attestation binds exact documents
  SELECT * INTO v_attestation
  FROM public.notary_attestations
  WHERE notarial_scan_document_id = p_notarial_scan_document_id
    AND notary_id = p_notary_id;

  IF v_attestation IS NULL THEN
    RAISE EXCEPTION 'Attestation required for this notarial scan before preparation';
  END IF;
  IF v_attestation.packet_id != p_packet_id THEN
    RAISE EXCEPTION 'Attestation packet mismatch';
  END IF;
  IF v_attestation.source_signed_document_id != v_scan.source_document_id THEN
    RAISE EXCEPTION 'Attestation source document mismatch';
  END IF;
  IF v_attestation.notarial_scan_hash != v_scan.file_hash THEN
    RAISE EXCEPTION 'Attestation scan hash mismatch';
  END IF;
  IF v_attestation.source_document_hash != v_source.file_hash THEN
    RAISE EXCEPTION 'Attestation source hash mismatch';
  END IF;

  -- Validate scan metadata
  IF NOT (
    (v_scan.metadata -> 'validation_result' ->> 'pdf_header_ok')::boolean IS TRUE
    AND (v_scan.metadata -> 'validation_result' ->> 'pdf_structure_ok')::boolean IS TRUE
    AND (v_scan.metadata -> 'validation_result' ->> 'not_encrypted')::boolean IS TRUE
    AND (v_scan.metadata -> 'validation_result' ->> 'validator_version') IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Scan validation metadata incomplete or invalid';
  END IF;

  -- Revalidate checklist
  SELECT checklist_data, checklist_version INTO v_checklist, v_checklist_version
  FROM public.notary_review_checklists
  WHERE packet_id = p_packet_id AND notary_id = p_notary_id;

  IF v_checklist IS NULL THEN
    RAISE EXCEPTION 'No checklist found for packet %', p_packet_id;
  END IF;

  PERFORM public.validate_notary_checklist(v_checklist, COALESCE(v_checklist_version, 1));

  v_cert_type := CASE WHEN p_observations IS NOT NULL
    THEN 'certified_with_observations' ELSE 'certified' END;

  -- Check for stale prepared certification referencing a different scan: void it
  SELECT id, notarial_scan_document_id, attestation_id, notary_id,
         observations, checklist_version, checklist_data
    INTO v_existing_cert
  FROM public.notary_certifications
  WHERE packet_id = p_packet_id AND publication_status = 'prepared';

  IF v_existing_cert IS NOT NULL THEN
    IF v_existing_cert.notarial_scan_document_id = p_notarial_scan_document_id
       AND v_existing_cert.attestation_id = v_attestation.id
       AND v_existing_cert.notary_id = p_notary_id
       AND COALESCE(v_existing_cert.observations, '') = COALESCE(p_observations, '')
       AND COALESCE(v_existing_cert.checklist_version, 1) = COALESCE(v_checklist_version, 1)
       AND v_existing_cert.checklist_data = v_checklist
       AND v_attestation.notarial_scan_hash = v_scan.file_hash
       AND v_attestation.source_document_hash = v_source.file_hash
    THEN
      RETURN jsonb_build_object(
        'newly_prepared', false,
        'certification_id', v_existing_cert.id
      );
    END IF;

    UPDATE public.notary_certifications
    SET publication_status = 'void'
    WHERE id = v_existing_cert.id;
  END IF;

  INSERT INTO public.notary_certifications (
    packet_id, notary_id, certification_type, observations,
    checklist_data, checklist_version, publication_status, prepared_at,
    notarial_scan_document_id, attestation_id
  ) VALUES (
    p_packet_id, p_notary_id, v_cert_type, p_observations,
    COALESCE(v_checklist, '{}'), COALESCE(v_checklist_version, 1),
    'prepared', now(),
    p_notarial_scan_document_id, v_attestation.id
  ) RETURNING id INTO v_cert_id;

  INSERT INTO public.packet_audit_log (packet_id, actor_id, action, metadata)
  VALUES (p_packet_id, p_notary_id, 'notary_certification_prepared',
    jsonb_build_object(
      'certification_id', v_cert_id,
      'notarial_scan_document_id', p_notarial_scan_document_id,
      'certification_type', v_cert_type,
      'checklist_version', COALESCE(v_checklist_version, 1)
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
-- 11. finalize_notarized_certification RPC (rewrite)
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
  v_cert record;
  v_scan record;
  v_source record;
  v_attestation record;
  v_report record;
  v_registry_id uuid;
  v_checklist jsonb;
  v_checklist_version int;
BEGIN
  SELECT status, notary_workflow_version INTO v_status, v_workflow
  FROM public.lease_packets WHERE id = p_packet_id FOR UPDATE;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Packet not found: %', p_packet_id;
  END IF;

  IF NOT public.is_active_notary(p_notary_id) THEN
    RAISE EXCEPTION 'Notary % is not active', p_notary_id;
  END IF;

  SELECT notary_id INTO v_assigned
  FROM public.notary_assignments WHERE packet_id = p_packet_id;
  IF v_assigned IS NULL OR v_assigned != p_notary_id THEN
    RAISE EXCEPTION 'Notary % is not assigned to packet %', p_notary_id, p_packet_id;
  END IF;

  -- Idempotency: already certified — confirm supplied cert is the published one
  IF v_status = 'certified' THEN
    IF NOT EXISTS(
      SELECT 1 FROM public.notary_certifications
      WHERE id = p_certification_id
        AND packet_id = p_packet_id
        AND publication_status = 'published'
    ) THEN
      RAISE EXCEPTION 'Certification % is not the published certification for packet %', p_certification_id, p_packet_id;
    END IF;

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

  -- Load and validate certification
  SELECT * INTO v_cert
  FROM public.notary_certifications WHERE id = p_certification_id;

  IF v_cert IS NULL THEN
    RAISE EXCEPTION 'Certification not found: %', p_certification_id;
  END IF;
  IF v_cert.publication_status != 'prepared' THEN
    RAISE EXCEPTION 'Certification must be prepared, got: %', v_cert.publication_status;
  END IF;
  IF v_cert.packet_id != p_packet_id OR v_cert.notary_id != p_notary_id THEN
    RAISE EXCEPTION 'Certification does not match packet/notary';
  END IF;

  -- Full lineage chain validation
  IF v_cert.notarial_scan_document_id IS NULL THEN
    RAISE EXCEPTION 'No notarial scan linked to certification';
  END IF;

  SELECT * INTO v_scan
  FROM public.packet_documents WHERE id = v_cert.notarial_scan_document_id;
  IF v_scan IS NULL OR v_scan.status != 'accepted' OR v_scan.document_type != 'notarial_scan' THEN
    RAISE EXCEPTION 'Notarial scan must be accepted notarial_scan';
  END IF;
  IF v_scan.packet_id != p_packet_id THEN
    RAISE EXCEPTION 'Scan does not belong to this packet';
  END IF;

  IF v_scan.source_document_id IS NULL THEN
    RAISE EXCEPTION 'Scan has no source document';
  END IF;

  SELECT * INTO v_source
  FROM public.packet_documents WHERE id = v_scan.source_document_id;
  IF v_source IS NULL OR v_source.status != 'accepted' OR v_source.document_type != 'signed_pdf' THEN
    RAISE EXCEPTION 'Source must be accepted signed_pdf';
  END IF;
  IF v_source.packet_id != p_packet_id THEN
    RAISE EXCEPTION 'Source does not belong to this packet';
  END IF;

  -- Validate attestation chain
  IF v_cert.attestation_id IS NULL THEN
    RAISE EXCEPTION 'No attestation linked to certification';
  END IF;

  SELECT * INTO v_attestation
  FROM public.notary_attestations WHERE id = v_cert.attestation_id;
  IF v_attestation IS NULL THEN
    RAISE EXCEPTION 'Attestation not found: %', v_cert.attestation_id;
  END IF;
  IF v_attestation.notarial_scan_document_id != v_scan.id THEN
    RAISE EXCEPTION 'Attestation scan mismatch';
  END IF;
  IF v_attestation.source_signed_document_id != v_source.id THEN
    RAISE EXCEPTION 'Attestation source mismatch';
  END IF;
  IF v_attestation.notarial_scan_hash != v_scan.file_hash THEN
    RAISE EXCEPTION 'Attestation scan hash mismatch';
  END IF;
  IF v_attestation.source_document_hash != v_source.file_hash THEN
    RAISE EXCEPTION 'Attestation source hash mismatch';
  END IF;

  -- Validate report with certification_id binding
  IF v_cert.certification_report_document_id IS NULL THEN
    RAISE EXCEPTION 'No certification report linked to certification';
  END IF;

  SELECT * INTO v_report
  FROM public.packet_documents WHERE id = v_cert.certification_report_document_id;
  IF v_report IS NULL OR v_report.status != 'accepted' OR v_report.document_type != 'certification_report' THEN
    RAISE EXCEPTION 'Report must be accepted certification_report';
  END IF;
  IF v_report.packet_id != p_packet_id THEN
    RAISE EXCEPTION 'Report does not belong to this packet';
  END IF;
  IF v_report.source_document_id != v_scan.id THEN
    RAISE EXCEPTION 'Report source_document_id must point to the notarial scan';
  END IF;
  IF v_report.certification_id != p_certification_id THEN
    RAISE EXCEPTION 'Report certification_id must match the certification being finalized';
  END IF;

  -- Revalidate checklist
  v_checklist := v_cert.checklist_data;
  v_checklist_version := COALESCE(v_cert.checklist_version, 1);
  PERFORM public.validate_notary_checklist(v_checklist, v_checklist_version);

  -- Finalize
  UPDATE public.lease_packets
  SET status = 'certified', certified_at = now()
  WHERE id = p_packet_id;

  UPDATE public.notary_assignments
  SET decision = v_cert.certification_type,
      decided_at = now(),
      observations = v_cert.observations
  WHERE packet_id = p_packet_id AND notary_id = p_notary_id;

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

  -- Queue notifications
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

  INSERT INTO public.packet_audit_log (packet_id, actor_id, action, metadata)
  VALUES (p_packet_id, p_notary_id, 'notary_finalized_certification',
    jsonb_build_object(
      'certification_id', p_certification_id,
      'registry_entry_id', v_registry_id,
      'notarial_scan_document_id', v_cert.notarial_scan_document_id,
      'certification_report_document_id', v_cert.certification_report_document_id,
      'attestation_id', v_cert.attestation_id,
      'certification_type', v_cert.certification_type,
      'checklist_version', v_checklist_version
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

-- ---------------------------------------------------------------------------
-- 12. claim_notification_outbox RPC (new)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.claim_notification_outbox(p_limit int DEFAULT 10)
RETURNS TABLE(
  id uuid,
  packet_id uuid,
  event_type text,
  recipient_key text,
  payload jsonb,
  attempt_count int,
  claim_token uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token uuid := gen_random_uuid();
  v_stale_threshold timestamptz := now() - interval '5 minutes';
BEGIN
  RETURN QUERY
  WITH claimable AS (
    SELECT o.id
    FROM public.notification_outbox o
    WHERE (
      (o.status = 'pending' AND o.available_at <= now())
      OR (o.status = 'failed' AND o.available_at <= now() AND o.attempt_count < 5)
      OR (o.status = 'processing' AND o.processing_started_at < v_stale_threshold AND o.attempt_count < 5)
    )
    ORDER BY o.available_at ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.notification_outbox AS o
  SET status = 'processing',
      processing_started_at = now(),
      claim_token = v_token,
      attempt_count = o.attempt_count + 1,
      updated_at = now()
  FROM claimable
  WHERE o.id = claimable.id
  RETURNING o.id, o.packet_id, o.event_type, o.recipient_key,
            o.payload, o.attempt_count, v_token;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_notification_outbox(int) FROM public;
GRANT EXECUTE ON FUNCTION public.claim_notification_outbox(int) TO service_role;
