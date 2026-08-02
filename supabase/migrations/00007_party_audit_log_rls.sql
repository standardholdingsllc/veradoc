-- Allow signers to read audit log entries on packets they are a party to.
-- This mirrors the existing signer read policies on packet_documents,
-- signer_evidence, and notary_certifications (all use packets_as_signer()).
create policy "Signers read audit log on their packets"
  on public.packet_audit_log for select
  to authenticated
  using (packet_id in (select public.packets_as_signer()));
