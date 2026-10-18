ALTER TABLE public.studios ADD COLUMN IF NOT EXISTS pdf_cover_theme jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.studios ADD CONSTRAINT studios_pdf_cover_theme_shape CHECK (
  jsonb_typeof(pdf_cover_theme) = 'object'
  AND (NOT pdf_cover_theme ? 'background' OR (pdf_cover_theme->>'background') ~ '^#[0-9a-fA-F]{6}$')
  AND (NOT pdf_cover_theme ? 'accent' OR (pdf_cover_theme->>'accent') ~ '^#[0-9a-fA-F]{6}$')
  AND (NOT pdf_cover_theme ? 'text' OR (pdf_cover_theme->>'text') ~ '^#[0-9a-fA-F]{6}$')
);
CREATE POLICY "Studio editors upload studio logos" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'assets' AND (storage.foldername(name))[1] = 'studio-logos' AND public.can_edit_studio(auth.uid(), ((storage.foldername(name))[2])::uuid) AND lower(storage.extension(name)) IN ('png','jpg','jpeg'));
CREATE POLICY "Studio editors delete studio logos" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'assets' AND (storage.foldername(name))[1] = 'studio-logos' AND public.can_edit_studio(auth.uid(), ((storage.foldername(name))[2])::uuid));