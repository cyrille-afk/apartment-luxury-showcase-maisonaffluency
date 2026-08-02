DROP POLICY IF EXISTS "trade-private owner read" ON storage.objects;
CREATE POLICY "trade-private owner read"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'trade-private'
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
    OR (storage.foldername(name))[2] = auth.uid()::text
    OR owner = auth.uid()
  )
);

DROP POLICY IF EXISTS "trade-private owner write" ON storage.objects;
CREATE POLICY "trade-private owner write"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'trade-private'
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
    OR (
      has_role(auth.uid(), 'trade_user'::app_role)
      AND (storage.foldername(name))[2] = auth.uid()::text
    )
  )
);

DROP POLICY IF EXISTS "trade-private owner update" ON storage.objects;
CREATE POLICY "trade-private owner update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'trade-private'
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
    OR owner = auth.uid()
  )
);

DROP POLICY IF EXISTS "trade-private owner delete" ON storage.objects;
CREATE POLICY "trade-private owner delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'trade-private'
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
    OR owner = auth.uid()
  )
);

DROP POLICY IF EXISTS "Trade users can upload axonometric sources" ON storage.objects;
DROP POLICY IF EXISTS "Trade users can upload axonometric submissions" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload proposal externals" ON storage.objects;