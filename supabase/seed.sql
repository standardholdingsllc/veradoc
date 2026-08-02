-- Seed data for local development only
-- Run with: npx supabase db reset (applies migrations + seed)

-- 1. Auth users (local Supabase only -- will not work on remote)
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
VALUES
  ('a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@veradoc.pe', crypt('Admin123!', gen_salt('bf')), now(), now(), now()),
  ('a0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'notario@veradoc.pe', crypt('Notario123!', gen_salt('bf')), now(), now(), now()),
  ('a0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'agente@veradoc.pe', crypt('Agente123!', gen_salt('bf')), now(), now(), now()),
  ('a0000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'inquilino@veradoc.pe', crypt('Renter123!', gen_salt('bf')), now(), now(), now());

INSERT INTO auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'email', '{"sub":"a0000000-0000-0000-0000-000000000001","email":"admin@veradoc.pe"}', now(), now(), now()),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', 'email', '{"sub":"a0000000-0000-0000-0000-000000000002","email":"notario@veradoc.pe"}', now(), now(), now()),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000003', 'email', '{"sub":"a0000000-0000-0000-0000-000000000003","email":"agente@veradoc.pe"}', now(), now(), now()),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000004', 'email', '{"sub":"a0000000-0000-0000-0000-000000000004","email":"inquilino@veradoc.pe"}', now(), now(), now());

-- 2. Profiles
INSERT INTO public.profiles (id, role, status, full_name, email, phone, dni, province, department)
VALUES
  ('a0000000-0000-0000-0000-000000000001', 'admin', 'active', 'Admin VeraDoc', 'admin@veradoc.pe', '+51999000001', '12345678', 'Lima', 'Lima'),
  ('a0000000-0000-0000-0000-000000000002', 'notary', 'active', 'Dr. Carlos Mendoza', 'notario@veradoc.pe', '+51999000002', '23456789', 'Lima', 'Lima'),
  ('a0000000-0000-0000-0000-000000000003', 'realtor', 'active', 'Maria Garcia Lopez', 'agente@veradoc.pe', '+51999000003', '34567890', 'Lima', 'Lima'),
  ('a0000000-0000-0000-0000-000000000004', 'renter', 'active', 'Juan Perez Torres', 'inquilino@veradoc.pe', '+51999000004', '45678901', 'Lima', 'Lima');

-- 3. Notary coverage
INSERT INTO public.notary_coverage (notary_id, province, department, active)
VALUES ('a0000000-0000-0000-0000-000000000002', 'Lima', 'Lima', true);

-- 4. Test packet
INSERT INTO public.lease_packets (
  id, created_by, status, property_address, property_unit, district, province, department,
  rental_amount, deposit_amount, lease_start_date, lease_end_date, document_hash
)
VALUES (
  'b0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000003',
  'draft',
  'Av. Javier Prado 1234',
  'Dpto 501',
  'San Isidro',
  'Lima',
  'Lima',
  1500.00,
  3000.00,
  '2026-07-01',
  '2027-06-30',
  'sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
);
