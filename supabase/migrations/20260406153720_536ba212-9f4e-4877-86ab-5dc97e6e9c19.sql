DROP POLICY IF EXISTS "Auth upload designer images" ON storage.objects;

CREATE POLICY "Admins and trade users can upload designer images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'designer-images'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'trade_user')
  )
);