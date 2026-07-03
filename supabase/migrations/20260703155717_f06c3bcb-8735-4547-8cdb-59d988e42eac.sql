DROP POLICY IF EXISTS "Public can view published featured studios" ON public.featured_studios_public;

CREATE POLICY "Public can view published featured studios"
  ON public.featured_studios_public
  FOR SELECT
  USING (is_published = true);