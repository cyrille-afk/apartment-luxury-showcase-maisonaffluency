-- 1) Storage: replace the blanket SELECT on `assets` with one that excludes
--    trade-only private subfolders. The existing INSERT/DELETE policies for
--    those subfolders already scope writes to owner/admin; this closes the
--    matching SELECT gap.
DROP POLICY IF EXISTS "Authenticated can list public image buckets" ON storage.objects;

CREATE POLICY "Authenticated can list public image buckets"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = ANY (ARRAY['assets'::text, 'avatars'::text, 'designer-images'::text])
  AND (
    bucket_id <> 'assets'
    OR (
      -- Exclude private trade-only prefixes from the broad read.
      COALESCE((storage.foldername(name))[1], '') NOT IN (
        'axonometric-sources',
        'axonometric-submissions',
        'proposal-externals'
      )
    )
  )
);

-- 2) trade_product_glb_variants: restrict SELECT to trade users + admins,
--    matching the parent trade_products gating.
DROP POLICY IF EXISTS "Anyone can view GLB variants" ON public.trade_product_glb_variants;

CREATE POLICY "Trade users and admins can view GLB variants"
ON public.trade_product_glb_variants
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'trade_user'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
);