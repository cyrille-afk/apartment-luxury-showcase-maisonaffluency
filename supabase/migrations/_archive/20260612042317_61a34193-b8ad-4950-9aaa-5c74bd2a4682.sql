-- 1) designer_curator_picks: revoke pricing column access from anon (RLS public policy stays for other columns)
REVOKE SELECT (trade_price_cents, price_per_sqm_cents) ON public.designer_curator_picks FROM anon;

-- 2) featured_studios: contact_email already hidden from anon via column-level grants.
--    Tighten further by revoking from authenticated too. Re-grant every other
--    column explicitly so the table stays readable to logged-in users.
REVOKE SELECT ON public.featured_studios FROM authenticated;
GRANT SELECT (
  id, slug, name, tagline, bio, founded_year, team_size, location, country,
  website_url, instagram_handle, logo_url, hero_image_url, gallery_images,
  disciplines, project_types, notable_projects, is_featured, is_published,
  sort_order, created_at, updated_at, owner_user_id
) ON public.featured_studios TO authenticated;

-- 3) Fix CAD upload storage policies — `s.name` was matching the studio row's
--    name column instead of the uploaded object path, silently disabling the
--    studio-membership branch. Use `name` (the storage.objects column) instead.
DROP POLICY IF EXISTS "Studio members can read cad-uploads" ON storage.objects;
DROP POLICY IF EXISTS "Studio members can upload cad-uploads" ON storage.objects;
DROP POLICY IF EXISTS "Studio members can delete cad-uploads" ON storage.objects;

CREATE POLICY "Studio members can read cad-uploads"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'cad-uploads'
  AND (
    (storage.foldername(name))[1] = (auth.uid())::text
    OR EXISTS (
      SELECT 1 FROM public.studios s
      WHERE (s.id)::text = (storage.foldername(storage.objects.name))[1]
        AND public.can_view_studio(auth.uid(), s.id)
    )
  )
);

CREATE POLICY "Studio members can upload cad-uploads"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'cad-uploads'
  AND (
    (storage.foldername(name))[1] = (auth.uid())::text
    OR EXISTS (
      SELECT 1 FROM public.studios s
      WHERE (s.id)::text = (storage.foldername(storage.objects.name))[1]
        AND public.can_view_studio(auth.uid(), s.id)
    )
  )
);

CREATE POLICY "Studio members can delete cad-uploads"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'cad-uploads'
  AND (
    (storage.foldername(name))[1] = (auth.uid())::text
    OR EXISTS (
      SELECT 1 FROM public.studios s
      WHERE (s.id)::text = (storage.foldername(storage.objects.name))[1]
        AND public.can_view_studio(auth.uid(), s.id)
    )
  )
);

-- 4) studio_submissions INSERT must not allow attributing the submission to
--    an arbitrary user_id. Allow NULL (anonymous) or the caller's own uid.
DROP POLICY IF EXISTS "Anyone can submit a studio" ON public.studio_submissions;
CREATE POLICY "Anyone can submit a studio"
ON public.studio_submissions FOR INSERT
WITH CHECK (user_id IS NULL OR user_id = auth.uid());