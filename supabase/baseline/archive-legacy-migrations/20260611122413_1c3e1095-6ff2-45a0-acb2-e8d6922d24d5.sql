
-- 1. CAD fit edit audit: add explicit INSERT policy
CREATE POLICY "Users insert their own fit edit audit"
ON public.cad_fit_edit_audit
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- 2. Fix broken storage policies on cad-uploads (s.name -> object name)
DROP POLICY IF EXISTS "Studio members can read cad-uploads" ON storage.objects;
DROP POLICY IF EXISTS "Studio members can upload cad-uploads" ON storage.objects;
DROP POLICY IF EXISTS "Studio members can delete cad-uploads" ON storage.objects;

CREATE POLICY "Studio members can read cad-uploads"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'cad-uploads'
  AND (
    (storage.foldername(name))[1] = (auth.uid())::text
    OR EXISTS (
      SELECT 1 FROM public.studios s
      WHERE (s.id)::text = (storage.foldername(name))[1]
        AND public.can_view_studio(auth.uid(), s.id)
    )
  )
);

CREATE POLICY "Studio members can upload cad-uploads"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'cad-uploads'
  AND (
    (storage.foldername(name))[1] = (auth.uid())::text
    OR EXISTS (
      SELECT 1 FROM public.studios s
      WHERE (s.id)::text = (storage.foldername(name))[1]
        AND public.can_view_studio(auth.uid(), s.id)
    )
  )
);

CREATE POLICY "Studio members can delete cad-uploads"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'cad-uploads'
  AND (
    (storage.foldername(name))[1] = (auth.uid())::text
    OR EXISTS (
      SELECT 1 FROM public.studios s
      WHERE (s.id)::text = (storage.foldername(name))[1]
        AND public.can_view_studio(auth.uid(), s.id)
    )
  )
);

-- 3. Revoke contact_email exposure on featured_studios from anon/authenticated
REVOKE SELECT (contact_email) ON public.featured_studios FROM anon;
REVOKE SELECT (contact_email) ON public.featured_studios FROM authenticated;
