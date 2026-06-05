
-- Path convention: cad-uploads/{studio_id|user_id}/{filename}
-- First folder segment is either a studio id (preferred) or the uploader's user id (when no studio).

CREATE POLICY "Studio members can read cad-uploads"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'cad-uploads'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM public.studios s
      WHERE s.id::text = (storage.foldername(name))[1]
        AND public.can_view_studio(auth.uid(), s.id)
    )
  )
);

CREATE POLICY "Studio members can upload cad-uploads"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'cad-uploads'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM public.studios s
      WHERE s.id::text = (storage.foldername(name))[1]
        AND public.can_view_studio(auth.uid(), s.id)
    )
  )
);

CREATE POLICY "Studio members can delete cad-uploads"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'cad-uploads'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM public.studios s
      WHERE s.id::text = (storage.foldername(name))[1]
        AND public.can_view_studio(auth.uid(), s.id)
    )
  )
);
