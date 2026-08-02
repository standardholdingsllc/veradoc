-- Linked lease renewal packets.
-- A renewal is a new draft packet whose parent_packet_id points to the
-- certified packet being renewed. The parent keeps a reverse pointer so the
-- landlord flow can avoid creating duplicate renewal drafts.

alter table public.lease_packets
  add column if not exists parent_packet_id uuid references public.lease_packets(id) on delete set null,
  add column if not exists renewed_by_packet_id uuid references public.lease_packets(id) on delete set null;

create index if not exists idx_lease_packets_parent_packet
  on public.lease_packets(parent_packet_id);

create unique index if not exists idx_lease_packets_renewed_by_packet
  on public.lease_packets(renewed_by_packet_id)
  where renewed_by_packet_id is not null;

create unique index if not exists idx_lease_packets_one_renewal_per_parent
  on public.lease_packets(parent_packet_id)
  where parent_packet_id is not null;
