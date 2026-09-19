
-- 1) CAD uploads: fix s.name -> objects.name self-reference bug in INSERT and DELETE storage policies
DROP POLICY IF EXISTS "Studio members can upload cad-uploads" ON storage.objects;
CREATE POLICY "Studio members can upload cad-uploads"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'cad-uploads'
  AND (
    (storage.foldername(name))[1] = (auth.uid())::text
    OR EXISTS (
      SELECT 1 FROM public.studios s
      WHERE (s.id)::text = (storage.foldername(objects.name))[1]
        AND public.can_view_studio(auth.uid(), s.id)
        AND (storage.foldername(objects.name))[2] = (auth.uid())::text
    )
  )
);

DROP POLICY IF EXISTS "Studio members can delete cad-uploads" ON storage.objects;
CREATE POLICY "Studio members can delete cad-uploads"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'cad-uploads'
  AND (
    (storage.foldername(name))[1] = (auth.uid())::text
    OR EXISTS (
      SELECT 1 FROM public.studios s
      WHERE (s.id)::text = (storage.foldername(objects.name))[1]
        AND public.can_view_studio(auth.uid(), s.id)
        AND (storage.foldername(objects.name))[2] = (auth.uid())::text
    )
  )
);

-- 2) brand_thumbnails: restrict reads to trade_user / admin
DROP POLICY IF EXISTS "Authenticated users can view brand thumbnails" ON public.brand_thumbnails;
CREATE POLICY "Trade users and admins can view brand thumbnails"
ON public.brand_thumbnails FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'trade_user'::public.app_role)
);

-- 3) section_heroes: restrict reads to trade_user / admin
DROP POLICY IF EXISTS "Authenticated users can view section heroes" ON public.section_heroes;
CREATE POLICY "Trade users and admins can view section heroes"
ON public.section_heroes FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'trade_user'::public.app_role)
);

-- 4) reference_styles: restrict reads to creator or admin
DROP POLICY IF EXISTS "Authenticated users can view reference styles" ON public.reference_styles;
CREATE POLICY "Owners and admins can view reference styles"
ON public.reference_styles FOR SELECT TO authenticated
USING (
  created_by = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);
