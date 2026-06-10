
-- 1. cad_documents
DROP POLICY IF EXISTS "Studio members can delete cad documents" ON public.cad_documents;
DROP POLICY IF EXISTS "Studio members can update cad documents" ON public.cad_documents;

CREATE POLICY "Studio editors or uploader can delete cad documents"
ON public.cad_documents FOR DELETE
USING ((uploaded_by = auth.uid()) OR (studio_id IS NOT NULL AND can_edit_studio(auth.uid(), studio_id)));

CREATE POLICY "Studio editors or uploader can update cad documents"
ON public.cad_documents FOR UPDATE
USING ((uploaded_by = auth.uid()) OR (studio_id IS NOT NULL AND can_edit_studio(auth.uid(), studio_id)))
WITH CHECK ((uploaded_by = auth.uid()) OR (studio_id IS NOT NULL AND can_edit_studio(auth.uid(), studio_id)));

-- 2. designer_curator_picks
DROP POLICY IF EXISTS "Trade users and admins can view curator picks" ON public.designer_curator_picks;

CREATE POLICY "Only trade users and admins can view curator picks"
ON public.designer_curator_picks FOR SELECT
USING (has_role(auth.uid(), 'trade_user'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

GRANT SELECT ON public.designer_curator_picks_public TO anon, authenticated;

-- 3. featured_studios
DROP POLICY IF EXISTS "Anyone can view published studios" ON public.featured_studios;

CREATE POLICY "Trade and admins can view published studios with contact"
ON public.featured_studios FOR SELECT
USING (
  is_published = true
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'trade_user'::app_role))
);

CREATE OR REPLACE VIEW public.featured_studios_public AS
SELECT
  id, slug, name, tagline, bio, founded_year, team_size, location, country,
  website_url, instagram_handle, logo_url, hero_image_url, gallery_images,
  disciplines, project_types, notable_projects, is_featured, is_published,
  sort_order, created_at, updated_at
FROM public.featured_studios
WHERE is_published = true;

ALTER VIEW public.featured_studios_public SET (security_invoker = off);
GRANT SELECT ON public.featured_studios_public TO anon, authenticated;

-- 4. studio_submissions email validation
ALTER TABLE public.studio_submissions
  ADD CONSTRAINT studio_submissions_email_format_chk
  CHECK (
    email IS NULL
    OR (
      char_length(email) <= 255
      AND email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
    )
  );
