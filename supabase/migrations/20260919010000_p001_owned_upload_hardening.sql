-- =============================================================================
-- P-001 hardening phase
-- Apply only after the reservation-first application deployment is healthy.
-- =============================================================================

REVOKE INSERT, UPDATE ON public.lease_packets FROM authenticated;
REVOKE INSERT, UPDATE ON public.packet_documents FROM authenticated;
REVOKE INSERT ON public.packet_signers FROM authenticated;
