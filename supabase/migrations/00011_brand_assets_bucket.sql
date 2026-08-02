-- Public bucket for brand assets used in transactional emails.
-- Email clients fetch images over HTTPS; hosting on Supabase Storage
-- avoids dependency on the app server being healthy.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'brand-assets',
  'brand-assets',
  true,
  5242880,
  ARRAY['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read brand-assets"
  ON storage.objects FOR SELECT
  TO anon
  USING (bucket_id = 'brand-assets');
