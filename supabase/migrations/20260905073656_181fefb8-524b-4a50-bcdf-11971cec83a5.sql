CREATE POLICY "Anon applicants upload trade credentials"
ON storage.objects FOR INSERT TO anon
WITH CHECK (
  bucket_id = 'trade-credentials'
  AND (storage.foldername(name))[1] = 'anon'
);