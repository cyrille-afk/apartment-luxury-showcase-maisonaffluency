DROP POLICY IF EXISTS "Studio editors can delete client document files" ON storage.objects;
CREATE POLICY "Studio editors can delete client document files"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'client-documents' AND public.can_edit_studio(auth.uid(), (storage.foldername(name))[1]::uuid));

DROP POLICY IF EXISTS "Studio editors can update client document files" ON storage.objects;
CREATE POLICY "Studio editors can update client document files"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'client-documents' AND public.can_edit_studio(auth.uid(), (storage.foldername(name))[1]::uuid))
  WITH CHECK (bucket_id = 'client-documents' AND public.can_edit_studio(auth.uid(), (storage.foldername(name))[1]::uuid));

DROP POLICY IF EXISTS "Studio members can read cad-uploads" ON storage.objects;
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

DROP POLICY IF EXISTS "Studio members can read client document files" ON storage.objects;
CREATE POLICY "Studio members can read client document files"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'client-documents' AND public.can_view_studio(auth.uid(), (storage.foldername(name))[1]::uuid));