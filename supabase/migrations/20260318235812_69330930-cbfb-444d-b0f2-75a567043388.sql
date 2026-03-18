CREATE POLICY "Admins can upload proposal externals"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'assets'
  AND (storage.foldername(name))[1] = 'proposal-externals'
  AND (has_role(auth.uid(), 'admin'::app_role))
);