-- Fix the bespoke-attachments RLS policies so anonymous/product-page visitors can
-- upload reference files from the Bespoke Configuration dialog.
-- The previous policies used a subquery into storage.buckets, which can fail
-- when the anon role cannot read the buckets row through RLS.
-- Replace them with direct bucket_id text comparisons.

DROP POLICY IF EXISTS "Allow anon uploads to bespoke attachments" ON storage.objects;
DROP POLICY IF EXISTS "Allow auth uploads to bespoke attachments" ON storage.objects;

CREATE POLICY "Allow anon uploads to bespoke attachments"
  ON storage.objects
  FOR INSERT
  TO anon
  WITH CHECK (bucket_id = 'bespoke-attachments');

CREATE POLICY "Allow auth uploads to bespoke attachments"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'bespoke-attachments');