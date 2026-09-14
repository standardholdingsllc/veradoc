-- =============================================================================
-- Database continuity fixes
-- Keep the canonical schema, RLS surface, and worker privileges aligned with
-- the application contracts verified by the remote integration suite.
-- =============================================================================

-- The legacy participant policies predate publication_status.  Leaving them in
-- place ORs them with the hardened policies and exposes prepared certificates.
DROP POLICY IF EXISTS "Realtor reads certifications on own packets"
  ON public.notary_certifications;
DROP POLICY IF EXISTS "Signers read certifications on their packets"
  ON public.notary_certifications;

-- PostgreSQL grants EXECUTE on new functions to PUBLIC by default.  Revoking
-- only from the role named "public" did not remove grants that had already been
-- materialized for API roles in the remote history.
REVOKE EXECUTE ON FUNCTION public.claim_notary_workflow_jobs(integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_notary_workflow_jobs(integer)
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.finalize_legacy_certification_job(uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_legacy_certification_job(uuid, uuid, uuid)
  TO service_role;

-- A composite record is IS NOT NULL only when every field is non-null.  Since
-- observations is intentionally nullable, the old check skipped valid prepared
-- rows and collided with the one-active-certificate partial unique index.
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

  SELECT id, document_type, status, file_hash
    INTO v_source
  FROM public.packet_documents WHERE id = v_scan.source_document_id;

  IF v_source IS NULL OR v_source.document_type != 'signed_pdf' OR v_source.status != 'accepted' THEN
    RAISE EXCEPTION 'Notarial scan source must be the accepted signed_pdf';
  END IF;

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

  IF NOT (
    (v_scan.metadata -> 'validation_result' ->> 'pdf_header_ok')::boolean IS TRUE
    AND (v_scan.metadata -> 'validation_result' ->> 'pdf_structure_ok')::boolean IS TRUE
    AND (v_scan.metadata -> 'validation_result' ->> 'not_encrypted')::boolean IS TRUE
    AND (v_scan.metadata -> 'validation_result' ->> 'validator_version') IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Scan validation metadata incomplete or invalid';
  END IF;

  SELECT checklist_data, checklist_version INTO v_checklist, v_checklist_version
  FROM public.notary_review_checklists
  WHERE packet_id = p_packet_id AND notary_id = p_notary_id;

  IF v_checklist IS NULL THEN
    RAISE EXCEPTION 'No checklist found for packet %', p_packet_id;
  END IF;

  PERFORM public.validate_notary_checklist(v_checklist, COALESCE(v_checklist_version, 1));

  v_cert_type := CASE WHEN p_observations IS NOT NULL
    THEN 'certified_with_observations' ELSE 'certified' END;

  SELECT id, notarial_scan_document_id, attestation_id, notary_id,
         observations, checklist_version, checklist_data
    INTO v_existing_cert
  FROM public.notary_certifications
  WHERE packet_id = p_packet_id AND publication_status = 'prepared';

  IF v_existing_cert.id IS NOT NULL THEN
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

REVOKE EXECUTE ON FUNCTION public.prepare_notarized_certification(uuid, uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_notarized_certification(uuid, uuid, uuid, text)
  TO service_role;
