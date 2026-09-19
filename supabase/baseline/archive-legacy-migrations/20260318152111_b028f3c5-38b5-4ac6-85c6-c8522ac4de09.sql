-- Allow trade users to upload to axonometric-submissions folder in assets bucket
CREATE POLICY "Trade users can upload axonometric submissions"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'assets'
  AND (storage.foldername(name))[1] = 'axonometric-submissions'
  AND (public.has_role(auth.uid(), 'trade_user'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role))
);