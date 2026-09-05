DROP POLICY IF EXISTS "Anon applicants read own uploaded credentials" ON storage.objects;
CREATE POLICY "Anon applicants read own uploaded credentials"
  ON storage.objects FOR SELECT TO anon
  USING (bucket_id = 'trade-credentials' AND (storage.foldername(name))[1] = 'anon');