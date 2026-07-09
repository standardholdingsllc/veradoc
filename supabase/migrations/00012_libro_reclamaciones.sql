-- Libro de Reclamaciones Virtual
-- INDECOPI: Ley 29571, DS 011-2011-PCM, Ley 31435
-- Fields follow Anexo I format (DS 011-2011-PCM)

create table public.complaints (
  id bigint generated always as identity primary key,
  code text not null unique,
  created_at timestamptz not null default now(),

  -- Consumer identification
  consumer_name text not null,
  consumer_dni text not null,
  consumer_email text not null,
  consumer_phone text,
  consumer_address text,
  consumer_is_minor boolean not null default false,
  guardian_name text,
  guardian_dni text,

  -- Complaint details
  complaint_type text not null check (complaint_type in ('reclamo', 'queja')),
  product_or_service text not null,
  order_number text,
  amount numeric(12, 2),
  description text not null,
  requested_remedy text not null,

  -- Provider response
  status text not null default 'pendiente'
    check (status in ('pendiente', 'en_revision', 'respondido', 'cerrado')),
  response text,
  responded_at timestamptz,
  responded_by uuid references auth.users(id),

  -- Metadata
  ip_address text,
  user_agent text
);

comment on table public.complaints is 'Libro de Reclamaciones Virtual – INDECOPI (Ley 29571, DS 011-2011-PCM)';
comment on column public.complaints.code is 'Correlative unique code for consumer tracking (e.g. VD-2026-000001)';
comment on column public.complaints.complaint_type is 'reclamo = claim about the service; queja = complaint about customer care';

create index idx_complaints_code on public.complaints (code);
create index idx_complaints_status on public.complaints (status);
create index idx_complaints_created_at on public.complaints (created_at desc);

-- RLS: anon can insert (the form is public); only admins can read/update
alter table public.complaints enable row level security;

create policy "Anyone can submit a complaint"
  on public.complaints for insert
  to anon, authenticated
  with check (true);

create policy "Admins can read complaints"
  on public.complaints for select
  to authenticated
  using (public.is_active_admin());

create policy "Admins can update complaints"
  on public.complaints for update
  to authenticated
  using (public.is_active_admin())
  with check (public.is_active_admin());

-- Sequence helper for generating correlative codes
create or replace function public.generate_complaint_code()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.code := 'VD-' || extract(year from now())::text || '-' || lpad(new.id::text, 6, '0');
  return new;
end;
$$;

create trigger trg_complaint_code
  before insert on public.complaints
  for each row execute function public.generate_complaint_code();
