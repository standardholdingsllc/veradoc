-- =============================================================================
-- 00007_notary_dashboard.sql
-- Adds notary_review_checklists table, RLS, and complete_notary_decision RPC.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Mutable checklist state (separate from immutable notary_certifications)
-- ---------------------------------------------------------------------------

CREATE TABLE public.notary_review_checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  packet_id uuid NOT NULL UNIQUE REFERENCES public.lease_packets(id) ON DELETE CASCADE,
  notary_id uuid NOT NULL REFERENCES public.profiles(id),
  checklist_data jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.notary_review_checklists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Notary reads own checklists"
  ON public.notary_review_checklists FOR SELECT
  TO authenticated
  USING (notary_id = auth.uid());

CREATE POLICY "Notary inserts own checklists"
  ON public.notary_review_checklists FOR INSERT
  TO authenticated
  WITH CHECK (
    notary_id = auth.uid()
    AND packet_id IN (SELECT public.packets_as_notary())
  );

CREATE POLICY "Notary updates own checklists"
  ON public.notary_review_checklists FOR UPDATE
  TO authenticated
  USING (notary_id = auth.uid());

CREATE POLICY "Admin reads all checklists"
  ON public.notary_review_checklists FOR SELECT
  TO authenticated
  USING (public.is_active_admin());

-- Service role needs full access for server actions
GRANT ALL ON public.notary_review_checklists TO service_role;

-- ---------------------------------------------------------------------------
-- 2. complete_notary_decision RPC (atomic decision within a single tx)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.complete_notary_decision(
  p_packet_id uuid,
  p_notary_id uuid,
  p_decision text,
  p_observations text DEFAULT NULL,
  p_checklist_data jsonb DEFAULT '{}'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_status text;
  v_cert_type text;
BEGIN
  -- Map decision to DB status
  CASE p_decision
    WHEN 'certified' THEN v_new_status := 'certified'; v_cert_type := 'certified';
    WHEN 'certified_with_observations' THEN v_new_status := 'certified'; v_cert_type := 'certified_with_observations';
    WHEN 'needs_correction' THEN v_new_status := 'needs_correction'; v_cert_type := NULL;
    WHEN 'rejected' THEN v_new_status := 'rejected'; v_cert_type := NULL;
    ELSE RAISE EXCEPTION 'Invalid decision: %', p_decision;
  END CASE;

  -- Update lease_packets status
  UPDATE public.lease_packets
  SET status = v_new_status,
      certified_at = CASE WHEN p_decision IN ('certified', 'certified_with_observations')
                          THEN now() ELSE certified_at END
  WHERE id = p_packet_id;

  -- Update notary_assignments
  UPDATE public.notary_assignments
  SET decision = p_decision,
      decided_at = now(),
      observations = p_observations
  WHERE packet_id = p_packet_id
    AND notary_id = p_notary_id;

  -- Insert certification record for certify decisions
  IF v_cert_type IS NOT NULL THEN
    INSERT INTO public.notary_certifications (
      packet_id, notary_id, certification_type, observations, checklist_data
    ) VALUES (
      p_packet_id, p_notary_id, v_cert_type, p_observations, p_checklist_data
    );

    -- Create registry entry from packet data
    INSERT INTO public.registry_entries (
      packet_id, property_address, property_unit, district, province,
      landlord_dni, renter_dni,
      lease_start_date, lease_end_date, certified_at, status
    )
    SELECT
      lp.id,
      lp.property_address,
      lp.property_unit,
      lp.district,
      lp.province,
      COALESCE(
        (SELECT ps.signer_dni FROM public.packet_signers ps
         WHERE ps.packet_id = p_packet_id AND ps.role_in_lease = 'landlord' LIMIT 1),
        ''
      ),
      COALESCE(
        (SELECT ps.signer_dni FROM public.packet_signers ps
         WHERE ps.packet_id = p_packet_id AND ps.role_in_lease = 'renter' LIMIT 1),
        ''
      ),
      lp.lease_start_date,
      lp.lease_end_date,
      now(),
      'active'
    FROM public.lease_packets lp
    WHERE lp.id = p_packet_id;
  END IF;

  -- Insert audit log entry
  INSERT INTO public.packet_audit_log (packet_id, actor_id, action, metadata)
  VALUES (
    p_packet_id,
    p_notary_id,
    'notary_decision_' || p_decision,
    jsonb_build_object(
      'decision', p_decision,
      'observations', p_observations
    )
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.complete_notary_decision(uuid, uuid, text, text, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.complete_notary_decision(uuid, uuid, text, text, jsonb) TO service_role;
