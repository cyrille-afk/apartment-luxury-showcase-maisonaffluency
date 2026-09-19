
-- 1) Scope designer-images uploads to a folder matching the user's ID
DROP POLICY IF EXISTS "Admins and trade users can upload designer images" ON storage.objects;
CREATE POLICY "Admins and trade users can upload designer images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'designer-images'
  AND (storage.foldername(name))[1] = (auth.uid())::text
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'trade_user'::app_role))
);

-- 2) Allow trade users to delete their own axonometric source uploads
CREATE POLICY "Trade users can delete own axonometric sources"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'assets'
  AND (storage.foldername(name))[1] = 'axonometric-sources'
  AND (has_role(auth.uid(), 'trade_user'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
);

-- 3) Allow trade users to delete their own axonometric submissions
CREATE POLICY "Trade users can delete own axonometric submissions"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'assets'
  AND (storage.foldername(name))[1] = 'axonometric-submissions'
  AND (has_role(auth.uid(), 'trade_user'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
);
